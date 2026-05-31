import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
  subscribeCachedCollection,
} from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";
import { DEFAULT_SYSTEM_SETTINGS } from "../../lib/systemSettings";

const SETTING_TYPES = [
  { value: "sprinklerMovement", label: "حركات الرشاش" },
  { value: "cropType", label: "أنواع المحاصيل" },
  { value: "gearType", label: "أنواع الجير" },
  { value: "assetStatus", label: "حالات الأصول" },
  { value: "externalWorkshop", label: "الورش الخارجية" },
];

const BACKUP_COLLECTIONS = [
  "assets",
  "assetTypes",
  "farms",
  "kubras",
  "workers",
  "engineers",
  "heaps",
  "sprinklers",
  "assetMovements",
  "systemSettings",
];

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const serializeData = (value) => {
  if (!value) return value;

  if (value?.toDate) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeData);
  }

  if (typeof value === "object") {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = serializeData(value[key]);
      return acc;
    }, {});
  }

  return value;
};

const addSettingToCache = (setting) => {
  const cached = getCachedCollection("cache:systemSettings");
  setCachedCollection("cache:systemSettings", [setting, ...cached]);
};

const updateSettingCache = (settingId, payload) => {
  const cached = getCachedCollection("cache:systemSettings");

  setCachedCollection(
    "cache:systemSettings",
    cached.map((item) =>
      item.id === settingId
        ? {
            ...item,
            ...payload,
            isOffline: true,
            syncStatus: "pending",
            updatedAt: new Date().toISOString(),
          }
        : item
    )
  );
};

const removeSettingFromCache = (settingId) => {
  const cached = getCachedCollection("cache:systemSettings");

  setCachedCollection(
    "cache:systemSettings",
    cached.filter((item) => item.id !== settingId)
  );
};

export default function SettingsPage() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);

  const [form, setForm] = useState({
    type: "sprinklerMovement",
    name: "",
    notes: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({
      db,
      collectionName: "systemSettings",
      cacheKey: "cache:systemSettings",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث إعدادات النظام لحظيًا");
        setInitialLoading(false);
      },
    });

    return () => unsubscribe?.();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => item.type === form.type);
  }, [items, form.type]);

  const currentTypeLabel =
    SETTING_TYPES.find((item) => item.value === form.type)?.label || "";

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const exportBackup = async () => {
    if (exportingBackup) return;

    setExportingBackup(true);

    try {
      const backup = {
        app: "farm-management",
        version: 1,
        exportedAt: new Date().toISOString(),
        source: isOnline() ? "firestore" : "cache",
        collections: {},
      };

      for (const collectionName of BACKUP_COLLECTIONS) {
        let rows = [];

        try {
          if (isOnline()) {
            const snap = await getDocs(collection(db, collectionName));

            rows = snap.docs.map((item) => ({
              id: item.id,
              ...serializeData(item.data()),
            }));
          } else {
            rows = getCachedCollection(`cache:${collectionName}`).map((item) =>
              serializeData(item)
            );
          }
        } catch (error) {
          console.error(`Backup fallback for ${collectionName}`, error);

          rows = getCachedCollection(`cache:${collectionName}`).map((item) =>
            serializeData(item)
          );
        }

        backup.collections[collectionName] = rows;
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء تصدير النسخة الاحتياطية");
    } finally {
      setExportingBackup(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!canManage || saving) return;

    const name = form.name.trim();
    const notes = form.notes.trim();

    if (!name) return;

    const exists = items.some(
      (item) =>
        item.type === form.type && String(item.name || "").trim() === name
    );

    if (exists) {
      alert("هذه القيمة موجودة بالفعل");
      return;
    }

    setSaving(true);

    const localId = createLocalId();

    const payload = {
      type: form.type,
      name,
      notes,
      isActive: true,
    };

    try {
      if (!isOnline()) {
        addSettingToCache({
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "systemSettings",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة إعداد",
            name: payload.name,
          },
        });

        setForm((prev) => ({
          ...prev,
          name: "",
          notes: "",
        }));

        alert("تم حفظ الإعداد محليًا وسيتم رفعه عند عودة الاتصال");
        return;
      }

      await addDoc(collection(db, "systemSettings"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm((prev) => ({
        ...prev,
        name: "",
        notes: "",
      }));
    } catch (error) {
      console.error(error);

      addSettingToCache({
        id: localId,
        ...payload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "systemSettings",
        operation: "create",
        documentId: localId,
        payload: {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة إعداد",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ الإعداد محليًا وسيتم رفعه عند عودة الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    if (!canManage || saving) return;

    const allItems = [];

    Object.entries(DEFAULT_SYSTEM_SETTINGS).forEach(([type, values]) => {
      values.forEach((name) => {
        allItems.push({ type, name });
      });
    });

    setSaving(true);

    try {
      let createdCount = 0;

      for (const item of allItems) {
        const exists = items.some(
          (x) =>
            x.type === item.type &&
            String(x.name || "").trim() === String(item.name || "").trim()
        );

        if (exists) continue;

        const localId = createLocalId();

        const payload = {
          type: item.type,
          name: item.name,
          notes: "",
          isActive: true,
        };

        if (!isOnline()) {
          addSettingToCache({
            id: localId,
            ...payload,
            isOffline: true,
            syncStatus: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          addOfflineOperation({
            collectionName: "systemSettings",
            operation: "create",
            documentId: localId,
            payload: {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            meta: {
              label: "إضافة قيمة افتراضية",
              name: payload.name,
            },
          });
        } else {
          await addDoc(collection(db, "systemSettings"), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        createdCount += 1;
      }

      alert(
        createdCount
          ? `تم إنشاء ${createdCount} قيمة افتراضية`
          : "كل القيم الافتراضية موجودة بالفعل"
      );
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إنشاء القيم الافتراضية");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    if (!canManage) return;

    const payload = {
      isActive: !item.isActive,
    };

    updateSettingCache(item.id, payload);

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "systemSettings",
        operation: "update",
        documentId: item.id,
        payload: {
          ...payload,
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: payload.isActive ? "تفعيل إعداد" : "تعطيل إعداد",
          name: item.name || "",
        },
      });

      alert("تم حفظ التغيير محليًا وسيتم رفعه عند عودة الاتصال");
      return;
    }

    try {
      await updateDoc(doc(db, "systemSettings", item.id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "systemSettings",
        operation: "update",
        documentId: item.id,
        payload: {
          ...payload,
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: payload.isActive ? "تفعيل إعداد" : "تعطيل إعداد",
          name: item.name || "",
        },
      });

      alert("تعذر الاتصال، تم حفظ التغيير وسيتم رفعه عند عودة الاتصال");
    }
  };

  const remove = async (item) => {
    if (!canManage) return;

    if (!confirm("هل تريد حذف هذا الإعداد؟")) return;

    removeSettingFromCache(item.id);

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "systemSettings",
        operation: "delete",
        documentId: item.id,
        payload: {},
        meta: {
          label: "حذف إعداد",
          name: item.name || "",
        },
      });

      alert("تم حذف الإعداد محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "systemSettings", item.id));
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "systemSettings",
        operation: "delete",
        documentId: item.id,
        payload: {},
        meta: {
          label: "حذف إعداد",
          name: item.name || "",
        },
      });

      alert("تعذر الاتصال، تم حفظ الحذف وسيتم تنفيذه عند عودة الاتصال");
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إعدادات النظام">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الإعدادات..."
            subtitle="يتم تجهيز قوائم النظام"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="page-card p-5">
                <h3 className="text-lg font-black text-slate-900">
                  إضافة إعداد جديد
                </h3>

                <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                  استخدم هذه الصفحة لإدارة القوائم مثل المحاصيل، الجير، وحركات
                  الرشاش والورش الخارجية.
                </p>

                <form onSubmit={submit} className="mt-5 space-y-4">
                  <div>
                    <label className="form-label">نوع الإعداد</label>

                    <select
                      className="form-input"
                      value={form.type}
                      onChange={(e) => updateField("type", e.target.value)}
                    >
                      {SETTING_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">الاسم</label>

                    <input
                      className="form-input"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="مثال: دائري"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">ملاحظات</label>

                    <textarea
                      className="form-input min-h-[110px]"
                      value={form.notes}
                      onChange={(e) => updateField("notes", e.target.value)}
                      placeholder="ملاحظات اختيارية"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !canManage}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {saving ? "جاري الحفظ..." : "حفظ الإعداد"}
                  </button>

                  <button
                    type="button"
                    disabled={saving || !canManage}
                    onClick={seedDefaults}
                    className="btn-secondary w-full disabled:opacity-50"
                  >
                    إنشاء القيم الافتراضية
                  </button>

                  {canManage && (
  <button
    type="button"
    disabled={exportingBackup}
    onClick={exportBackup}
    className="btn-secondary w-full disabled:opacity-50"
  >
    {exportingBackup
      ? "جاري تصدير النسخة..."
      : "تصدير نسخة احتياطية JSON"}
  </button>
)}
                </form>
              </div>

              <div className="page-card overflow-x-auto p-5 lg:col-span-2">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {currentTypeLabel}
                    </h3>

                    <p className="mt-1 text-sm font-bold text-slate-400">
                      عدد العناصر: {filteredItems.length}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {SETTING_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => updateField("type", type.value)}
                        className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                          form.type === type.value
                            ? "bg-green-700 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-th">الاسم</th>
                      <th className="table-th">الحالة</th>
                      <th className="table-th">ملاحظات</th>
                      <th className="table-th">إجراءات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="table-td font-black text-slate-900">
                          <div className="flex flex-col gap-1">
                            <span>{item.name}</span>

                            {item.syncStatus === "pending" && (
                              <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                                قيد المزامنة
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="table-td">
                          <span
                            className={`badge ${
                              item.isActive
                                ? "bg-green-50 text-green-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.isActive ? "مفعل" : "غير مفعل"}
                          </span>
                        </td>

                        <td className="table-td">{item.notes || "-"}</td>

                        <td className="table-td">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleActive(item)}
                              disabled={!canManage}
                              className="btn-secondary !py-2 disabled:opacity-50"
                            >
                              {item.isActive ? "تعطيل" : "تفعيل"}
                            </button>

                            <button
                              type="button"
                              onClick={() => remove(item)}
                              disabled={!canManage}
                              className="btn-danger !py-2 disabled:opacity-50"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredItems.length === 0 && (
                      <tr>
                        <td className="table-td text-center" colSpan="4">
                          لا توجد إعدادات لهذا النوع
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

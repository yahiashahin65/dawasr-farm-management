import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
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

export default function SettingsPage() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: "sprinklerMovement",
    name: "",
    notes: "",
  });

  const loadData = async () => {
    const snap = await getDocs(
      query(collection(db, "systemSettings"), orderBy("createdAt", "desc"))
    );

    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    const run = async () => {
      setInitialLoading(true);

      try {
        await loadData();
      } finally {
        setInitialLoading(false);
      }
    };

    run();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => item.type === form.type);
  }, [items, form.type]);

  const currentTypeLabel =
    SETTING_TYPES.find((item) => item.value === form.type)?.label || "";

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!canManage || !form.name.trim()) return;

    setSaving(true);

    try {
      const exists = items.some(
        (item) =>
          item.type === form.type &&
          String(item.name || "").trim() === form.name.trim()
      );

      if (exists) {
        alert("هذه القيمة موجودة بالفعل");
        return;
      }

      await addDoc(collection(db, "systemSettings"), {
        type: form.type,
        name: form.name.trim(),
        notes: form.notes.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm((prev) => ({
        ...prev,
        name: "",
        notes: "",
      }));

      await loadData();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ الإعداد");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    if (!canManage) return;

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

        await addDoc(collection(db, "systemSettings"), {
          type: item.type,
          name: item.name,
          notes: "",
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        createdCount += 1;
      }

      await loadData();

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

    await updateDoc(doc(db, "systemSettings", item.id), {
      isActive: !item.isActive,
      updatedAt: serverTimestamp(),
    });

    await loadData();
  };

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف هذا الإعداد؟")) {
      await deleteDoc(doc(db, "systemSettings", id));
      await loadData();
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
                  onClick={seedDefaults}
                  disabled={saving || !canManage}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  إنشاء القيم الافتراضية
                </button>
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
                        {item.name}
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
                            onClick={() => remove(item.id)}
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
        )}
      </Layout>
    </ProtectedRoute>
  );
}

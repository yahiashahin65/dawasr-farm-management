import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
import {
  loadMultipleSettingOptions,
  DEFAULT_SYSTEM_SETTINGS,
} from "../../../lib/systemSettings";
import { addOfflineOperation, isOnline } from "../../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../../lib/realtimeCache";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";
import useUserRole from "../../../hooks/useUserRole";

const normalizeGear = (value) => {
  const text = String(value || "").replace(/\s/g, "");

  if (text.includes("10/11")) {
    if (text.includes("400")) return "10/11 (400)";
    if (text.includes("425")) return "10/11 (425)";
    return "10/11";
  }

  if (text.includes("5/6")) return "5/6 (350)";

  if (text.includes("1/1")) {
    if (text.includes("300")) return "1/1 (300)";
    if (text.includes("350")) return "1/1 (350)";
    if (text.includes("425")) return "1/1 (425)";
    return "1/1";
  }

  return value || "";
};

const getTowersValue = (data) =>
  data?.towersCount ??
  data?.towerCount ??
  data?.towersNumber ??
  data?.towers ??
  "";

const getHectareValue = (data) =>
  data?.hectareNumber ??
  data?.hectare ??
  data?.hectar ??
  data?.hiktar ??
  "";

const mergeCurrentValue = (options, value) => {
  if (!value) return options;
  return options.includes(value) ? options : [value, ...options];
};

const cleanList = (items = []) =>
  items.filter((item) => item.name && item.name.trim() !== "");

const getSprinklerFromCache = (sprinklerId) => {
  const cached = getCachedCollection("cache:sprinklers");
  return cached.find((item) => item.id === sprinklerId) || null;
};

const updateSprinklerCache = (sprinklerId, payload) => {
  const cached = getCachedCollection("cache:sprinklers");
  const exists = cached.some((item) => item.id === sprinklerId);

  const updatedItem = {
    id: sprinklerId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === sprinklerId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:sprinklers", next);
};

export default function EditSprinkler() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  const [farms, setFarms] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [items, setItems] = useState([]);

  const [settingOptions, setSettingOptions] = useState({
    sprinklerMovement: DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
    cropType: DEFAULT_SYSTEM_SETTINGS.cropType,
    gearType: DEFAULT_SYSTEM_SETTINGS.gearType,
  });

  const [form, setForm] = useState({
    name: "",
    farmName: "",
    machineName: "",
    gearName: "",
    cropType: "",
    movementType: "",
    towersCount: "",
    hectareNumber: "",
    workerId: "",
    workerName: "",
    imageUrl: "",
  });

  const fillForm = (data) => {
    setForm({
      name: data.name || data.sprinklerName || "",
      farmName: data.farmName || "",
      machineName: data.machineName || data.machine || "",
      gearName: normalizeGear(data.gearName || data.gear || ""),
      cropType: data.cropType || "",
      movementType: data.movementType || "",
      towersCount: getTowersValue(data),
      hectareNumber: getHectareValue(data),
      workerId: data.workerId || "",
      workerName: data.workerName || "",
      imageUrl: data.imageUrl || "",
    });
  };

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const cachedSprinkler = getSprinklerFromCache(id);

        if (cachedSprinkler) {
          fillForm(cachedSprinkler);

          setFarms(cleanList(getCachedCollection("cache:farms")));
          setWorkers(cleanList(getCachedCollection("cache:workers")));
          setItems(getCachedCollection("cache:sprinklers"));

          if (!isOnline()) {
            setSettingOptions({
              sprinklerMovement: DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
              cropType: DEFAULT_SYSTEM_SETTINGS.cropType,
              gearType: DEFAULT_SYSTEM_SETTINGS.gearType,
            });

            setOfflineNotice("يتم تعديل البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [
          sprinklerSnap,
          farmsSnap,
          workersSnap,
          sprinklersSnap,
          settings,
        ] = await Promise.all([
          getDoc(doc(db, "sprinklers", id)),
          getDocs(collection(db, "farms")),
          getDocs(collection(db, "workers")),
          getDocs(collection(db, "sprinklers")),
          loadMultipleSettingOptions([
            "sprinklerMovement",
            "cropType",
            "gearType",
          ]),
        ]);

        if (!sprinklerSnap.exists() && !cachedSprinkler) {
          alert("الرشاش غير موجود");
          router.push("/sprinklers");
          return;
        }

        if (sprinklerSnap.exists()) {
          fillForm(sprinklerSnap.data());
        }

        setFarms(
          farmsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((item) => item.name && item.name.trim() !== "")
        );

        setWorkers(
          workersSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((item) => item.name && item.name.trim() !== "")
        );

        setItems(
          sprinklersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setSettingOptions({
          sprinklerMovement:
            settings.sprinklerMovement ||
            DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
          cropType: settings.cropType || DEFAULT_SYSTEM_SETTINGS.cropType,
          gearType: settings.gearType || DEFAULT_SYSTEM_SETTINGS.gearType,
        });
      } catch (error) {
        console.error(error);

        const cachedSprinkler = getSprinklerFromCache(id);

        if (cachedSprinkler) {
          fillForm(cachedSprinkler);

          setFarms(cleanList(getCachedCollection("cache:farms")));
          setWorkers(cleanList(getCachedCollection("cache:workers")));
          setItems(getCachedCollection("cache:sprinklers"));

          setSettingOptions({
            sprinklerMovement: DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
            cropType: DEFAULT_SYSTEM_SETTINGS.cropType,
            gearType: DEFAULT_SYSTEM_SETTINGS.gearType,
          });

          setOfflineNotice("تعذر الاتصال، يتم تعديل آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات الرشاش");
          router.push("/sprinklers");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  const machineOptions = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.machineName || item.machine || "")
          .filter(Boolean)
      )
    );
  }, [items]);

  const gearOptions = useMemo(() => {
    return mergeCurrentValue(
      settingOptions.gearType || DEFAULT_SYSTEM_SETTINGS.gearType,
      form.gearName
    );
  }, [settingOptions.gearType, form.gearName]);

  const cropOptions = useMemo(() => {
    const baseOptions =
      settingOptions.cropType || DEFAULT_SYSTEM_SETTINGS.cropType;

    const oldValues = items.map((item) => item.cropType || "").filter(Boolean);

    return Array.from(
      new Set(mergeCurrentValue([...baseOptions, ...oldValues], form.cropType))
    );
  }, [items, settingOptions.cropType, form.cropType]);

  const movementOptions = useMemo(() => {
    return mergeCurrentValue(
      settingOptions.sprinklerMovement ||
        DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
      form.movementType
    );
  }, [settingOptions.sprinklerMovement, form.movementType]);

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const onWorkerChange = (workerId) => {
    const worker = workers.find((item) => item.id === workerId);

    setForm((prev) => ({
      ...prev,
      workerId,
      workerName: worker?.name || "",
    }));
  };

  const uploadImage = async (file) => {
    if (!file) return;

    if (!isOnline()) {
      alert("لا يمكن رفع الصورة أثناء عدم الاتصال");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload-media", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      const imageUrl =
        result.url ||
        result.imageUrl ||
        result.data?.url ||
        result.data?.imageUrl ||
        "";

      if (!imageUrl) {
        alert("لم يتم استلام رابط الصورة");
        return;
      }

      updateField("imageUrl", imageUrl);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء رفع الصورة");
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!canManage || saving) return;

    if (!form.name.trim()) {
      alert("اسم الرشاش مطلوب");
      return;
    }

    if (!form.farmName) {
      alert("المزرعة مطلوبة");
      return;
    }

    setSaving(true);

    const cleanedGearName = normalizeGear(form.gearName);

    const payload = {
      name: form.name.trim(),
      sprinklerName: form.name.trim(),
      farmName: form.farmName,
      machineName: form.machineName,
      gearName: cleanedGearName,
      cropType: form.cropType,
      movementType: form.movementType,
      towersCount: Number(form.towersCount || 0),
      hectareNumber: form.hectareNumber || "",
      workerId: form.workerId,
      workerName: form.workerName,
      imageUrl: form.imageUrl || "",
    };

    try {
      updateSprinklerCache(id, payload);

      if (!isOnline()) {
        addOfflineOperation({
          collectionName: "sprinklers",
          operation: "update",
          documentId: id,
          payload: {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "تعديل رشاش",
            name: payload.name,
          },
        });

        alert("تم حفظ التعديل محليًا وسيتم رفعه عند عودة الاتصال");
        router.push(`/sprinklers/${id}`);
        return;
      }

      await updateDoc(doc(db, "sprinklers", id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      router.push(`/sprinklers/${id}`);
    } catch (error) {
      console.error(error);

      updateSprinklerCache(id, payload);

      addOfflineOperation({
        collectionName: "sprinklers",
        operation: "update",
        documentId: id,
        payload: {
          ...payload,
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "تعديل رشاش",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ التعديل محليًا وسيتم رفعه عند عودة الاتصال");
      router.push(`/sprinklers/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل الرشاش">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات الرشاش..."
            subtitle="يتم تجهيز بيانات التعديل والإعدادات"
          />
        ) : (
          <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
            {offlineNotice && (
              <div className="page-card border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700 lg:col-span-3">
                {offlineNotice}
              </div>
            )}

            <div className="page-card p-5 lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">اسم الرشاش</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">المزرعة</label>
                  <select
                    className="form-input"
                    value={form.farmName}
                    onChange={(e) => updateField("farmName", e.target.value)}
                    required
                  >
                    <option value="">اختر المزرعة</option>

                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.name}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">المكينة</label>
                  <input
                    list="machine-options"
                    className="form-input"
                    value={form.machineName}
                    onChange={(e) => updateField("machineName", e.target.value)}
                  />

                  <datalist id="machine-options">
                    {machineOptions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="form-label">الجير</label>
                  <select
                    className="form-input"
                    value={form.gearName}
                    onChange={(e) => updateField("gearName", e.target.value)}
                  >
                    <option value="">اختر الجير</option>

                    {gearOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">نوع المحصول</label>
                  <select
                    className="form-input"
                    value={form.cropType}
                    onChange={(e) => updateField("cropType", e.target.value)}
                  >
                    <option value="">اختر نوع المحصول</option>

                    {cropOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">حركة الرشاش</label>
                  <select
                    className="form-input"
                    value={form.movementType}
                    onChange={(e) => updateField("movementType", e.target.value)}
                  >
                    <option value="">اختر الحركة</option>

                    {movementOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">عدد الأبراج</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={form.towersCount}
                    onChange={(e) => updateField("towersCount", e.target.value)}
                    placeholder="مثال: 8"
                  />
                </div>

                <div>
                  <label className="form-label">الهكتار</label>
                  <input
                    className="form-input"
                    value={form.hectareNumber}
                    onChange={(e) =>
                      updateField("hectareNumber", e.target.value)
                    }
                    placeholder="مثال: 12"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">العامل</label>

                  <select
                    className="form-input"
                    value={form.workerId}
                    onChange={(e) => onWorkerChange(e.target.value)}
                  >
                    <option value="">بدون عامل</option>

                    {workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="page-card p-5">
              <label className="form-label">صورة الرشاش</label>

              <div className="mt-2 rounded-3xl border border-dashed border-slate-300 p-4 text-center">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.name || "رشاش"}
                    className="mx-auto h-48 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl bg-slate-50 text-3xl font-black text-slate-300">
                    -
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  className="form-input mt-4"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                />

                {!isOnline() && (
                  <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
                    لا يمكن رفع الصورة أثناء عدم الاتصال. سيتم الاحتفاظ بالصورة
                    الحالية حتى تعود للاتصال.
                  </p>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !canManage}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/sprinklers")}
                  className="btn-secondary"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

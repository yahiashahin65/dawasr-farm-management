import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import {
  loadMultipleSettingOptions,
  DEFAULT_SYSTEM_SETTINGS,
} from "../../lib/systemSettings";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const addToSprinklersCache = (sprinkler) => {
  const cached = getCachedCollection("cache:sprinklers");
  setCachedCollection("cache:sprinklers", [sprinkler, ...cached]);
};

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

export default function AddSprinkler() {
  const router = useRouter();
  const { canManage, loadingRole } = useUserRole();

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [farms, setFarms] = useState([]);
  const [workers, setWorkers] = useState([]);

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

  useEffect(() => {
    if (!loadingRole && !canManage) {
      router.replace("/sprinklers");
    }
  }, [loadingRole, canManage, router]);

  useEffect(() => {
    if (loadingRole || !canManage) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const [farmsSnap, workersSnap, settings] = await Promise.all([
          getDocs(collection(db, "farms")),
          getDocs(collection(db, "workers")),
          loadMultipleSettingOptions([
            "sprinklerMovement",
            "cropType",
            "gearType",
          ]),
        ]);

        setFarms(farmsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setWorkers(workersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        setSettingOptions({
          sprinklerMovement:
            settings.sprinklerMovement ||
            DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
          cropType: settings.cropType || DEFAULT_SYSTEM_SETTINGS.cropType,
          gearType: settings.gearType || DEFAULT_SYSTEM_SETTINGS.gearType,
        });
      } catch {
        setFarms(getCachedCollection("cache:farms"));
        setWorkers(getCachedCollection("cache:workers"));

        setSettingOptions({
          sprinklerMovement: DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
          cropType: DEFAULT_SYSTEM_SETTINGS.cropType,
          gearType: DEFAULT_SYSTEM_SETTINGS.gearType,
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [loadingRole, canManage]);

  const machineOptions = useMemo(
    () => ["مكينة 1", "مكينة 2", "مكينة 3", "مكينة 4"],
    []
  );

  const gearOptions = useMemo(
    () => settingOptions.gearType || DEFAULT_SYSTEM_SETTINGS.gearType,
    [settingOptions.gearType]
  );

  const cropOptions = useMemo(
    () => settingOptions.cropType || DEFAULT_SYSTEM_SETTINGS.cropType,
    [settingOptions.cropType]
  );

  const movementOptions = useMemo(
    () =>
      settingOptions.sprinklerMovement ||
      DEFAULT_SYSTEM_SETTINGS.sprinklerMovement,
    [settingOptions.sprinklerMovement]
  );

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

    if (!canManage) return;
    if (saving) return;

    if (!form.name.trim()) {
      alert("اسم الرشاش مطلوب");
      return;
    }

    if (!form.farmName) {
      alert("المزرعة مطلوبة");
      return;
    }

    setSaving(true);

    try {
      const cleanedGearName = normalizeGear(form.gearName);
      const localId = createLocalId();

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

      if (!isOnline()) {
        const localSprinkler = {
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        addToSprinklersCache(localSprinkler);

        addOfflineOperation({
          collectionName: "sprinklers",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة رشاش",
            name: payload.name,
          },
        });

        alert("تم حفظ الرشاش محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/sprinklers");
        return;
      }

      const docRef = await addDoc(collection(db, "sprinklers"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/sprinklers/${docRef.id}`);
    } catch (error) {
      console.error(error);

      const cleanedGearName = normalizeGear(form.gearName);
      const localId = createLocalId();

      const fallbackPayload = {
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

      addToSprinklersCache({
        id: localId,
        ...fallbackPayload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "sprinklers",
        operation: "create",
        documentId: localId,
        payload: {
          ...fallbackPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة رشاش",
          name: fallbackPayload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ الرشاش محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/sprinklers");
    } finally {
      setSaving(false);
    }
  };

  if (loadingRole || !canManage) {
    return (
      <ProtectedRoute>
        <Layout title="إضافة رشاش">
          <AppLoader
            variant="compact"
            title="جاري التحقق من الصلاحيات..."
            subtitle="يتم التأكد من صلاحية إضافة رشاش"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="إضافة رشاش">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تجهيز صفحة الإضافة..."
            subtitle="يتم تحميل المزارع والعمال والإعدادات"
          />
        ) : (
          <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
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
                    لا يمكن رفع الصورة أثناء عدم الاتصال. يمكن إضافة الرشاش الآن
                    ورفع الصورة لاحقًا.
                  </p>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !canManage}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? "جاري الإضافة..." : "إضافة الرشاش"}
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

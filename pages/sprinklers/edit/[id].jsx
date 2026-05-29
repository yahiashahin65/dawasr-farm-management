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

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";
import useUserRole from "../../../hooks/useUserRole";

const MOVEMENT_OPTIONS = [
  "دائري",
  "نصف دائري",
  "ثلاث أرباع دائري",
  "نصين",
];

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

export default function EditSprinkler() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [farms, setFarms] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [items, setItems] = useState([]);

  const [form, setForm] = useState({
    name: "",
    farmName: "",
    machineName: "",
    gearName: "",
    cropType: "",
    movementType: "",
    towersCount: "",
    workerId: "",
    workerName: "",
    imageUrl: "",
  });

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const [sprinklerSnap, farmsSnap, workersSnap, sprinklersSnap] =
          await Promise.all([
            getDoc(doc(db, "sprinklers", id)),
            getDocs(collection(db, "farms")),
            getDocs(collection(db, "workers")),
            getDocs(collection(db, "sprinklers")),
          ]);

        if (!sprinklerSnap.exists()) {
          alert("الرشاش غير موجود");
          router.push("/sprinklers");
          return;
        }

        const data = sprinklerSnap.data();

        setForm({
          name: data.name || data.sprinklerName || "",
          farmName: data.farmName || "",
          machineName: data.machineName || data.machine || "",
          gearName: normalizeGear(data.gearName || data.gear || ""),
          cropType: data.cropType || "",
          movementType: data.movementType || "",
          towersCount: getTowersValue(data),
          workerId: data.workerId || "",
          workerName: data.workerName || "",
          imageUrl: data.imageUrl || "",
        });

        setFarms(
          farmsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setWorkers(
          workersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setItems(
          sprinklersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
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

  const gearOptions = useMemo(
    () => [
      "1/1",
      "1/1 (300)",
      "1/1 (350)",
      "1/1 (425)",
      "10/11",
      "10/11 (400)",
      "10/11 (425)",
      "5/6 (350)",
    ],
    []
  );

  const cropOptions = useMemo(() => {
    const defaults = ["برسيم", "رودس", "ذرة", "قمح", "شعير", "غير محدد"];

    return Array.from(
      new Set([
        ...defaults,
        ...items.map((item) => item.cropType || "").filter(Boolean),
      ])
    );
  }, [items]);

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

    setSaving(true);

    try {
      const cleanedGearName = normalizeGear(form.gearName);

      await updateDoc(doc(db, "sprinklers", id), {
        name: form.name,
        sprinklerName: form.name,
        farmName: form.farmName,
        machineName: form.machineName,
        gearName: cleanedGearName,
        cropType: form.cropType,
        movementType: form.movementType,
        towersCount: Number(form.towersCount || 0),
        workerId: form.workerId,
        workerName: form.workerName,
        imageUrl: form.imageUrl || "",
        updatedAt: serverTimestamp(),
      });

      router.push(`/sprinklers/${id}`);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ البيانات");
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
            subtitle="يتم تجهيز بيانات التعديل"
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
                  <input
                    list="crop-options"
                    className="form-input"
                    value={form.cropType}
                    onChange={(e) => updateField("cropType", e.target.value)}
                  />

                  <datalist id="crop-options">
                    {cropOptions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="form-label">حركة الرشاش</label>
                  <select
                    className="form-input"
                    value={form.movementType}
                    onChange={(e) => updateField("movementType", e.target.value)}
                  >
                    <option value="">اختر الحركة</option>
                    {MOVEMENT_OPTIONS.map((item) => (
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

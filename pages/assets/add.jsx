import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const statuses = ["صالح", "عاطل", "في الورشة"];

const categories = [
  { value: "asset", label: "معدة" },
  { value: "spare_part", label: "قطعة غيار" },
  { value: "tool", label: "أداة" },
  { value: "material", label: "مواد" },
];

export default function AddAsset() {
  const router = useRouter();

  const [workers, setWorkers] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [types, setTypes] = useState([]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    category: "asset",
    assetTypeId: "",
    status: "صالح",
    placeType: "farm",
    placeId: "",
    externalWorkshopName: "",
    workerIds: [],
    notes: "",
  });

  useEffect(() => {
    const loadData = async () => {
      const [workersSnap, farmsSnap, kubrasSnap, typesSnap] =
        await Promise.all([
          getDocs(collection(db, "workers")),
          getDocs(collection(db, "farms")),
          getDocs(collection(db, "kubras")),
          getDocs(collection(db, "assetTypes")),
        ]);

      const clean = (snap) =>
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((item) => item.name && item.name.trim() !== "");

      setWorkers(clean(workersSnap));
      setFarms(clean(farmsSnap));
      setKubras(clean(kubrasSnap));
      setTypes(clean(typesSnap));
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(image);
    setImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);

  const places = useMemo(() => {
    if (form.placeType === "farm") return farms;
    if (form.placeType === "kubra") return kubras;
    return [];
  }, [form.placeType, farms, kubras]);

  const toggleWorker = (id) => {
    setForm((prev) => ({
      ...prev,
      workerIds: prev.workerIds.includes(id)
        ? prev.workerIds.filter((x) => x !== id)
        : [...prev.workerIds, id],
    }));
  };

  const uploadImage = async () => {
    if (!image) return "";

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !preset) {
      throw new Error("Cloudinary environment variables are missing");
    }

    const data = new FormData();
    data.append("file", image);
    data.append("upload_preset", preset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: data,
      }
    );

    const json = await res.json();

    if (!res.ok || !json.secure_url) {
      throw new Error(json?.error?.message || "Upload failed");
    }

    return json.secure_url;
  };

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const isExternalWorkshop = form.placeType === "external_workshop";

    if (!form.name.trim() || !form.assetTypeId) {
      alert("اسم الأصل ونوع الأصل مطلوبين");
      return;
    }

    if (!isExternalWorkshop && !form.placeId) {
      alert("مكان الأصل مطلوب");
      return;
    }

    if (isExternalWorkshop && !form.externalWorkshopName.trim()) {
      alert("اسم الورشة الخارجية مطلوب");
      return;
    }

    setLoading(true);

    try {
      const place = isExternalWorkshop
        ? null
        : places.find((f) => f.id === form.placeId);

      const placeId = isExternalWorkshop ? "" : form.placeId;
      const placeName = isExternalWorkshop
        ? form.externalWorkshopName.trim()
        : place?.name || "";

      const type = types.find((t) => t.id === form.assetTypeId);
      const selectedWorkers = workers.filter((w) =>
        form.workerIds.includes(w.id)
      );

      const imageUrl = await uploadImage();

      const assetRef = doc(collection(db, "assets"));
      const movementRef = doc(collection(db, "assetMovements"));

      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),

        category: form.category,

        assetTypeId: form.assetTypeId,
        assetTypeName: type?.name || "",

        status:
          form.placeType === "external_workshop" ? "في الورشة" : form.status,

        placeType: form.placeType,
        placeId,
        placeName,

        currentPlace: {
          type: form.placeType,
          id: placeId,
          name: placeName,
        },

        farmId: form.placeType === "farm" ? form.placeId : "",
        farmName: form.placeType === "farm" ? placeName : "",

        kubraId: form.placeType === "kubra" ? form.placeId : "",
        kubraName: form.placeType === "kubra" ? placeName : "",

        externalWorkshopName:
          form.placeType === "external_workshop" ? placeName : "",

        workerIds: form.workerIds,
        workers: selectedWorkers.map((w) => ({
          id: w.id,
          name: w.name,
          phone: w.phone || "",
        })),
        workerNames: selectedWorkers.map((w) => w.name).join("، "),

        imageUrl,
        notes: form.notes.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);

      batch.set(assetRef, payload);

      batch.set(movementRef, {
        assetId: assetRef.id,
        assetName: form.name.trim(),

        movementType: "created",

        fromPlaceType: "",
        fromPlaceName: "",

        toPlaceType: form.placeType,
        toPlaceId: placeId,
        toPlaceName: placeName,

        status: payload.status,
        category: form.category,

        reason: "تسجيل أول مكان للأصل",
        notes: form.notes.trim(),

        movedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      router.push("/assets");
    } catch (error) {
      console.error(error);
      alert(error.message || "حدث خطأ أثناء الحفظ");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة أصل">
        <form onSubmit={submit} className="page-card max-w-5xl p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <select
              className="form-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              value={form.assetTypeId}
              onChange={(e) =>
                setForm({ ...form, assetTypeId: e.target.value })
              }
            >
              <option value="">اختر النوع</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="اسم الأصل، مثال: مكينة 605 أو دينمو"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="form-input"
              placeholder="كود أو رقم اختياري"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <select
              className="form-input"
              value={form.placeType}
              onChange={(e) =>
                setForm({
                  ...form,
                  placeType: e.target.value,
                  placeId: "",
                  externalWorkshopName: "",
                  status:
                    e.target.value === "external_workshop"
                      ? "في الورشة"
                      : form.status === "في الورشة"
                      ? "صالح"
                      : form.status,
                })
              }
            >
              <option value="farm">داخل مزرعة</option>
              <option value="kubra">داخل الكِبرة</option>
              <option value="external_workshop">ورشة خارجية</option>
            </select>

            {form.placeType === "external_workshop" ? (
              <input
                className="form-input"
                placeholder="اسم الورشة الخارجية"
                value={form.externalWorkshopName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    externalWorkshopName: e.target.value,
                    status: "في الورشة",
                  })
                }
              />
            ) : (
              <select
                className="form-input"
                value={form.placeId}
                onChange={(e) => setForm({ ...form, placeId: e.target.value })}
              >
                <option value="">
                  اختر {form.placeType === "farm" ? "المزرعة" : "الكِبرة"}
                </option>
                {places.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="form-input"
              value={form.status}
              disabled={form.placeType === "external_workshop"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {statuses.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              العمال المستلمون، يمكن اختيار أكثر من عامل
            </label>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {workers.map((w) => (
                <label
                  key={w.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold ${
                    form.workerIds.includes(w.id)
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.workerIds.includes(w.id)}
                    onChange={() => toggleWorker(w.id)}
                  />
                  {w.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                تصوير بالكاميرا
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </label>

              <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                رفع من الجهاز
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {imagePreview && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={imagePreview}
                  alt="معاينة الصورة"
                  className="max-h-72 w-full rounded-2xl object-contain"
                />

                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => setImage(null)}
                >
                  حذف الصورة المختارة
                </button>
              </div>
            )}
          </div>

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ الأصل"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const statuses = ["صالح", "عاطل", "تالف"];

export default function AddAsset() {
  const router = useRouter();

  const [workers, setWorkers] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [types, setTypes] = useState([]);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    assetTypeId: "",
    status: "صالح",
    placeType: "farm",
    placeId: "",
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

  const places = useMemo(() => {
    return form.placeType === "farm" ? farms : kubras;
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

    if (!form.name.trim() || !form.assetTypeId || !form.placeId) {
      alert("اسم المعدة ونوع المعدة ومكان المعدة مطلوبين");
      return;
    }

    setLoading(true);

    try {
      const place = places.find((f) => f.id === form.placeId);
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
        assetTypeId: form.assetTypeId,
        assetTypeName: type?.name || "",
        status: form.status,

        placeType: form.placeType,
        placeId: form.placeId,
        placeName: place?.name || "",

        currentPlace: {
          type: form.placeType,
          id: form.placeId,
          name: place?.name || "",
        },

        farmId: form.placeType === "farm" ? form.placeId : "",
        farmName: form.placeType === "farm" ? place?.name || "" : "",

        kubraId: form.placeType === "kubra" ? form.placeId : "",
        kubraName: form.placeType === "kubra" ? place?.name || "" : "",

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

        fromPlaceType: "",
        fromPlaceName: "",

        toPlaceType: form.placeType,
        toPlaceId: form.placeId,
        toPlaceName: place?.name || "",

        reason: "تسجيل أول مكان للمعدة",
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
      <Layout title="إضافة معدة">
        <form onSubmit={submit} className="page-card max-w-5xl p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <select
              className="form-input"
              value={form.assetTypeId}
              onChange={(e) =>
                setForm({ ...form, assetTypeId: e.target.value })
              }
            >
              <option value="">اختر نوع المعدة</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="اسم المعدة فقط، مثال: مكينة 605"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="form-input"
              placeholder="كود أو رقم المعدة اختياري"
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
                })
              }
            >
              <option value="farm">داخل مزرعة</option>
              <option value="kubra">داخل الكِبرة</option>
            </select>

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

            <select
              className="form-input"
              value={form.status}
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
              العمال المستلمون للمعدة، يمكن اختيار أكثر من عامل
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

          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="form-input"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ المعدة"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
                  }

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { fileToFirestoreImage } from "../../lib/imageToFirestore";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function AddHeapPage() {
  const router = useRouter();

  const [farms, setFarms] = useState([]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    pileName: "",
    farmId: "",
    sprinklerName: "",
    bricksCount: "",
    notes: "",
  });

  useEffect(() => {
    const loadFarms = async () => {
      const farmsSnap = await getDocs(collection(db, "farms"));

      const cleanFarms = farmsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.name && item.name.trim() !== "");

      setFarms(cleanFarms);
    };

    loadFarms();
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

  const uploadImage = async () => {
    if (!image) return "";
    return fileToFirestoreImage(image);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.pileName.trim()) {
      alert("اسم الكوم مطلوب");
      return;
    }

    if (!form.farmId) {
      alert("المزرعة مطلوبة");
      return;
    }

    if (!form.sprinklerName.trim()) {
      alert("مكان أو رقم الرشاش مطلوب");
      return;
    }

    if (!form.bricksCount || Number(form.bricksCount) <= 0) {
      alert("عدد اللبن مطلوب");
      return;
    }

    setLoading(true);

    try {
      const selectedFarm = farms.find((farm) => farm.id === form.farmId);
      const imageUrl = await uploadImage();

      await addDoc(collection(db, "heaps"), {
        pileName: form.pileName.trim(),

        farmId: form.farmId,
        farmName: selectedFarm?.name || "",

        sprinklerName: form.sprinklerName.trim(),
        bricksCount: Number(form.bricksCount || 0),

        imageUrl,
        notes: form.notes.trim(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/heaps");
    } catch (error) {
      console.error(error);
      alert(error.message || "حدث خطأ أثناء حفظ الكوم");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة كوم">
        <form onSubmit={submit} className="page-card max-w-5xl p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="form-input"
              placeholder="اسم الكوم، مثال: كوم 1"
              value={form.pileName}
              onChange={(e) => setForm({ ...form, pileName: e.target.value })}
            />

            <select
              className="form-input"
              value={form.farmId}
              onChange={(e) => setForm({ ...form, farmId: e.target.value })}
            >
              <option value="">اختر المزرعة</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="مكان/رقم الرشاش، مثال: رشاش 18"
              value={form.sprinklerName}
              onChange={(e) =>
                setForm({ ...form, sprinklerName: e.target.value })
              }
            />

            <input
              className="form-input"
              type="number"
              placeholder="عدد اللبن، مثال: 2000"
              value={form.bricksCount}
              onChange={(e) =>
                setForm({ ...form, bricksCount: e.target.value })
              }
            />
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
                  alt="معاينة صورة الكوم"
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
            {loading ? "جاري الحفظ..." : "حفظ الكوم"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

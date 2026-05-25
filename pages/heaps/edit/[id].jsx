import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { fileToFirestoreImage } from "../../../lib/imageToFirestore";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";

export default function EditHeapPage() {
  const router = useRouter();
  const { id } = router.query;

  const [farms, setFarms] = useState([]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [form, setForm] = useState({
    pileName: "",
    farmId: "",
    farmName: "",
    sprinklerName: "",
    bricksCount: "",
    imageUrl: "",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    if (!id) return;

    const fetchHeap = async () => {
      try {
        const heapRef = doc(db, "heaps", id);
        const heapSnap = await getDoc(heapRef);

        if (heapSnap.exists()) {
          const data = heapSnap.data();

          setForm({
            pileName: data.pileName || "",
            farmId: data.farmId || "",
            farmName: data.farmName || "",
            sprinklerName: data.sprinklerName || "",
            bricksCount: data.bricksCount || "",
            imageUrl: data.imageUrl || "",
            notes: data.notes || "",
          });
        } else {
          alert("الكوم غير موجود");
          router.push("/heaps");
        }
      } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء تحميل بيانات الكوم");
      } finally {
        setLoading(false);
      }
    };

    fetchHeap();
  }, [id, router]);

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
    if (!image) return form.imageUrl || "";
    return fileToFirestoreImage(image);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;

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

    setSaving(true);

    try {
      const selectedFarm = farms.find((farm) => farm.id === form.farmId);
      const imageUrl = await uploadImage();

      const heapRef = doc(db, "heaps", id);

      await updateDoc(heapRef, {
        pileName: form.pileName.trim(),

        farmId: form.farmId,
        farmName: selectedFarm?.name || form.farmName || "",

        sprinklerName: form.sprinklerName.trim(),
        bricksCount: Number(form.bricksCount || 0),

        imageUrl,
        notes: form.notes.trim(),

        updatedAt: serverTimestamp(),
      });

      router.push("/heaps");
    } catch (error) {
      console.error(error);
      alert(error.message || "حدث خطأ أثناء تعديل الكوم");
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل الكوم">
        {loading ? (
          <div className="page-card p-5">جاري تحميل البيانات...</div>
        ) : (
          <form onSubmit={handleSubmit} className="page-card max-w-5xl p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="form-input"
                placeholder="اسم الكوم"
                value={form.pileName}
                onChange={(e) =>
                  setForm({ ...form, pileName: e.target.value })
                }
              />

              <select
                className="form-input"
                value={form.farmId}
                onChange={(e) =>
                  setForm({ ...form, farmId: e.target.value })
                }
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
                placeholder="عدد اللبن"
                value={form.bricksCount}
                onChange={(e) =>
                  setForm({ ...form, bricksCount: e.target.value })
                }
              />
            </div>

            <div className="space-y-3">
              {form.imageUrl && !imagePreview && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                  <img
                    src={form.imageUrl}
                    alt="صورة الكوم الحالية"
                    className="max-h-72 w-full rounded-2xl object-contain"
                  />
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                  تصوير صورة جديدة
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setImage(e.target.files?.[0] || null)}
                  />
                </label>

                <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                  رفع صورة جديدة من الجهاز
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
                    alt="معاينة الصورة الجديدة"
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

            <button disabled={saving} className="btn-primary">
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

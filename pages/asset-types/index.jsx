import { useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function AddAssetType() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const notes = form.notes.trim();

    if (!name) {
      alert("اكتب اسم نوع المعدة");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "assetTypes"), {
        name,
        notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/asset-types");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ نوع المعدة");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة نوع معدة">
        <form
          onSubmit={submit}
          className="page-card max-w-2xl p-5 space-y-4"
          dir="rtl"
        >
          <input
            className="form-input"
            placeholder="اسم نوع المعدة، مثال: مكينة"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
          />

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات اختيارية"
            value={form.notes}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                notes: e.target.value,
              }))
            }
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ نوع المعدة"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

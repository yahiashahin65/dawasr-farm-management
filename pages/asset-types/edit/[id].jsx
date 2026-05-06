import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";

export default function EditAssetType() {
  const router = useRouter();
  const { id } = router.query;
  const [form, setForm] = useState({ name: "", notes: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "assetTypes", id)).then((snapshot) => {
      if (snapshot.exists()) {
        setForm({ name: snapshot.data().name || "", notes: snapshot.data().notes || "" });
      }
    });
  }, [id]);

  const submit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const notes = form.notes.trim();

    if (!name) {
      alert("اكتب اسم نوع المعدة");
      return;
    }

    setLoading(true);

    try {
      await updateDoc(doc(db, "assetTypes", id), {
        name,
        notes,
        updatedAt: serverTimestamp(),
      });

      const linkedAssets = await getDocs(query(collection(db, "assets"), where("assetTypeId", "==", id)));
      await Promise.all(
        linkedAssets.docs.map((assetDoc) =>
          updateDoc(doc(db, "assets", assetDoc.id), {
            assetTypeName: name,
            updatedAt: serverTimestamp(),
          })
        )
      );

      router.push("/asset-types");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء تحديث نوع المعدة");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل نوع معدة">
        <form onSubmit={submit} className="page-card max-w-2xl space-y-4 p-5">
          <input
            className="form-input"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
          <button disabled={loading} className="btn-primary">
            {loading ? "جاري التحديث..." : "تحديث النوع"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

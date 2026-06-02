import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";
import { getCachedCollection, setCachedCollection } from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const createLocalId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const addAccountantToCache = (accountant) => setCachedCollection("cache:accountants", [accountant, ...getCachedCollection("cache:accountants")]);

export default function AddAccountant() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!form.name.trim()) return alert("اسم المحاسب مطلوب");
    setLoading(true);
    const localId = createLocalId();
    const payload = { name: form.name.trim(), phone: form.phone.trim(), notes: form.notes.trim() };
    try {
      if (!isOnline()) {
        addAccountantToCache({ id: localId, ...payload, isOffline: true, syncStatus: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        addOfflineOperation({ collectionName: "accountants", operation: "create", documentId: localId, payload: { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, meta: { label: "إضافة محاسب", name: payload.name } });
        alert("تم حفظ المحاسب محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/accountants");
        return;
      }
      await addDoc(collection(db, "accountants"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      router.push("/accountants");
    } catch (error) {
      console.error(error);
      alert("تعذر حفظ المحاسب");
    } finally { setLoading(false); }
  };

  return <ProtectedRoute><Layout title="إضافة محاسب"><form onSubmit={submit} className="page-card max-w-2xl space-y-4 p-5"><input className="form-input" placeholder="اسم المحاسب" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input className="form-input" placeholder="رقم الجوال" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><button disabled={loading} className="btn-primary">{loading ? "جاري الحفظ..." : "حفظ"}</button></form></Layout></ProtectedRoute>;
}

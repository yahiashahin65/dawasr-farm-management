import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";

export default function EditAccountant() {
  const router = useRouter();
  const { id } = router.query;
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!id) return; (async () => { const snap = await getDoc(doc(db, "accountants", id)); if (snap.exists()) { const data = snap.data(); setForm({ name: data.name || "", phone: data.phone || "", notes: data.notes || "" }); } setLoading(false); })(); }, [id]);
  const submit = async (e) => { e.preventDefault(); if (!form.name.trim()) return alert("اسم المحاسب مطلوب"); setSaving(true); try { await updateDoc(doc(db, "accountants", id), { name: form.name.trim(), phone: form.phone.trim(), notes: form.notes.trim(), updatedAt: serverTimestamp() }); router.push("/accountants"); } catch (error) { console.error(error); alert("تعذر حفظ التعديل"); } finally { setSaving(false); } };
  return <ProtectedRoute><Layout title="تعديل محاسب">{loading ? <AppLoader variant="compact" title="جاري التحميل..." /> : <form onSubmit={submit} className="page-card max-w-2xl space-y-4 p-5"><input className="form-input" placeholder="اسم المحاسب" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input className="form-input" placeholder="رقم الجوال" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><button disabled={saving} className="btn-primary">{saving ? "جاري الحفظ..." : "حفظ التعديل"}</button></form>}</Layout></ProtectedRoute>;
}

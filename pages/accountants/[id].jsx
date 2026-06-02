import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

export default function AccountantDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!id) return; (async () => { const snap = await getDoc(doc(db, "accountants", id)); setItem(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); })(); }, [id]);
  return <ProtectedRoute><Layout title="تفاصيل محاسب">{loading ? <AppLoader variant="compact" title="جاري التحميل..." /> : !item ? <div className="page-card p-5 text-center font-bold text-slate-500">المحاسب غير موجود</div> : <div className="page-card max-w-2xl p-5"><h2 className="text-2xl font-black">{item.name}</h2><div className="mt-4 grid gap-3"><p><b>الجوال:</b> {item.phone || "-"}</p><p><b>ملاحظات:</b> {item.notes || "-"}</p></div></div>}</Layout></ProtectedRoute>;
}

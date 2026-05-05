import { useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
export default function AddAssetType(){const router=useRouter(); const [form,setForm]=useState({name:"",notes:""}); const [loading,setLoading]=useState(false); const submit=async(e)=>{e.preventDefault(); if(!form.name.trim())return alert("اسم نوع المعدة مطلوب"); setLoading(true); await addDoc(collection(db,"assetTypes"),{name:form.name.trim(),notes:form.notes,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); router.push("/asset-types");}; return <ProtectedRoute><Layout title="إضافة نوع معدة"><form onSubmit={submit} className="page-card max-w-2xl space-y-4 p-5"><input className="form-input" placeholder="مثال: مكينة، سيارة، رشاش، جرار" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><textarea className="form-input h-28" placeholder="ملاحظات اختيارية" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button disabled={loading} className="btn-primary">{loading?"جاري الحفظ...":"حفظ النوع"}</button></form></Layout></ProtectedRoute>}

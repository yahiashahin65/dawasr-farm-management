import { useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function AddWorker(){
 const router=useRouter(); const [form,setForm]=useState({name:"",phone:"",nationality:"",notes:""}); const [loading,setLoading]=useState(false);
 const submit=async(e)=>{e.preventDefault(); if(!form.name) return alert("اسم العامل مطلوب"); setLoading(true); await addDoc(collection(db,"workers"),{...form,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); router.push("/workers");};
 return <ProtectedRoute><Layout title="إضافة عامل"><form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4"><input className="form-input" placeholder="اسم العامل" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><div className="grid gap-4 md:grid-cols-2"><input className="form-input" placeholder="رقم الجوال" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input className="form-input" placeholder="الجنسية" value={form.nationality} onChange={e=>setForm({...form,nationality:e.target.value})}/></div><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button disabled={loading} className="btn-primary">{loading?"جاري الحفظ...":"حفظ العامل"}</button></form></Layout></ProtectedRoute>;
}

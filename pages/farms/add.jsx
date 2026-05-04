import { useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function AddFarm(){
 const router=useRouter(); const [form,setForm]=useState({name:"",managerName:"",managerPhone:"",notes:""}); const [loading,setLoading]=useState(false);
 const submit=async(e)=>{e.preventDefault(); if(!form.name) return alert("اسم المزرعة مطلوب"); setLoading(true); await addDoc(collection(db,"farms"),{...form,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); router.push("/farms");};
 return <ProtectedRoute><Layout title="إضافة مزرعة"><form onSubmit={submit} className="page-card max-w-3xl p-5 space-y-4"><input className="form-input" placeholder="اسم المزرعة" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><div className="grid gap-4 md:grid-cols-2"><input className="form-input" placeholder="مسئول المزرعة" value={form.managerName} onChange={e=>setForm({...form,managerName:e.target.value})}/><input className="form-input" placeholder="جوال مسئول المزرعة" value={form.managerPhone} onChange={e=>setForm({...form,managerPhone:e.target.value})}/></div><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button disabled={loading} className="btn-primary">{loading?"جاري الحفظ...":"حفظ المزرعة"}</button></form></Layout></ProtectedRoute>;
}

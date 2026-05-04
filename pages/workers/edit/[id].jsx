import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";

export default function EditWorker(){
 const router=useRouter(); const {id}=router.query; const [form,setForm]=useState({name:"",phone:"",nationality:"",notes:""}); const [loading,setLoading]=useState(false);
 useEffect(()=>{ if(!id)return; getDoc(doc(db,"workers",id)).then(s=>{ if(s.exists()) setForm({name:s.data().name||"",phone:s.data().phone||"",nationality:s.data().nationality||"",notes:s.data().notes||""}); });},[id]);
 const submit=async(e)=>{e.preventDefault(); setLoading(true); await updateDoc(doc(db,"workers",id),{...form,updatedAt:serverTimestamp()}); router.push("/workers");};
 return <ProtectedRoute><Layout title="تعديل بيانات عامل"><form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4"><input className="form-input" placeholder="اسم العامل" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><div className="grid gap-4 md:grid-cols-2"><input className="form-input" placeholder="رقم الجوال" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input className="form-input" placeholder="الجنسية" value={form.nationality} onChange={e=>setForm({...form,nationality:e.target.value})}/></div><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button disabled={loading} className="btn-primary">{loading?"جاري التعديل...":"حفظ التعديلات"}</button></form></Layout></ProtectedRoute>;
}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";

export default function EditFarm(){
 const router=useRouter(); const {id}=router.query; const [form,setForm]=useState({name:"",managerName:"",managerPhone:"",notes:""}); const [loading,setLoading]=useState(false);
 useEffect(()=>{if(!id)return; getDoc(doc(db,"farms",id)).then(s=>{if(s.exists()) setForm({...form,...s.data()});});},[id]);
 const submit=async(e)=>{e.preventDefault(); setLoading(true); await updateDoc(doc(db,"farms",id),{...form,updatedAt:serverTimestamp()}); router.push("/farms");};
 return <ProtectedRoute><Layout title="تعديل مزرعة"><form onSubmit={submit} className="page-card max-w-3xl p-5 space-y-4"><input className="form-input" placeholder="اسم المزرعة" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><div className="grid gap-4 md:grid-cols-2"><input className="form-input" placeholder="مسئول المزرعة" value={form.managerName||""} onChange={e=>setForm({...form,managerName:e.target.value})}/><input className="form-input" placeholder="جوال مسئول المزرعة" value={form.managerPhone||""} onChange={e=>setForm({...form,managerPhone:e.target.value})}/></div><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/><button disabled={loading} className="btn-primary">{loading?"جاري الحفظ...":"حفظ التعديلات"}</button></form></Layout></ProtectedRoute>;
}

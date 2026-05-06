import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
export default function EditEngineer(){const router=useRouter(); const {id}=router.query; const [form,setForm]=useState({name:"",phone:"",notes:""}); useEffect(()=>{if(id)getDoc(doc(db,"engineers",id)).then(s=>s.exists()&&setForm({...form,...s.data()}));},[id]); const submit=async(e)=>{e.preventDefault(); if(!form.name)return alert("اسم المهندس مطلوب"); await updateDoc(doc(db,"engineers",id),{...form,updatedAt:serverTimestamp()}); router.push("/engineers");}; return <ProtectedRoute><Layout title="تعديل مهندس"><form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4"><input className="form-input" placeholder="اسم المهندس" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input className="form-input" placeholder="رقم الجوال" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="btn-primary">تحديث</button></form></Layout></ProtectedRoute>}

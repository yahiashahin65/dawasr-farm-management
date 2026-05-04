import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
export default function EditKubra(){const router=useRouter(); const {id}=router.query; const [form,setForm]=useState({name:"",notes:""}); useEffect(()=>{if(id)getDoc(doc(db,"kubras",id)).then(s=>s.exists()&&setForm({...form,...s.data()}));},[id]); const submit=async(e)=>{e.preventDefault(); if(!form.name)return alert("اسم الكِبرة مطلوب"); await updateDoc(doc(db,"kubras",id),{...form,updatedAt:serverTimestamp()}); router.push("/kubras");}; return <ProtectedRoute><Layout title="تعديل كِبرة"><form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4"><input className="form-input" placeholder="اسم الكِبرة" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="btn-primary">تحديث</button></form></Layout></ProtectedRoute>}

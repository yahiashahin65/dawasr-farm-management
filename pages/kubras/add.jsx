import { useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
export default function AddKubra(){const router=useRouter(); const [form,setForm]=useState({name:"",notes:""}); const submit=async(e)=>{e.preventDefault(); if(!form.name)return alert("اسم الكِبرة مطلوب"); await addDoc(collection(db,"kubras"),{...form,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); router.push("/kubras");}; return <ProtectedRoute><Layout title="إضافة كِبرة"><form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4"><input className="form-input" placeholder="اسم الكِبرة" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><textarea className="form-input h-28" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="btn-primary">حفظ</button></form></Layout></ProtectedRoute>}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function WorkerDetails(){
 const router=useRouter(); const {id}=router.query; const [worker,setWorker]=useState(null); const [assets,setAssets]=useState([]);
 useEffect(()=>{ if(!id)return; const load=async()=>{const s=await getDoc(doc(db,"workers",id)); if(s.exists()) setWorker({id:s.id,...s.data()}); const a=await getDocs(query(collection(db,"assets"),where("workerId","==",id))); setAssets(a.docs.map(d=>({id:d.id,...d.data()})));}; load();},[id]);
 return <ProtectedRoute><Layout title="تفاصيل العامل"><div className="grid gap-5 lg:grid-cols-3"><div className="page-card p-5"><h3 className="text-lg font-black text-gray-900">{worker?.name||"..."}</h3><p className="mt-3 text-sm text-gray-600">الجوال: {worker?.phone||"-"}</p><p className="mt-2 text-sm text-gray-600">الجنسية: {worker?.nationality||"-"}</p><p className="mt-2 text-sm text-gray-600">ملاحظات: {worker?.notes||"-"}</p></div><div className="page-card p-5 lg:col-span-2"><h3 className="mb-4 text-lg font-black">العهد المسجلة على العامل</h3><div className="space-y-3">{assets.length?assets.map(a=><Link key={a.id} href={`/assets/edit/${a.id}`} className="block rounded-xl border border-gray-100 p-4 hover:bg-gray-50"><b>{a.name}</b><span className="mx-2 text-gray-400">|</span><span>{a.status}</span></Link>):<p className="text-sm text-gray-500">لا توجد عهد مسجلة.</p>}</div></div></div></Layout></ProtectedRoute>;
}

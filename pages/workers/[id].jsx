import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function WorkerDetails(){
 const router=useRouter(); const {id}=router.query; const [worker,setWorker]=useState(null); const [assets,setAssets]=useState([]);
 useEffect(()=>{ if(!id)return; const load=async()=>{const s=await getDoc(doc(db,"workers",id)); if(s.exists()) setWorker({id:s.id,...s.data()}); const a=await getDocs(query(collection(db,"assets"),where("workerIds","array-contains",id))); setAssets(a.docs.map(d=>({id:d.id,...d.data()})));}; load();},[id]);
 return <ProtectedRoute><Layout title="تفاصيل العامل"><div className="grid gap-5 lg:grid-cols-3"><div className="page-card p-5"><h3 className="text-lg font-black text-slate-900">{worker?.name||"..."}</h3><p className="mt-3 text-sm text-slate-600">الجوال: {worker?.phone||"-"}</p><p className="mt-2 text-sm text-slate-600">الجنسية: {worker?.nationality||"-"}</p><p className="mt-2 text-sm text-slate-600">ملاحظات: {worker?.notes||"-"}</p><div className="mt-5 rounded-2xl bg-green-50 p-4 text-green-800"><b>{assets.length}</b><span className="mr-2 text-sm font-bold">معدة مسجلة على العامل</span></div></div><div className="page-card p-5 lg:col-span-2"><h3 className="mb-4 text-lg font-black">العهد المسجلة على العامل</h3><div className="grid gap-3 md:grid-cols-2">{assets.length?assets.map(a=><Link key={a.id} href={`/assets/edit/${a.id}`} className="rounded-2xl border border-slate-100 p-4 hover:bg-slate-50"><b>{a.name}</b><p className="mt-1 text-sm text-slate-500">{a.farmName||"-"} — {a.status}</p></Link>):<p className="text-sm text-slate-500">لا توجد عهد مسجلة.</p>}</div></div></div></Layout></ProtectedRoute>;
}

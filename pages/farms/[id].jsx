import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function FarmDetails(){
 const router=useRouter(); const {id}=router.query; const [farm,setFarm]=useState(null); const [assets,setAssets]=useState([]);
 useEffect(()=>{ if(!id)return; const load=async()=>{const s=await getDoc(doc(db,"farms",id)); if(s.exists()) setFarm({id:s.id,...s.data()}); const a=await getDocs(query(collection(db,"assets"),where("farmId","==",id))); setAssets(a.docs.map(d=>({id:d.id,...d.data()})));}; load();},[id]);
 return <ProtectedRoute><Layout title="تفاصيل المزرعة"><div className="grid gap-5 xl:grid-cols-3"><div className="page-card p-5"><h3 className="text-lg font-black">{farm?.name||"..."}</h3><p className="mt-3 text-sm text-slate-600">المسئول: {farm?.managerName||"-"}</p><p className="mt-2 text-sm text-slate-600">الجوال: {farm?.managerPhone||"-"}</p><p className="mt-2 text-sm text-slate-600">ملاحظات: {farm?.notes||"-"}</p></div><div className="page-card p-5 xl:col-span-2"><h3 className="mb-4 text-lg font-black">المعدات داخل المزرعة</h3><div className="grid gap-3 md:grid-cols-2">{assets.length?assets.map(a=><Link key={a.id} href={`/assets/edit/${a.id}`} className="rounded-2xl border border-slate-100 p-4 hover:bg-slate-50"><b>{a.name}</b><p className="mt-1 text-sm text-slate-500">{a.status}</p></Link>):<p className="text-sm text-slate-500">لا توجد معدات مسجلة.</p>}</div></div></div></Layout></ProtectedRoute>;
}

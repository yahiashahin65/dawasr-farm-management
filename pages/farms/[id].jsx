import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
export default function FarmDetails(){const router=useRouter(); const {id}=router.query; const [farm,setFarm]=useState(null); const [assets,setAssets]=useState([]); useEffect(()=>{if(!id)return; getDoc(doc(db,"farms",id)).then(s=>s.exists()&&setFarm({id:s.id,...s.data()})); getDocs(query(collection(db,"assets"),where("placeId","==",id),where("placeType","==","farm"))).then(s=>setAssets(s.docs.map(d=>({id:d.id,...d.data()}))));},[id]); return <ProtectedRoute><Layout title="تفاصيل المزرعة"><div className="grid gap-5 lg:grid-cols-3"><div className="page-card p-5"><h3 className="text-lg font-black">{farm?.name||"..."}</h3><p className="mt-2 text-sm text-slate-500">مسئول المزرعة: {farm?.managerName||"-"}</p><p className="mt-2 text-sm text-slate-500">المهندسون: {farm?.engineerNames||"-"}</p><p className="mt-3 text-sm">{farm?.notes||"-"}</p></div><div className="page-card p-5 lg:col-span-2"><h3 className="mb-4 font-black">معدات المزرعة</h3><div className="grid gap-3 sm:grid-cols-2">{assets.map(a=><Link key={a.id} href="/assets" className="rounded-2xl border p-4"><b>{a.name}</b><p className="text-xs text-slate-500">{a.status}</p></Link>)}</div></div></div></Layout></ProtectedRoute>}

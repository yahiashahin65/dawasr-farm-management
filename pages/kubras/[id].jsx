import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
export default function KubraDetails(){const router=useRouter(); const {id}=router.query; const [kubra,setKubra]=useState(null); const [assets,setAssets]=useState([]); useEffect(()=>{if(!id)return; getDoc(doc(db,"kubras",id)).then(s=>s.exists()&&setKubra({id:s.id,...s.data()})); getDocs(query(collection(db,"assets"),where("placeId","==",id),where("placeType","==","kubra"))).then(s=>setAssets(s.docs.map(d=>({id:d.id,...d.data()}))));},[id]); return <ProtectedRoute><Layout title="تفاصيل الكِبرة"><div className="grid gap-5 lg:grid-cols-3"><div className="page-card p-5"><h3 className="text-lg font-black">{kubra?.name||"..."}</h3><p className="mt-3 text-sm text-slate-500">{kubra?.notes||"-"}</p></div><div className="page-card p-5 lg:col-span-2"><h3 className="mb-4 font-black">المعدات داخل الكِبرة</h3><div className="grid gap-3 sm:grid-cols-2">{assets.map(a=><Link key={a.id} href="/assets" className="rounded-2xl border p-4"><b>{a.name}</b><p className="text-xs text-slate-500">{a.status}</p></Link>)}</div></div></div></Layout></ProtectedRoute>}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
export default function EngineerDetails(){const router=useRouter(); const {id}=router.query; const [engineer,setEngineer]=useState(null); const [farms,setFarms]=useState([]); useEffect(()=>{if(!id)return; getDoc(doc(db,"engineers",id)).then(s=>s.exists()&&setEngineer({id:s.id,...s.data()})); getDocs(query(collection(db,"farms"),where("engineerIds","array-contains",id))).then(s=>setFarms(s.docs.map(d=>({id:d.id,...d.data()}))));},[id]); return <ProtectedRoute><Layout title="تفاصيل المهندس"><div className="grid gap-5 lg:grid-cols-3"><div className="page-card p-5"><h3 className="text-lg font-black">{engineer?.name||"..."}</h3><p className="mt-2 text-sm text-slate-500">{engineer?.phone||"لا يوجد رقم"}</p><p className="mt-3 text-sm">{engineer?.notes||"-"}</p></div><div className="page-card p-5 lg:col-span-2"><h3 className="mb-4 font-black">المزارع المسئول عنها</h3><div className="grid gap-3 sm:grid-cols-2">{farms.map(f=><Link key={f.id} href={`/farms/${f.id}`} className="rounded-2xl border p-4 font-bold hover:bg-slate-50">{f.name}</Link>)}</div></div></div></Layout></ProtectedRoute>}

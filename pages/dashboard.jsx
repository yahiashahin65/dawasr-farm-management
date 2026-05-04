import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTractor, faUsers, faWheatAwn, faCircleCheck, faTriangleExclamation, faCircleXmark, faUserTie, faWarehouse } from "@fortawesome/free-solid-svg-icons";

export default function Dashboard(){
 const [assets,setAssets]=useState([]); const [workers,setWorkers]=useState([]); const [farms,setFarms]=useState([]); const [engineers,setEngineers]=useState([]); const [kubras,setKubras]=useState([]);
 useEffect(()=>{getDocs(collection(db,"assets")).then(s=>setAssets(s.docs.map(d=>({id:d.id,...d.data()})))); getDocs(collection(db,"workers")).then(s=>setWorkers(s.docs.map(d=>({id:d.id,...d.data()})))); getDocs(collection(db,"farms")).then(s=>setFarms(s.docs.map(d=>({id:d.id,...d.data()})))); getDocs(collection(db,"engineers")).then(s=>setEngineers(s.docs.map(d=>({id:d.id,...d.data()})))); getDocs(collection(db,"kubras")).then(s=>setKubras(s.docs.map(d=>({id:d.id,...d.data()}))));},[]);
 const stats=useMemo(()=>({total:assets.length,good:assets.filter(a=>a.status==="صالح").length,broken:assets.filter(a=>a.status==="عاطل").length,damaged:assets.filter(a=>a.status==="تالف").length}),[assets]);
 const cards=[
  {title:"المهندسون",value:engineers.length,href:"/engineers",icon:faUserTie,sub:"مهندسون مسئولون عن أكثر من مزرعة"},
  {title:"المزارع",value:farms.length,href:"/farms",icon:faWheatAwn,sub:"عرض وإدارة المزارع"},
  {title:"الكِبر",value:kubras.length,href:"/kubras",icon:faWarehouse,sub:"إدارة الكِبر والمعدات الموجودة بها"},
  {title:"العمال",value:workers.length,href:"/workers",icon:faUsers,sub:"عرض العمال والعهد الخاصة بهم"},
  {title:"كل المعدات",value:stats.total,href:"/assets",icon:faTractor,sub:"عرض كل المعدات"},
  {title:"المعدات الصالحة",value:stats.good,href:"/assets?status=صالح",icon:faCircleCheck,sub:"اضغط لعرض الصالح فقط"},
  {title:"المعدات العاطلة",value:stats.broken,href:"/assets?status=عاطل",icon:faTriangleExclamation,sub:"تحتاج متابعة أو صيانة"},
  {title:"المعدات التالفة",value:stats.damaged,href:"/assets?status=تالف",icon:faCircleXmark,sub:"خارج الخدمة أو تالفة"},
 ];
 return <ProtectedRoute><Layout title="لوحة التحكم"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(c=><Link key={c.title} href={c.href} className="page-card group p-5 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-slate-500">{c.title}</p><h3 className="mt-2 text-4xl font-black text-slate-900">{c.value}</h3><p className="mt-2 text-xs text-slate-400">{c.sub}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700 group-hover:bg-green-700 group-hover:text-white"><FontAwesomeIcon icon={c.icon}/></div></div></Link>)}</div><div className="mt-6 grid gap-4 xl:grid-cols-2"><div className="page-card p-5"><h3 className="mb-4 font-black">آخر المعدات المسجلة</h3><div className="space-y-3">{assets.slice(0,5).map(a=><Link href={`/assets/edit/${a.id}`} key={a.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"><span className="font-bold">{a.name}</span><span className="text-sm text-slate-500">{a.status}</span></Link>)}</div></div><div className="page-card p-5"><h3 className="mb-4 font-black">تنبيه سريع</h3><p className="text-sm leading-7 text-slate-600">أي كارت في الإحصائيات قابل للضغط لعرض البيانات المرتبطة به. المعدات يمكن ربطها بأكثر من عامل، ويمكن وضعها داخل مزرعة أو داخل الكِبرة، وكل مهندس يمكن ربطه بأكثر من مزرعة.</p></div></div></Layout></ProtectedRoute>;
}

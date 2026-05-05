import { useEffect, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faEye } from "@fortawesome/free-solid-svg-icons";

export default function AssetTypes(){
  const [items,setItems]=useState([]); const [assets,setAssets]=useState([]);
  const load=async()=>{const [typesSnap,assetsSnap]=await Promise.all([getDocs(query(collection(db,"assetTypes"),orderBy("createdAt","desc"))),getDocs(collection(db,"assets"))]); setItems(typesSnap.docs.map(d=>({id:d.id,...d.data()}))); setAssets(assetsSnap.docs.map(d=>({id:d.id,...d.data()})));};
  useEffect(()=>{load();},[]);
  const remove=async(id)=>{if(confirm("هل تريد حذف نوع المعدة؟")){await deleteDoc(doc(db,"assetTypes",id)); load();}};
  const migrateOldAssets=async()=>{let machine=items.find(t=>t.name==="مكينة"); let machineId=machine?.id; if(!machineId){const ref=await addDoc(collection(db,"assetTypes"),{name:"مكينة",notes:"نوع افتراضي للبيانات القديمة",createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); machineId=ref.id;} const oldAssets=assets.filter(a=>!a.assetTypeId); await Promise.all(oldAssets.map(a=>updateDoc(doc(db,"assets",a.id),{assetTypeId:machineId,assetTypeName:"مكينة",updatedAt:serverTimestamp()}))); alert(`تم ربط ${oldAssets.length} معدة قديمة بنوع مكينة`); load();};
  const count=(t)=>assets.filter(a=>(a.assetTypeId===t.id)||(!a.assetTypeId&&t.name==="مكينة")).length;
  return <ProtectedRoute><Layout title="أنواع المعدات"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">إدارة أنواع المعدات. اسم المعدة نفسه يظل كتابة حرة داخل فورم المعدة.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={migrateOldAssets} className="btn-secondary">ربط البيانات القديمة بنوع مكينة</button><Link href="/asset-types/add" className="btn-primary"><FontAwesomeIcon icon={faPlus}/> إضافة نوع</Link></div></div><div className="page-card overflow-x-auto"><table className="w-full"><thead className="bg-slate-50"><tr><th className="table-th">نوع المعدة</th><th className="table-th">عدد المعدات</th><th className="table-th">ملاحظات</th><th className="table-th">إجراءات</th></tr></thead><tbody>{items.map(t=><tr key={t.id} className="clickable-row border-t border-slate-100"><td className="table-td font-black"><Link href={`/assets?assetTypeId=${t.id}`}>{t.name}</Link></td><td className="table-td"><Link className="badge bg-green-50 text-green-700" href={`/assets?assetTypeId=${t.id}`}>{count(t)}</Link></td><td className="table-td">{t.notes||"-"}</td><td className="table-td"><div className="flex gap-2"><Link href={`/assets?assetTypeId=${t.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faEye}/></Link><Link href={`/asset-types/edit/${t.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faPen}/></Link><button onClick={()=>remove(t.id)} className="btn-danger !p-2"><FontAwesomeIcon icon={faTrash}/></button></div></td></tr>)}</tbody></table></div></Layout></ProtectedRoute>;
}

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash } from "@fortawesome/free-solid-svg-icons";

export default function Assets(){
 const [items,setItems]=useState([]); const load=async()=>{const s=await getDocs(query(collection(db,"assets"),orderBy("createdAt","desc"))); setItems(s.docs.map(d=>({id:d.id,...d.data()})));}; useEffect(()=>{load();},[]);
 const remove=async(id)=>{if(confirm("هل تريد حذف العهدة؟")){await deleteDoc(doc(db,"assets",id)); load();}};
 return <ProtectedRoute><Layout title="إدارة العهد والمعدات"><div className="mb-4 flex justify-end"><Link href="/assets/add" className="btn-primary"><FontAwesomeIcon icon={faPlus}/> إضافة عهدة</Link></div><div className="page-card overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">الصورة</th><th className="table-th">المعدة</th><th className="table-th">العامل</th><th className="table-th">الحالة</th><th className="table-th">إجراءات</th></tr></thead><tbody>{items.map(a=><tr className="border-t" key={a.id}><td className="table-td"><img src={a.imageUrl} alt={a.name} className="h-12 w-16 rounded-lg object-cover"/></td><td className="table-td font-bold">{a.name}</td><td className="table-td">{a.workerName||"-"}</td><td className="table-td"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{a.status}</span></td><td className="table-td"><div className="flex gap-2"><Link href={`/assets/edit/${a.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faPen}/></Link><button onClick={()=>remove(a.id)} className="btn-danger !p-2"><FontAwesomeIcon icon={faTrash}/></button></div></td></tr>)}</tbody></table></div></Layout></ProtectedRoute>;
}

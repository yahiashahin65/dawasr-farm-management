import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faEye } from "@fortawesome/free-solid-svg-icons";

export default function Farms(){
 const [items,setItems]=useState([]);
 const load=async()=>{const s=await getDocs(query(collection(db,"farms"),orderBy("createdAt","desc"))); setItems(s.docs.map(d=>({id:d.id,...d.data()})));};
 useEffect(()=>{load();},[]);
 const remove=async(id)=>{if(confirm("هل تريد حذف المزرعة؟")){await deleteDoc(doc(db,"farms",id)); load();}};
 return <ProtectedRoute><Layout title="إدارة المزارع"><div className="mb-4 flex justify-end"><Link href="/farms/add" className="btn-primary"><FontAwesomeIcon icon={faPlus}/> إضافة مزرعة</Link></div><div className="page-card overflow-x-auto"><table className="w-full"><thead className="bg-slate-50"><tr><th className="table-th">اسم المزرعة</th><th className="table-th">مسئول المزرعة</th><th className="table-th">الجوال</th><th className="table-th">إجراءات</th></tr></thead><tbody>{items.map(f=><tr className="border-t border-slate-100" key={f.id}><td className="table-td font-black">{f.name}</td><td className="table-td">{f.managerName||"-"}</td><td className="table-td">{f.managerPhone||"-"}</td><td className="table-td"><div className="flex gap-2"><Link href={`/farms/${f.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faEye}/></Link><Link href={`/farms/edit/${f.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faPen}/></Link><button onClick={()=>remove(f.id)} className="btn-danger !p-2"><FontAwesomeIcon icon={faTrash}/></button></div></td></tr>)}</tbody></table></div></Layout></ProtectedRoute>;
}

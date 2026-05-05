import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faEye } from "@fortawesome/free-solid-svg-icons";

export default function Workers() {
  const [items, setItems] = useState([]);
  const load = async () => {
    const snap = await getDocs(query(collection(db, "workers"), orderBy("createdAt", "desc")));
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);
  const remove = async (id) => { if(confirm("هل تريد حذف العامل؟")){ await deleteDoc(doc(db,"workers",id)); load(); } };
  return <ProtectedRoute><Layout title="إدارة العمال"><div className="mb-4 flex justify-end"><Link href="/workers/add" className="btn-primary"><FontAwesomeIcon icon={faPlus} /> إضافة عامل</Link></div><div className="page-card overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">الاسم</th><th className="table-th">الجوال</th><th className="table-th">الجنسية</th><th className="table-th">إجراءات</th></tr></thead><tbody>{items.map(w => <tr key={w.id} className="border-t"><td className="table-td font-bold">{w.name}</td><td className="table-td">{w.phone || "-"}</td><td className="table-td">{w.nationality || "-"}</td><td className="table-td"><div className="flex gap-2"><Link className="btn-secondary !p-2" href={`/workers/${w.id}`}><FontAwesomeIcon icon={faEye}/></Link><Link className="btn-secondary !p-2" href={`/workers/edit/${w.id}`}><FontAwesomeIcon icon={faPen}/></Link><button className="btn-danger !p-2" onClick={()=>remove(w.id)}><FontAwesomeIcon icon={faTrash}/></button></div></td></tr>)}</tbody></table></div></Layout></ProtectedRoute>;
}

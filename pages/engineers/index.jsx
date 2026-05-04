import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function Engineers(){
 const [items,setItems]=useState([]); const [loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true); const s=await getDocs(query(collection(db,"engineers"),orderBy("createdAt","desc"))); setItems(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);};
 useEffect(()=>{load();},[]);
 const remove=async(id)=>{if(confirm("حذف المهندس؟")){await deleteDoc(doc(db,"engineers",id)); load();}};
return (
  <ProtectedRoute>
    <Layout title="المهندسون">
      {/* تم حذف الجملة والإبقاء على زر الإضافة مع ضبط المحاذاة */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href="/engineers/add" className="btn-primary">
          إضافة مهندس
        </Link>
      </div>

      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">الاسم</th>
                <th className="table-th">الجوال</th>
                <th className="table-th">ملاحظات</th>
                <th className="table-th">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="table-td" colSpan="4">
                    جاري التحميل...
                  </td>
                </tr>
              ) : (
                items.map((x) => (
                  <tr key={x.id} className="border-t">
                    <td className="table-td font-black">{x.name}</td>
                    <td className="table-td">{x.phone || "-"}</td>
                    <td className="table-td">{x.notes || "-"}</td>
                    <td className="table-td">
                      <div className="flex gap-2">
                        <Link className="btn-secondary" href={`/engineers/${x.id}`}>
                          عرض
                        </Link>
                        <Link className="btn-secondary" href={`/engineers/edit/${x.id}`}>
                          تعديل
                        </Link>
                        <button className="btn-danger" onClick={() => remove(x.id)}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  </ProtectedRoute>
); 
}

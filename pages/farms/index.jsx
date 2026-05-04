import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function Farms() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true); // حالة التحميل

  const load = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "farms"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    } catch (error) {
      console.error("خطأ في جلب البيانات:", error);
      alert("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    if (confirm("هل أنت متأكد من حذف هذه المزرعة؟")) {
      try {
        await deleteDoc(doc(db, "farms", id));
        // تحديث القائمة محلياً أسرع من إعادة الاستعلام من السيرفر
        setItems(items.filter(item => item.id !== id));
      } catch (error) {
        console.error("خطأ في الحذف:", error);
        alert("تعذر حذف المزرعة، حاول مرة أخرى");
      }
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="المزارع">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link href="/farms/add" className="btn-primary">
            إضافة مزرعة
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-10">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-slate-500">لا توجد مزارع مضافة حالياً.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {items.map((x) => (
              <div key={x.id} className="page-card p-5">
                <h3 className="text-lg font-black">{x.name}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  مسئول المزرعة: {x.managerName || "غير محدد"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  المهندسون: {x.engineerNames || "غير محدد"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="btn-secondary" href={`/farms/${x.id}`}>
                    عرض
                  </Link>
                  <Link className="btn-secondary" href={`/farms/edit/${x.id}`}>
                    تعديل
                  </Link>
                  <button className="btn-danger" onClick={() => remove(x.id)}>
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

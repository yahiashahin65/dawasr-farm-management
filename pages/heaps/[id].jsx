import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const cropTypes = ["برسيم", "رودس", "تبن"];
export default function HeapDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [heap, setHeap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchHeap = async () => {
      try {
        const heapRef = doc(db, "heaps", id);
        const heapSnap = await getDoc(heapRef);

        if (heapSnap.exists()) {
          setHeap({
            id: heapSnap.id,
            ...heapSnap.data(),
          });
        }
      } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء تحميل بيانات الكوم");
      } finally {
        setLoading(false);
      }
    };

    fetchHeap();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل الكوم">
        {loading ? (
          <div className="page-card p-5">جاري تحميل البيانات...</div>
        ) : !heap ? (
          <div className="page-card p-5">الكوم غير موجود</div>
        ) : (
          <div className="page-card max-w-5xl p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-black text-slate-800">
                تفاصيل الكوم
              </h1>

              <Link
                href={`/heaps/edit/${heap.id}`}
                className="btn-primary"
              >
                تعديل الكوم
              </Link>
            </div>

            {heap.imageUrl && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={heap.imageUrl}
                  alt={heap.pileName || "صورة الكوم"}
                  className="max-h-80 w-full rounded-2xl object-contain"
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-500">اسم الكوم</p>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {heap.pileName || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-500">المزرعة</p>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {heap.farmName || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-500">الرشاش</p>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {heap.sprinklerName || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-500">عدد اللبن</p>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {heap.bricksCount || 0}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-500">ملاحظات</p>
              <p className="mt-1 whitespace-pre-line text-slate-800">
                {heap.notes || "لا يوجد"}
              </p>
            </div>

            <Link href="/heaps" className="btn-secondary inline-block">
              رجوع للأكوام
            </Link>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

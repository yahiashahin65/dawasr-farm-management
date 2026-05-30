import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { getCachedCollection } from "../../lib/realtimeCache";
import { isOnline } from "../../lib/offlineQueue";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const getHeapFromCache = (heapId) => {
  const cached = getCachedCollection("cache:heaps");
  return cached.find((item) => item.id === heapId) || null;
};

export default function HeapDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [heap, setHeap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchHeap = async () => {
      setLoading(true);

      try {
        const cachedHeap = getHeapFromCache(id);

        if (cachedHeap) {
          setHeap(cachedHeap);

          if (!isOnline()) {
            setOfflineNotice("يتم عرض البيانات من الكاش لأن الجهاز غير متصل");
            setLoading(false);
            return;
          }
        }

        const heapRef = doc(db, "heaps", id);
        const heapSnap = await getDoc(heapRef);

        if (heapSnap.exists()) {
          setHeap({
            id: heapSnap.id,
            ...heapSnap.data(),
          });
        } else if (!cachedHeap) {
          setHeap(null);
        }
      } catch (error) {
        console.error(error);

        const cachedHeap = getHeapFromCache(id);

        if (cachedHeap) {
          setHeap(cachedHeap);
          setOfflineNotice("تعذر الاتصال، يتم عرض آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات الكوم");
        }
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
            {offlineNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {offlineNotice}
              </div>
            )}

            {heap.syncStatus === "pending" && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
                هذا الكوم قيد المزامنة وسيتم رفع التغييرات عند عودة الاتصال
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-black text-slate-800">
                تفاصيل الكوم
              </h1>

              <Link href={`/heaps/edit/${heap.id}`} className="btn-primary">
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
                <p className="text-sm font-bold text-slate-500">نوع الكوم</p>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {heap.cropType || "-"}
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

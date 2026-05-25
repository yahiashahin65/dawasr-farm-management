import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function HeapDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [heap, setHeap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchHeap = async () => {
      try {
        const heapRef = doc(db, 'heaps', id);
        const heapSnap = await getDoc(heapRef);

        if (heapSnap.exists()) {
          setHeap({
            id: heapSnap.id,
            ...heapSnap.data(),
          });
        }
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء تحميل بيانات الكوم');
      } finally {
        setLoading(false);
      }
    };

    fetchHeap();
  }, [id]);

  if (loading) {
    return <div className="p-6">جاري تحميل البيانات...</div>;
  }

  if (!heap) {
    return <div className="p-6">الكوم غير موجود</div>;
  }

  return (
    <div dir="rtl" className="p-6">
      <h1 className="mb-6 text-2xl font-bold">تفاصيل الكوم</h1>

      {heap.imageUrl && (
        <img
          src={heap.imageUrl}
          alt={heap.pileName}
          className="mb-6 h-48 w-48 rounded object-cover"
        />
      )}

      <div className="space-y-3 rounded border bg-white p-5">
        <p><strong>اسم الكوم:</strong> {heap.pileName}</p>
        <p><strong>المزرعة:</strong> {heap.farmName}</p>
        <p><strong>الرشاش:</strong> {heap.sprinklerName}</p>
        <p><strong>عدد اللبن:</strong> {heap.bricksCount}</p>
        <p><strong>ملاحظات:</strong> {heap.notes || 'لا يوجد'}</p>
      </div>
    </div>
  );
}

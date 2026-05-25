import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default function EditHeapPage() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState({
    pileName: '',
    farmName: '',
    sprinklerName: '',
    bricksCount: '',
    imageUrl: '',
    notes: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchHeap = async () => {
      try {
        const heapRef = doc(db, 'heaps', id);
        const heapSnap = await getDoc(heapRef);

        if (heapSnap.exists()) {
          const data = heapSnap.data();

          setForm({
            pileName: data.pileName || '',
            farmName: data.farmName || '',
            sprinklerName: data.sprinklerName || '',
            bricksCount: data.bricksCount || '',
            imageUrl: data.imageUrl || '',
            notes: data.notes || '',
          });
        } else {
          alert('الكوم غير موجود');
          router.push('/heaps');
        }
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء تحميل بيانات الكوم');
      } finally {
        setLoading(false);
      }
    };

    fetchHeap();
  }, [id, router]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const heapRef = doc(db, 'heaps', id);

      await updateDoc(heapRef, {
        ...form,
        bricksCount: Number(form.bricksCount || 0),
        updatedAt: serverTimestamp(),
      });

      router.push('/heaps');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تعديل الكوم');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">جاري تحميل البيانات...</div>;
  }

  return (
    <div dir="rtl" className="p-6">
      <h1 className="mb-6 text-2xl font-bold">تعديل الكوم</h1>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <input
          name="pileName"
          placeholder="اسم الكوم"
          value={form.pileName}
          onChange={handleChange}
          className="w-full rounded border p-3"
          required
        />

        <input
          name="farmName"
          placeholder="اسم المزرعة"
          value={form.farmName}
          onChange={handleChange}
          className="w-full rounded border p-3"
          required
        />

        <input
          name="sprinklerName"
          placeholder="مكان/رقم الرشاش"
          value={form.sprinklerName}
          onChange={handleChange}
          className="w-full rounded border p-3"
          required
        />

        <input
          name="bricksCount"
          type="number"
          placeholder="عدد اللبن"
          value={form.bricksCount}
          onChange={handleChange}
          className="w-full rounded border p-3"
          required
        />

        <input
          name="imageUrl"
          placeholder="رابط صورة الكوم"
          value={form.imageUrl}
          onChange={handleChange}
          className="w-full rounded border p-3"
        />

        <textarea
          name="notes"
          placeholder="ملاحظات"
          value={form.notes}
          onChange={handleChange}
          className="w-full rounded border p-3"
        />

        {form.imageUrl && (
          <img
            src={form.imageUrl}
            alt="صورة الكوم"
            className="h-32 w-32 rounded object-cover"
          />
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-700 px-6 py-3 text-white disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </form>
    </div>
  );
}

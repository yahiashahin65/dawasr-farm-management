import { useState } from 'react';
import { useRouter } from 'next/router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AddHeapPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    pileName: '',
    farmName: '',
    sprinklerName: '',
    bricksCount: '',
    notes: '',
    imageUrl: '',
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      await addDoc(collection(db, 'heaps'), {
        ...form,
        bricksCount: Number(form.bricksCount || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push('/heaps');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إضافة الكوم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="p-6">
      <h1 className="mb-6 text-2xl font-bold">إضافة كوم جديد</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <input name="pileName" placeholder="اسم الكوم" value={form.pileName} onChange={handleChange} className="w-full rounded border p-3" required />

        <input name="farmName" placeholder="اسم المزرعة" value={form.farmName} onChange={handleChange} className="w-full rounded border p-3" required />

        <input name="sprinklerName" placeholder="مكان/رقم الرشاش" value={form.sprinklerName} onChange={handleChange} className="w-full rounded border p-3" required />

        <input name="bricksCount" type="number" placeholder="عدد اللبن" value={form.bricksCount} onChange={handleChange} className="w-full rounded border p-3" required />

        <input name="imageUrl" placeholder="رابط صورة الكوم" value={form.imageUrl} onChange={handleChange} className="w-full rounded border p-3" />

        <textarea name="notes" placeholder="ملاحظات" value={form.notes} onChange={handleChange} className="w-full rounded border p-3" />

        <button disabled={loading} className="rounded bg-green-700 px-6 py-3 text-white disabled:opacity-50">
          {loading ? 'جاري الحفظ...' : 'حفظ الكوم'}
        </button>
      </form>
    </div>
  );
}

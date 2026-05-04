import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

const initialForm = {
  workerName: '',
  workerPhone: '',
  workerNationality: '',
  name: '',
  status: 'صالحة',
  notes: '',
};

export default function AddAsset() {
  const [form, setForm] = useState(initialForm);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageChange = (file) => {
    setImage(file || null);
    setPreview(file ? URL.createObjectURL(file) : '');
  };

  const handleSave = async () => {
    if (!image || !form.workerName.trim() || !form.name.trim()) {
      alert('يرجى ملء اسم العامل واسم المعدة واختيار صورة المعدة');
      return;
    }

    setLoading(true);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error('Missing Cloudinary environment variables');
      }

      const data = new FormData();
      data.append('file', image);
      data.append('upload_preset', uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: data,
      });

      const fileData = await res.json();

      if (!res.ok || !fileData.secure_url) {
        throw new Error(fileData?.error?.message || 'Cloudinary upload failed');
      }

      await addDoc(collection(db, 'assets'), {
        name: form.name.trim(),
        status: form.status,
        worker: form.workerName.trim(),
        workerPhone: form.workerPhone.trim(),
        workerNationality: form.workerNationality.trim(),
        imageUrl: fileData.secure_url,
        notes: form.notes.trim(),
        createdAt: serverTimestamp(),
      });

      alert('تم تسجيل العهدة بنجاح');
      setForm(initialForm);
      setImage(null);
      setPreview('');
    } catch (error) {
      console.error(error);
      alert(`حدث خطأ أثناء الحفظ: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4" dir="rtl">
      <div className="max-w-md mx-auto p-4 bg-white shadow-2xl rounded-3xl text-right mt-4">
        <div className="flex items-center justify-between gap-3 mb-6 border-b-2 border-green-100 pb-3">
          <h1 className="text-xl font-black text-green-800">تسجيل عهدة عامل</h1>
          <Link href="/" className="text-sm font-bold text-green-700 hover:text-green-900">
            الرئيسية
          </Link>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 mb-2">📸 صورة المعدة</label>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="w-full text-sm"
              onChange={(e) => handleImageChange(e.target.files?.[0])}
            />

            {preview && (
              <img
                src={preview}
                alt="معاينة صورة المعدة"
                className="w-full h-44 object-cover rounded-2xl mt-3 border"
              />
            )}

            <input
              className="w-full border-b p-2 mt-2 bg-transparent focus:outline-none"
              placeholder="اسم المعدة مثال: ماكينة 605"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-xl space-y-3">
            <label className="block text-sm font-bold text-blue-800">👤 بيانات العامل المستلم</label>

            <input
              className="w-full border-b p-2 bg-transparent focus:outline-none"
              placeholder="اسم العامل بالكامل"
              value={form.workerName}
              onChange={(e) => handleChange('workerName', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                className="w-full border-b p-2 bg-transparent focus:outline-none"
                placeholder="الجنسية"
                value={form.workerNationality}
                onChange={(e) => handleChange('workerNationality', e.target.value)}
              />

              <input
                className="w-full border-b p-2 bg-transparent focus:outline-none"
                placeholder="رقم الجوال"
                value={form.workerPhone}
                onChange={(e) => handleChange('workerPhone', e.target.value)}
              />
            </div>
          </div>

          <select
            className="w-full border p-3 rounded-xl text-sm bg-white"
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            <option value="صالحة">صالحة</option>
            <option value="صيانة">صيانة</option>
            <option value="تالفة">تالفة</option>
          </select>

          <textarea
            className="w-full border p-2 rounded-xl h-20 text-sm focus:outline-none"
            placeholder="ملاحظات إضافية عن حالة العهدة..."
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className={`w-full p-4 rounded-2xl font-black text-white shadow-lg transition-all ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'
            }`}
          >
            {loading ? 'جاري الحفظ والرفع...' : 'اعتماد العهدة'}
          </button>
        </div>
      </div>
    </main>
  );
}

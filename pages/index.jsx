import Link from 'next/link';

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 p-4 text-right">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-6 mt-6">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-3xl mb-4">
          🚜
        </div>

        <h1 className="text-2xl font-black text-green-800 mb-3">
          نظام إدارة مزارع السنبلة
        </h1>

        <p className="text-gray-600 leading-7 mb-6">
          إدارة وجرد عهد المعدات والعمال مع توثيق الحالة بالصور وربط البيانات مع Firebase و Cloudinary.
        </p>

        <Link
          href="/add-asset"
          className="block w-full text-center bg-green-600 text-white p-4 rounded-2xl font-bold hover:bg-green-700 transition"
        >
          تسجيل عهدة جديدة
        </Link>
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function HeapsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const snapshot = await getDocs(collection(db, 'heaps'));

    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setItems(data);
  };

  const filteredItems = items.filter((item) => {
    const keyword = search.toLowerCase();

    return (
      item.pileName?.toLowerCase().includes(keyword) ||
      item.farmName?.toLowerCase().includes(keyword) ||
      item.sprinklerName?.toLowerCase().includes(keyword)
    );
  });

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <div dir="rtl" className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">الأكوام</h1>

        <Link
          href="/heaps/add"
          className="rounded-lg bg-green-700 px-4 py-2 text-white"
        >
          إضافة كوم
        </Link>
      </div>

      <input
        type="text"
        placeholder="بحث باسم الكوم أو المزرعة أو الرشاش..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="mb-6 w-full rounded-lg border p-3"
      />

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-right">اسم الكوم</th>
              <th className="p-3 text-right">المزرعة</th>
              <th className="p-3 text-right">الرشاش</th>
              <th className="p-3 text-right">عدد اللبن</th>
              <th className="p-3 text-right">الإجراءات</th>
            </tr>
          </thead>

          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-gray-500">
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{item.pileName}</td>
                  <td className="p-3">{item.farmName}</td>
                  <td className="p-3">{item.sprinklerName}</td>
                  <td className="p-3">{item.bricksCount}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link href={`/heaps/${item.id}`} className="text-blue-600">
                        عرض
                      </Link>
                      <Link
                        href={`/heaps/edit/${item.id}`}
                        className="text-green-700"
                      >
                        تعديل
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          السابق
        </button>

        <span>
          صفحة {page} من {totalPages || 1}
        </span>

        <button
          disabled={page === totalPages || totalPages === 0}
          onClick={() => setPage(page + 1)}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

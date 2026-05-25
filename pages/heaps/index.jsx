import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

export default function HeapsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const snapshot = await getDocs(collection(db, "heaps"));

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
      item.sprinklerName?.toLowerCase().includes(keyword) ||
      item.cropType?.toLowerCase().includes(keyword)
    );
  });

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <ProtectedRoute>
      <Layout title="الأكوام">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-800">الأكوام</h1>

          <Link href="/heaps/add" className="btn-primary">
            إضافة كوم
          </Link>
        </div>

        <input
          type="text"
          placeholder="بحث باسم الكوم أو المزرعة أو الرشاش أو النوع..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="form-input mb-5"
        />

        <div className="page-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">اسم الكوم</th>
                <th className="table-th">النوع</th>
                <th className="table-th">المزرعة</th>
                <th className="table-th">الرشاش</th>
                <th className="table-th">عدد اللبن</th>
                <th className="table-th">الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-td text-center">
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="table-td font-bold">{item.pileName}</td>

                    <td className="table-td">
                      <span className="badge bg-green-50 text-green-700">
                        {item.cropType || "-"}
                      </span>
                    </td>

                    <td className="table-td">{item.farmName}</td>
                    <td className="table-td">{item.sprinklerName}</td>
                    <td className="table-td">{item.bricksCount}</td>

                    <td className="table-td">
                      <div className="flex gap-2">
                        <Link
                          href={`/heaps/${item.id}`}
                          className="badge bg-blue-50 text-blue-700"
                        >
                          عرض
                        </Link>

                        <Link
                          href={`/heaps/edit/${item.id}`}
                          className="badge bg-emerald-50 text-emerald-700"
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

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="btn-secondary disabled:opacity-50"
          >
            السابق
          </button>

          <span className="font-bold text-slate-700">
            صفحة {page} من {totalPages || 1}
          </span>

          <button
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage(page + 1)}
            className="btn-secondary disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

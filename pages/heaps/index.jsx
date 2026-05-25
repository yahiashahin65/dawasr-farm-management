import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlus } from "@fortawesome/free-solid-svg-icons";

const PAGE_SIZE = 10;

export default function HeapsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageCursors, setPageCursors] = useState({ 1: null });

  const loadHeapsPage = async (
    pageNumber = 1,
    cursor = null,
    showLoader = true
  ) => {
    if (showLoader) setPageLoading(true);

    try {
      const constraints = [orderBy("createdAt", "desc")];

      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      constraints.push(limit(PAGE_SIZE + 1));

      const snapshot = await getDocs(
        query(collection(db, "heaps"), ...constraints)
      );

      const docs = snapshot.docs;
      const visibleDocs = docs.slice(0, PAGE_SIZE);

      setItems(
        visibleDocs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );

      setHasNextPage(docs.length > PAGE_SIZE);

      setPageCursors((prev) => ({
        ...prev,
        [pageNumber + 1]: visibleDocs[visibleDocs.length - 1] || null,
      }));

      setCurrentPage(pageNumber);
    } finally {
      if (showLoader) setPageLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        await loadHeapsPage(1, null, false);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((item) => {
      const haystack = `
        ${item.pileName || ""}
        ${item.farmName || ""}
        ${item.sprinklerName || ""}
        ${item.cropType || ""}
      `.toLowerCase();

      return haystack.includes(keyword);
    });
  }, [items, search]);

  return (
    <ProtectedRoute pageLoading={initialLoading}>
      <Layout title="الأكوام">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="page-card flex flex-1 items-center gap-2 p-3">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="text-slate-400"
            />

            <input
              type="text"
              placeholder="بحث باسم الكوم أو المزرعة أو الرشاش أو النوع..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent p-2 outline-none"
            />
          </div>

          <Link href="/heaps/add" className="btn-primary">
            <FontAwesomeIcon icon={faPlus} />
            إضافة كوم
          </Link>
        </div>

        {pageLoading && (
          <div className="page-card mb-4 p-4 text-center font-bold text-slate-500">
            جاري تحميل البيانات...
          </div>
        )}

        <div className="mb-3 text-sm font-bold text-slate-500">
          المعروض في هذه الصفحة: {filteredItems.length}
        </div>

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
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-td text-center">
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="table-td font-bold">{item.pileName}</td>

                    <td className="table-td">
                      <span className="badge bg-green-50 text-green-700">
                        {item.cropType || "-"}
                      </span>
                    </td>

                    <td className="table-td">{item.farmName || "-"}</td>
                    <td className="table-td">{item.sprinklerName || "-"}</td>
                    <td className="table-td">{item.bricksCount || 0}</td>

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

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={currentPage === 1 || pageLoading}
            onClick={() =>
              loadHeapsPage(
                currentPage - 1,
                pageCursors[currentPage - 1] || null
              )
            }
            className="btn-secondary disabled:opacity-50"
          >
            السابق
          </button>

          <span className="font-bold text-slate-700">صفحة {currentPage}</span>

          <button
            disabled={!hasNextPage || pageLoading}
            onClick={() =>
              loadHeapsPage(currentPage + 1, pageCursors[currentPage + 1])
            }
            className="btn-secondary disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

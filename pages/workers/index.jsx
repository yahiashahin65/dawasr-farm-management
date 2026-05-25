import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import useUserRole from "../../hooks/useUserRole";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPen,
  faTrash,
  faEye,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";

const PAGE_SIZE = 10;

export default function Workers() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageCursors, setPageCursors] = useState({ 1: null });

  const loadWorkersPage = async (
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

      const snap = await getDocs(
        query(collection(db, "workers"), ...constraints)
      );

      const docs = snap.docs;
      const visibleDocs = docs.slice(0, PAGE_SIZE);

      setItems(
        visibleDocs.map((d) => ({
          id: d.id,
          ...d.data(),
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
        await loadWorkersPage(1, null, false);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((worker) => {
      const haystack = `
        ${worker.name || ""}
        ${worker.phone || ""}
        ${worker.nationality || ""}
      `.toLowerCase();

      return haystack.includes(keyword);
    });
  }, [items, search]);

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف العامل؟")) {
      await deleteDoc(doc(db, "workers", id));

      await loadWorkersPage(currentPage, pageCursors[currentPage] || null);
    }
  };

  return (
    <ProtectedRoute pageLoading={initialLoading}>
      <Layout title="إدارة العمال">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="page-card flex flex-1 items-center gap-2 p-3">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="text-slate-400"
            />

            <input
              className="w-full bg-transparent p-2 outline-none"
              placeholder="بحث باسم العامل أو الجوال أو الجنسية..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {canManage && (
            <Link href="/workers/add" className="btn-primary">
              <FontAwesomeIcon icon={faPlus} /> إضافة عامل
            </Link>
          )}
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
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">الاسم</th>
                <th className="table-th">الجوال</th>
                <th className="table-th">الجنسية</th>
                <th className="table-th">إجراءات</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((worker) => (
                <tr key={worker.id} className="border-t">
                  <td className="table-td font-bold">{worker.name}</td>
                  <td className="table-td">{worker.phone || "-"}</td>
                  <td className="table-td">{worker.nationality || "-"}</td>

                  <td className="table-td">
                    <div className="flex gap-2">
                      <Link
                        className="btn-secondary !p-2"
                        href={`/workers/${worker.id}`}
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </Link>

                      {canManage && (
                        <>
                          <Link
                            className="btn-secondary !p-2"
                            href={`/workers/edit/${worker.id}`}
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </Link>

                          <button
                            className="btn-danger !p-2"
                            onClick={() => remove(worker.id)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td className="table-td text-center" colSpan="4">
                    لا توجد عمال مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={currentPage === 1 || pageLoading}
            onClick={() =>
              loadWorkersPage(
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
              loadWorkersPage(currentPage + 1, pageCursors[currentPage + 1])
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

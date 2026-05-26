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
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faPlus,
  faMagnifyingGlass,
  faEye,
  faPen,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

const PAGE_SIZE = 10;

export default function Engineers() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageCursors, setPageCursors] = useState({ 1: null });

  const loadEngineersPage = async (
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
        query(collection(db, "engineers"), ...constraints)
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
        await loadEngineersPage(1, null, false);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((engineer) => {
      const haystack = `
        ${engineer.name || ""}
        ${engineer.phone || ""}
        ${engineer.notes || ""}
      `.toLowerCase();

      return haystack.includes(keyword);
    });
  }, [items, search]);

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("حذف المهندس؟")) {
      await deleteDoc(doc(db, "engineers", id));
      await loadEngineersPage(currentPage, pageCursors[currentPage] || null);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="المهندسون">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل المهندسين..."
            subtitle="يتم تجهيز بيانات المهندسين"
          />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="page-card flex flex-1 items-center gap-2 p-3">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-slate-400"
                />

                <input
                  className="w-full bg-transparent p-2 outline-none"
                  placeholder="بحث باسم المهندس أو الجوال أو الملاحظات..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {canManage && (
                <Link href="/engineers/add" className="btn-primary">
                  <FontAwesomeIcon icon={faPlus} />
                  إضافة مهندس
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

            <div className="page-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-th">الاسم</th>
                      <th className="table-th">الجوال</th>
                      <th className="table-th">ملاحظات</th>
                      <th className="table-th">إجراءات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredItems.map((engineer) => (
                      <tr key={engineer.id} className="border-t">
                        <td className="table-td font-black">{engineer.name}</td>
                        <td className="table-td">{engineer.phone || "-"}</td>
                        <td className="table-td">{engineer.notes || "-"}</td>

                        <td className="table-td">
                          <div className="flex gap-2">
                            <Link
                              className="btn-secondary !p-2"
                              href={`/engineers/${engineer.id}`}
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </Link>

                            {canManage && (
                              <>
                                <Link
                                  className="btn-secondary !p-2"
                                  href={`/engineers/edit/${engineer.id}`}
                                >
                                  <FontAwesomeIcon icon={faPen} />
                                </Link>

                                <button
                                  className="btn-danger !p-2"
                                  onClick={() => remove(engineer.id)}
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
                          لا توجد مهندسين مطابقين
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                disabled={currentPage === 1 || pageLoading}
                onClick={() =>
                  loadEngineersPage(
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
                  loadEngineersPage(
                    currentPage + 1,
                    pageCursors[currentPage + 1]
                  )
                }
                className="btn-secondary disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

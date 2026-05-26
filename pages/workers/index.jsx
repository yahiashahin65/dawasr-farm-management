import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../../lib/firebase";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
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
  const [currentPage, setCurrentPage] = useState(1);

  const loadWorkers = async () => {
    const snap = await getDocs(
      query(collection(db, "workers"), orderBy("createdAt", "desc"))
    );

    setItems(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        await loadWorkers();
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

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filteredItems, currentPage]);

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف العامل؟")) {
      await deleteDoc(doc(db, "workers", id));

      await loadWorkers();

      if (paginatedItems.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      }
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إدارة العمال">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل العمال..."
            subtitle="يتم تجهيز بيانات العمال"
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
                  placeholder="بحث باسم العامل أو الجوال أو الجنسية..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {canManage && (
                <Link href="/workers/add" className="btn-primary">
                  <FontAwesomeIcon icon={faPlus} /> إضافة عامل
                </Link>
              )}
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filteredItems.length}
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
                  {paginatedItems.map((worker) => (
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
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="btn-secondary disabled:opacity-50"
              >
                السابق
              </button>

              <span className="font-bold text-slate-700">
                صفحة {currentPage} من {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
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

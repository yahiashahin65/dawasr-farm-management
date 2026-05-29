import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { subscribeCachedCollection } from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPen,
  faTrash,
  faMagnifyingGlass,
  faBroom,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";

import useUserRole from "../../hooks/useUserRole";

const PAGE_SIZE = 10;

export default function HeapsPage() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({
      db,
      collectionName: "heaps",
      cacheKey: "cache:heaps",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الأكوام لحظيًا");
      },
    });

    return () => unsubscribe?.();
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
        ${item.bricksCount || ""}
        ${item.notes || ""}
      `.toLowerCase();

      return haystack.includes(keyword);
    });
  }, [items, search]);

  const totalBricks = useMemo(() => {
    return filteredItems.reduce(
      (sum, item) => sum + Number(item.bricksCount || 0),
      0
    );
  }, [filteredItems]);

  const totalFarms = useMemo(() => {
    return new Set(filteredItems.map((item) => item.farmId || item.farmName).filter(Boolean)).size;
  }, [filteredItems]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filteredItems, currentPage]);

  const clearFilters = () => {
    setSearch("");
    setCurrentPage(1);
  };

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف الكوم؟")) {
      await deleteDoc(doc(db, "heaps", id));

      if (paginatedItems.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      }
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="الأكوام">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الأكوام..."
            subtitle="يتم تجهيز بيانات الأكوام"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">إجمالي الأكوام</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {filteredItems.length}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">إجمالي اللبن</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {totalBricks}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">عدد المزارع</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {totalFarms}
                </h3>
              </div>
            </div>

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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-transparent p-2 outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={clearFilters} className="btn-secondary">
                  <FontAwesomeIcon icon={faBroom} />
                  مسح البحث
                </button>

                {canManage && (
                  <Link href="/heaps/add" className="btn-primary">
                    <FontAwesomeIcon icon={faPlus} />
                    إضافة كوم
                  </Link>
                )}
              </div>
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filteredItems.length}
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
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="table-td text-center">
                        لا توجد بيانات
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="table-td font-bold">
                          {item.pileName || "-"}
                        </td>

                        <td className="table-td">
                          <span className="badge bg-green-50 text-green-700">
                            {item.cropType || "غير معلوم"}
                          </span>
                        </td>

                        <td className="table-td">{item.farmName || "-"}</td>
                        <td className="table-td">{item.sprinklerName || "-"}</td>

                        <td className="table-td">
                          {item.bricksCount || "غير محدد"}
                        </td>

                        <td className="table-td">
                          <div className="flex gap-2">
                            <Link
                              href={`/heaps/${item.id}`}
                              className="btn-secondary !p-2"
                              title="عرض"
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </Link>

                            {canManage && (
                              <>
                                <Link
                                  href={`/heaps/edit/${item.id}`}
                                  className="btn-secondary !p-2"
                                  title="تعديل"
                                >
                                  <FontAwesomeIcon icon={faPen} />
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => remove(item.id)}
                                  className="btn-danger !p-2"
                                  title="حذف"
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredItems.length > PAGE_SIZE && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="btn-secondary disabled:opacity-50"
                >
                  السابق
                </button>

                <span className="font-bold text-slate-700">
                  صفحة {currentPage} من {totalPages}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className="btn-secondary disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import {
  getCachedCollection,
  setCachedCollection,
  subscribeCachedCollection,
} from "../../lib/realtimeCache";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";

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

const removeEngineerFromCache = (engineerId) => {
  const cached = getCachedCollection("cache:engineers");

  setCachedCollection(
    "cache:engineers",
    cached.filter((item) => item.id !== engineerId)
  );
};

export default function Engineers() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({
      db,
      collectionName: "engineers",
      cacheKey: "cache:engineers",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات المهندسين لحظيًا");
      },
    });

    return () => unsubscribe?.();
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

  const remove = async (id) => {
    if (!canManage) return;

    if (!confirm("حذف المهندس؟")) return;

    const target = items.find((item) => item.id === id);

    removeEngineerFromCache(id);
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (paginatedItems.length === 1 && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "engineers",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف مهندس",
          name: target?.name || "",
        },
      });

      alert("تم حذف المهندس محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "engineers", id));
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "engineers",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف مهندس",
          name: target?.name || "",
        },
      });

      alert("تعذر الاتصال، تم حفظ عملية الحذف وسيتم تنفيذها عند عودة الاتصال");
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
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {canManage && (
                <Link href="/engineers/add" className="btn-primary">
                  <FontAwesomeIcon icon={faPlus} />
                  إضافة مهندس
                </Link>
              )}
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filteredItems.length}
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
                    {paginatedItems.map((engineer) => (
                      <tr key={engineer.id} className="border-t">
                        <td className="table-td font-black">
                          <div className="flex flex-col gap-1">
                            <span>{engineer.name || "-"}</span>

                            {engineer.syncStatus === "pending" && (
                              <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                                قيد المزامنة
                              </span>
                            )}
                          </div>
                        </td>

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

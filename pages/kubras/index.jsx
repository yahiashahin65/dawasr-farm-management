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

const removeKubraFromCache = (kubraId) => {
  const cached = getCachedCollection("cache:kubras");

  setCachedCollection(
    "cache:kubras",
    cached.filter((item) => item.id !== kubraId)
  );
};

export default function Kubras() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({
      db,
      collectionName: "kubras",
      cacheKey: "cache:kubras",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الكِبر لحظيًا");
      },
    });

    return () => unsubscribe?.();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((kubra) => {
      const haystack = `
        ${kubra.name || ""}
        ${kubra.notes || ""}
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

    if (!confirm("حذف الكِبرة؟")) return;

    const target = items.find((item) => item.id === id);

    removeKubraFromCache(id);
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (paginatedItems.length === 1 && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "kubras",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف كِبرة",
          name: target?.name || "",
        },
      });

      alert("تم حذف الكِبرة محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "kubras", id));
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "kubras",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف كِبرة",
          name: target?.name || "",
        },
      });

      alert("تعذر الاتصال، تم حفظ عملية الحذف وسيتم تنفيذها عند عودة الاتصال");
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="الكِبر">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الكِبر..."
            subtitle="يتم تجهيز بيانات الكِبر"
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
                  placeholder="بحث باسم الكِبرة أو الملاحظات..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {canManage && (
                <Link href="/kubras/add" className="btn-primary">
                  <FontAwesomeIcon icon={faPlus} />
                  إضافة كِبرة
                </Link>
              )}
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filteredItems.length}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedItems.map((kubra) => (
                <div key={kubra.id} className="page-card p-5">
                  <h3 className="text-lg font-black">
                    <div className="flex flex-col gap-1">
                      <span>{kubra.name || "-"}</span>

                      {kubra.syncStatus === "pending" && (
                        <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                          قيد المزامنة
                        </span>
                      )}
                    </div>
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {kubra.notes || "-"}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Link
                      className="btn-secondary !p-2"
                      href={`/kubras/${kubra.id}`}
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </Link>

                    {canManage && (
                      <>
                        <Link
                          className="btn-secondary !p-2"
                          href={`/kubras/edit/${kubra.id}`}
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </Link>

                        <button
                          className="btn-danger !p-2"
                          onClick={() => remove(kubra.id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="page-card p-5 text-center font-bold text-slate-500 sm:col-span-2 xl:col-span-3">
                  لا توجد كِبر مطابقة
                </div>
              )}
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

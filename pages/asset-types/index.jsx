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
  faPen,
  faTrash,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";

const PAGE_SIZE = 10;

const removeAssetTypeFromCache = (typeId) => {
  const cached = getCachedCollection("cache:assetTypes");

  setCachedCollection(
    "cache:assetTypes",
    cached.filter((item) => item.id !== typeId)
  );
};

export default function AssetTypes() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsubscribeTypes = subscribeCachedCollection({
      db,
      collectionName: "assetTypes",
      cacheKey: "cache:assetTypes",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات أنواع المعدات لحظيًا");
      },
    });

    const unsubscribeAssets = subscribeCachedCollection({
      db,
      collectionName: "assets",
      cacheKey: "cache:assets",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setAssets,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الأصول لحظيًا");
      },
    });

    return () => {
      unsubscribeTypes?.();
      unsubscribeAssets?.();
    };
  }, []);

  const count = (type) =>
    assets.filter((asset) => asset.assetTypeId === type.id).length;

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const cleanItems = items.filter((item) => item.name && item.name.trim());

    if (!keyword) return cleanItems;

    return cleanItems.filter((type) => {
      const haystack = `${type.name || ""} ${type.notes || ""}`.toLowerCase();

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

    if (!confirm("هل تريد حذف نوع المعدة؟")) return;

    const target = items.find((item) => item.id === id);

    removeAssetTypeFromCache(id);
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (paginatedItems.length === 1 && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "assetTypes",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف نوع معدة",
          name: target?.name || "",
        },
      });

      alert("تم حذف نوع المعدة محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "assetTypes", id));
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "assetTypes",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف نوع معدة",
          name: target?.name || "",
        },
      });

      alert("تعذر الاتصال، تم حفظ عملية الحذف وسيتم تنفيذها عند عودة الاتصال");
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="أنواع المعدات">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل أنواع المعدات..."
            subtitle="يتم تجهيز الأنواع وربطها بالأصول"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <Link href="/asset-types/add" className="btn-primary">
                    <FontAwesomeIcon icon={faPlus} />
                    إضافة نوع
                  </Link>
                )}
              </div>

              <Link href="/assets" className="btn-secondary">
                إجمالي المعدات: {assets.length}
              </Link>
            </div>

            <div className="page-card mb-4 flex items-center gap-2 p-3">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="text-slate-400"
              />

              <input
                className="w-full bg-transparent p-2 outline-none"
                placeholder="بحث باسم النوع أو الملاحظات..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filteredItems.length}
            </div>

            <div className="page-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">نوع المعدة</th>
                    <th className="table-th">عدد المعدات</th>
                    <th className="table-th">ملاحظات</th>
                    <th className="table-th">إجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((type) => (
                    <tr
                      key={type.id}
                      className="clickable-row border-t border-slate-100"
                    >
                      <td className="table-td font-black">
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/assets?assetTypeId=${type.id}`}
                            className="text-green-700 hover:underline"
                          >
                            {type.name}
                          </Link>

                          {type.syncStatus === "pending" && (
                            <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                              قيد المزامنة
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="table-td">
                        <Link
                          href={`/assets?assetTypeId=${type.id}`}
                          className="badge bg-green-50 text-green-700"
                        >
                          {count(type)}
                        </Link>
                      </td>

                      <td className="table-td">{type.notes || "-"}</td>

                      <td className="table-td">
                        <div className="flex gap-2">
                          {canManage && (
                            <>
                              <Link
                                href={`/asset-types/edit/${type.id}`}
                                className="btn-secondary !p-2"
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </Link>

                              <button
                                type="button"
                                onClick={() => remove(type.id)}
                                className="btn-danger !p-2"
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
                        لا توجد أنواع معدات مطابقة
                      </td>
                    </tr>
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

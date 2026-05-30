import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { calculateAssetsStats } from "../../lib/assetsStats";
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
  faEye,
  faRightLeft,
  faTableCells,
  faTableList,
  faBroom,
} from "@fortawesome/free-solid-svg-icons";

import {
  badgeClass,
  getAssetTypeName,
  getPlaceName,
  getPlaceTypeLabel,
  normalizeList,
} from "../../lib/inventory";

const PAGE_SIZE = 10;

const removeAssetFromCache = (assetId) => {
  const cached = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cached.filter((item) => item.id !== assetId)
  );
};

export default function Assets() {
  const router = useRouter();
  const { canManage } = useUserRole();

  const [allItems, setAllItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    status: "",
    assetTypeId: "",
    placeType: "",
    farmId: "",
    kubraId: "",
    workerId: "",
    category: "",
  });

  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState("table");

  useEffect(() => {
    const unsubscribeAssets = subscribeCachedCollection({
      db,
      collectionName: "assets",
      cacheKey: "cache:assets",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setAllItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الأصول لحظيًا");
      },
    });

    const unsubscribeTypes = subscribeCachedCollection({
      db,
      collectionName: "assetTypes",
      cacheKey: "cache:assetTypes",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => setTypes(normalizeList(data)),
      onError: () => {
        setRealtimeError("تعذر تحديث أنواع الأصول لحظيًا");
      },
    });

    const unsubscribeFarms = subscribeCachedCollection({
      db,
      collectionName: "farms",
      cacheKey: "cache:farms",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => setFarms(normalizeList(data)),
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات المزارع لحظيًا");
      },
    });

    const unsubscribeKubras = subscribeCachedCollection({
      db,
      collectionName: "kubras",
      cacheKey: "cache:kubras",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => setKubras(normalizeList(data)),
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الكِبر لحظيًا");
      },
    });

    const unsubscribeWorkers = subscribeCachedCollection({
      db,
      collectionName: "workers",
      cacheKey: "cache:workers",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => {
        setWorkers(normalizeList(data));
        setMetaLoading(false);
      },
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات العمال لحظيًا");
        setMetaLoading(false);
      },
    });

    return () => {
      unsubscribeAssets?.();
      unsubscribeTypes?.();
      unsubscribeFarms?.();
      unsubscribeKubras?.();
      unsubscribeWorkers?.();
    };
  }, []);

  const stats = useMemo(() => calculateAssetsStats(allItems), [allItems]);

  useEffect(() => {
    const q = router.query;

    setFilters({
      status: q.status ? String(q.status) : "",
      assetTypeId: q.assetTypeId ? String(q.assetTypeId) : "",
      placeType: q.placeType ? String(q.placeType) : "",
      farmId: q.farmId ? String(q.farmId) : "",
      kubraId: q.kubraId ? String(q.kubraId) : "",
      workerId: q.workerId ? String(q.workerId) : "",
      category: q.category ? String(q.category) : "",
    });

    setCurrentPage(1);
  }, [router.query]);

  const setFilter = (key, value) => {
    setCurrentPage(1);

    const next = {
      ...router.query,
      [key]: value,
    };

    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k];
    });

    router.push({
      pathname: "/assets",
      query: next,
    });
  };

  const clearFilters = () => {
    setSearch("");
    setCurrentPage(1);
    router.push("/assets");
  };

  const filtered = useMemo(
    () =>
      allItems.filter((asset) => {
        const haystack = `
          ${asset.name || ""}
          ${getAssetTypeName(asset)}
          ${getPlaceName(asset)}
          ${asset.workerNames || ""}
          ${asset.code || ""}
          ${asset.status || ""}
          ${asset.category || ""}
        `.toLowerCase();

        return (
          (!filters.category ||
            (asset.category || "asset") === filters.category) &&
          (!filters.status || asset.status === filters.status) &&
          (!filters.assetTypeId || asset.assetTypeId === filters.assetTypeId) &&
          (!filters.placeType || asset.placeType === filters.placeType) &&
          (!filters.farmId ||
            asset.farmId === filters.farmId ||
            asset.placeId === filters.farmId) &&
          (!filters.kubraId ||
            asset.kubraId === filters.kubraId ||
            asset.placeId === filters.kubraId) &&
          (!filters.workerId ||
            (asset.workerIds || []).includes(filters.workerId)) &&
          (!search || haystack.includes(search.toLowerCase()))
        );
      }),
    [allItems, filters, search]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    return filtered.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filtered, currentPage]);

  const remove = async (id) => {
    if (!canManage) return;

    if (!confirm("هل تريد حذف الأصل؟")) return;

    const target = allItems.find((item) => item.id === id);

    removeAssetFromCache(id);
    setAllItems((prev) => prev.filter((item) => item.id !== id));

    if (paginatedItems.length === 1 && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "assets",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف أصل",
          name: target?.name || "",
        },
      });

      alert("تم حذف الأصل محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "assets", id));
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "assets",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف أصل",
          name: target?.name || "",
        },
      });

      alert("تعذر الاتصال، تم حفظ عملية الحذف وسيتم تنفيذها عند عودة الاتصال");
    }
  };

  const quick = [
    { label: "الكل", count: stats.total, key: "", value: "" },
    { label: "صالح", count: stats.good, key: "status", value: "صالح" },
    { label: "عاطل", count: stats.broken, key: "status", value: "عاطل" },
    {
      label: "في الورشة",
      count: stats.inWorkshop,
      key: "status",
      value: "في الورشة",
    },
    { label: "معدات", count: stats.equipment, key: "category", value: "asset" },
    {
      label: "قطع غيار",
      count: stats.spareParts,
      key: "category",
      value: "spare_part",
    },
    { label: "أدوات", count: stats.tools, key: "category", value: "tool" },
    {
      label: "مواد",
      count: stats.materials,
      key: "category",
      value: "material",
    },
    {
      label: "داخل المزارع",
      count: stats.inFarms,
      key: "placeType",
      value: "farm",
    },
    {
      label: "داخل الكِبر",
      count: stats.inKubras,
      key: "placeType",
      value: "kubra",
    },
    {
      label: "في الورش",
      count: stats.inExternalWorkshops,
      key: "placeType",
      value: "external_workshop",
    },
  ];

  const isQuickActive = (q) => {
    if (!q.key) return !Object.values(filters).some(Boolean);
    return filters[q.key] === q.value;
  };

  const categoryLabel = (category) => {
    if (category === "spare_part") return "قطعة غيار";
    if (category === "tool") return "أداة";
    if (category === "material") return "مواد";
    return "معدة";
  };

  const isLoading = initialLoading || metaLoading;

  return (
    <ProtectedRoute>
      <Layout title="إدارة الأصول والعهد">
        {isLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الأصول..."
            subtitle="يتم تجهيز بيانات الأصول والفلاتر"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {quick.map((q) => (
                  <button
                    key={q.label}
                    onClick={() =>
                      q.key ? setFilter(q.key, q.value) : clearFilters()
                    }
                    className={`btn-secondary ${
                      isQuickActive(q) ? "!bg-slate-900 !text-white" : ""
                    }`}
                  >
                    {q.label} {q.count}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={clearFilters} className="btn-secondary">
                  <FontAwesomeIcon icon={faBroom} />
                  مسح الفلاتر
                </button>

                <button
                  onClick={() => setView(view === "table" ? "grid" : "table")}
                  className="btn-secondary"
                >
                  <FontAwesomeIcon
                    icon={view === "table" ? faTableCells : faTableList}
                  />
                  {view === "table" ? "عرض كروت" : "عرض جدول"}
                </button>

                {canManage && (
                  <Link href="/assets/add" className="btn-primary">
                    <FontAwesomeIcon icon={faPlus} />
                    إضافة أصل
                  </Link>
                )}
              </div>
            </div>

            <div className="page-card mb-4 grid gap-3 p-3 lg:grid-cols-7">
              <div className="flex items-center gap-2 lg:col-span-2">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-slate-400"
                />

                <input
                  className="w-full bg-transparent p-2 outline-none"
                  placeholder="بحث باسم الأصل أو النوع أو المكان أو العامل"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select
                className="form-input"
                value={filters.category}
                onChange={(e) => setFilter("category", e.target.value)}
              >
                <option value="">كل التصنيفات</option>
                <option value="asset">معدات</option>
                <option value="spare_part">قطع غيار</option>
                <option value="tool">أدوات</option>
                <option value="material">مواد</option>
              </select>

              <select
                className="form-input"
                value={filters.assetTypeId}
                onChange={(e) => setFilter("assetTypeId", e.target.value)}
              >
                <option value="">كل الأنواع</option>

                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.farmId}
                onChange={(e) => setFilter("farmId", e.target.value)}
              >
                <option value="">كل المزارع</option>

                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.kubraId}
                onChange={(e) => setFilter("kubraId", e.target.value)}
              >
                <option value="">كل الكِبر</option>

                {kubras.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.workerId}
                onChange={(e) => setFilter("workerId", e.target.value)}
              >
                <option value="">كل العمال</option>

                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filtered.length}
            </div>

            {view === "table" ? (
              <div className="page-card overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-th">الصورة</th>
                      <th className="table-th">الأصل</th>
                      <th className="table-th">التصنيف</th>
                      <th className="table-th">نوع الأصل</th>
                      <th className="table-th">المكان الحالي</th>
                      <th className="table-th">العمال</th>
                      <th className="table-th">الحالة</th>
                      <th className="table-th">إجراءات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedItems.map((asset) => (
                      <tr
                        className="clickable-row border-t border-slate-100"
                        key={asset.id}
                      >
                        <td className="table-td">
                          {asset.imageUrl ? (
                            <button onClick={() => setPreview(asset)}>
                              <img
                                src={asset.imageUrl}
                                alt={asset.name}
                                className="h-16 w-24 rounded-2xl object-cover ring-1 ring-slate-200"
                              />
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="table-td">
                          <Link href={`/assets/${asset.id}`}>
                            <b>{asset.name}</b>

                            {asset.syncStatus === "pending" && (
                              <span className="mr-2 rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                                قيد المزامنة
                              </span>
                            )}

                            <p className="text-xs text-slate-400">
                              {asset.code || ""}
                            </p>
                          </Link>
                        </td>

                        <td className="table-td">
                          <span className="badge bg-purple-50 text-purple-700">
                            {categoryLabel(asset.category)}
                          </span>
                        </td>

                        <td className="table-td">
                          {asset.assetTypeId ? (
                            <Link
                              href={`/assets?assetTypeId=${asset.assetTypeId}`}
                            >
                              {getAssetTypeName(asset)}
                            </Link>
                          ) : (
                            getAssetTypeName(asset)
                          )}
                        </td>

                        <td className="table-td">
                          <Link
                            href={
                              asset.placeType === "kubra"
                                ? `/assets?kubraId=${
                                    asset.kubraId || asset.placeId
                                  }`
                                : asset.placeType === "external_workshop"
                                ? `/assets?placeType=external_workshop`
                                : `/assets?farmId=${asset.farmId || asset.placeId}`
                            }
                          >
                            <b>{getPlaceName(asset)}</b>
                            <p className="text-xs text-slate-400">
                              {getPlaceTypeLabel(asset.placeType)}
                            </p>
                          </Link>
                        </td>

                        <td className="table-td max-w-xs overflow-hidden text-ellipsis">
                          {asset.workerNames || "-"}
                        </td>

                        <td className="table-td">
                          <Link
                            href={`/assets?status=${asset.status}`}
                            className={`badge ${badgeClass(asset.status)}`}
                          >
                            {asset.status}
                          </Link>
                        </td>

                        <td className="table-td">
                          <div className="flex gap-2">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="btn-secondary !p-2"
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </Link>

                            {canManage && (
                              <>
                                <Link
                                  href={`/assets/move/${asset.id}`}
                                  className="btn-secondary !p-2"
                                >
                                  <FontAwesomeIcon icon={faRightLeft} />
                                </Link>

                                <Link
                                  href={`/assets/edit/${asset.id}`}
                                  className="btn-secondary !p-2"
                                >
                                  <FontAwesomeIcon icon={faPen} />
                                </Link>

                                <button
                                  onClick={() => remove(asset.id)}
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

                    {filtered.length === 0 && (
                      <tr>
                        <td className="table-td text-center" colSpan="8">
                          لا توجد أصول مطابقة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedItems.map((asset) => (
                  <div key={asset.id} className="page-card overflow-hidden">
                    <button
                      onClick={() => asset.imageUrl && setPreview(asset)}
                      className="block h-44 w-full bg-slate-100"
                    >
                      {asset.imageUrl ? (
                        <img
                          src={asset.imageUrl}
                          className="h-full w-full object-cover"
                          alt={asset.name}
                        />
                      ) : null}
                    </button>

                    <div className="p-4">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="text-lg font-black"
                      >
                        {asset.name}
                      </Link>

                      {asset.syncStatus === "pending" && (
                        <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                          قيد المزامنة
                        </span>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge bg-purple-50 text-purple-700">
                          {categoryLabel(asset.category)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {getAssetTypeName(asset)} - {getPlaceName(asset)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`badge ${badgeClass(asset.status)}`}>
                          {asset.status}
                        </span>

                        <span className="badge bg-slate-100 text-slate-600">
                          {getPlaceTypeLabel(asset.placeType)}
                        </span>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="btn-secondary"
                        >
                          عرض
                        </Link>

                        {canManage && (
                          <Link
                            href={`/assets/move/${asset.id}`}
                            className="btn-secondary"
                          >
                            نقل
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filtered.length === 0 && (
                  <div className="page-card p-5 text-center font-bold text-slate-500 md:col-span-2 xl:col-span-3">
                    لا توجد أصول مطابقة
                  </div>
                )}
              </div>
            )}

            {filtered.length > PAGE_SIZE && (
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
            )}

            {preview && (
              <div
                onClick={() => setPreview(null)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-black">{preview.name}</h3>

                    <button
                      className="btn-secondary !py-2"
                      onClick={() => setPreview(null)}
                    >
                      إغلاق
                    </button>
                  </div>

                  <img
                    src={preview.imageUrl}
                    alt={preview.name}
                    className="max-h-[75vh] w-full rounded-2xl object-contain"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

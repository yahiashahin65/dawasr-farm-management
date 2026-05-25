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
import {
  badgeClass,
  getAssetCategoryLabel,
  getPlaceTypeLabel,
} from "../../lib/inventory";

const PAGE_SIZE = 10;

const movementTypeLabel = (type) => {
  if (type === "created") return "تسجيل أول مكان";
  if (type === "transfer") return "نقل";
  if (type === "moved") return "نقل";
  if (type === "maintenance") return "ورشة / صيانة";
  return type || "-";
};

export default function AssetMovements() {
  const [movements, setMovements] = useState([]);
  const [assets, setAssets] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageCursors, setPageCursors] = useState({ 1: null });

  const [filters, setFilters] = useState({
    movementType: "",
    status: "",
    placeType: "",
    category: "",
  });

  const [search, setSearch] = useState("");

  const loadAssets = async () => {
    const snap = await getDocs(collection(db, "assets"));

    setAssets(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  const loadMovementsPage = async (
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

      let snap;

      try {
        snap = await getDocs(
          query(collection(db, "assetMovements"), ...constraints)
        );
      } catch {
        snap = await getDocs(collection(db, "assetMovements"));
      }

      const docs = snap.docs;
      const visibleDocs = docs.slice(0, PAGE_SIZE);

      setMovements(
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
        await Promise.all([
          loadAssets(),
          loadMovementsPage(1, null, false),
        ]);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const assetMap = useMemo(() => {
    const map = {};

    assets.forEach((asset) => {
      map[asset.id] = asset;
    });

    return map;
  }, [assets]);

  const filtered = useMemo(() => {
    return movements.filter((movement) => {
      const asset = assetMap[movement.assetId];
      const category = movement.category || asset?.category || "asset";
      const status = movement.status || asset?.status || "";

      const text = `
        ${movement.assetName || ""}
        ${movement.fromPlaceName || ""}
        ${movement.toPlaceName || ""}
        ${movement.reason || ""}
      `.toLowerCase();

      return (
        (!filters.movementType ||
          movement.movementType === filters.movementType) &&
        (!filters.status || status === filters.status) &&
        (!filters.placeType || movement.toPlaceType === filters.placeType) &&
        (!filters.category || category === filters.category) &&
        (!search || text.includes(search.toLowerCase()))
      );
    });
  }, [movements, assetMap, filters, search]);

  return (
    <ProtectedRoute pageLoading={initialLoading}>
      <Layout title="سجل الحركات">
        <div className="page-card mb-4 grid gap-3 p-3 lg:grid-cols-5">
          <input
            className="form-input"
            placeholder="بحث باسم الأصل أو المكان أو السبب"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="form-input"
            value={filters.movementType}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                movementType: e.target.value,
              }))
            }
          >
            <option value="">كل الحركات</option>
            <option value="created">تسجيل أول مكان</option>
            <option value="transfer">نقل</option>
            <option value="moved">نقل قديم</option>
            <option value="maintenance">ورشة / صيانة</option>
          </select>

          <select
            className="form-input"
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="">كل الحالات</option>
            <option value="صالح">صالح</option>
            <option value="عاطل">عاطل</option>
            <option value="في الورشة">في الورشة</option>
          </select>

          <select
            className="form-input"
            value={filters.placeType}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, placeType: e.target.value }))
            }
          >
            <option value="">كل الأماكن</option>
            <option value="farm">مزرعة</option>
            <option value="kubra">كِبرة</option>
            <option value="external_workshop">ورشة خارجية</option>
          </select>

          <select
            className="form-input"
            value={filters.category}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, category: e.target.value }))
            }
          >
            <option value="">كل التصنيفات</option>
            <option value="asset">معدة</option>
            <option value="spare_part">قطعة غيار</option>
            <option value="tool">أداة</option>
            <option value="material">مواد</option>
          </select>
        </div>

        {pageLoading && (
          <div className="page-card mb-4 p-4 text-center font-bold text-slate-500">
            جاري تحميل البيانات...
          </div>
        )}

        <div className="mb-3 text-sm font-bold text-slate-500">
          عدد الحركات في هذه الصفحة: {filtered.length}
        </div>

        <div className="page-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">الأصل</th>
                <th className="table-th">نوع الحركة</th>
                <th className="table-th">التصنيف</th>
                <th className="table-th">من</th>
                <th className="table-th">إلى</th>
                <th className="table-th">نوع المكان</th>
                <th className="table-th">الحالة</th>
                <th className="table-th">السبب</th>
                <th className="table-th">التاريخ</th>
                <th className="table-th">عرض</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((movement) => {
                const asset = assetMap[movement.assetId];
                const category = movement.category || asset?.category || "asset";
                const status = movement.status || asset?.status || "-";

                return (
                  <tr key={movement.id} className="border-t border-slate-100">
                    <td className="table-td font-bold">
                      {movement.assetName || asset?.name || "-"}
                    </td>

                    <td className="table-td">
                      {movementTypeLabel(movement.movementType)}
                    </td>

                    <td className="table-td">
                      <span className="badge bg-purple-50 text-purple-700">
                        {getAssetCategoryLabel(category)}
                      </span>
                    </td>

                    <td className="table-td">{movement.fromPlaceName || "-"}</td>
                    <td className="table-td">{movement.toPlaceName || "-"}</td>
                    <td className="table-td">
                      {getPlaceTypeLabel(movement.toPlaceType)}
                    </td>

                    <td className="table-td">
                      <span className={`badge ${badgeClass(status)}`}>
                        {status}
                      </span>
                    </td>

                    <td className="table-td">{movement.reason || "-"}</td>

                    <td className="table-td">
                      {movement.movedAt?.toDate
                        ? movement.movedAt.toDate().toLocaleString("ar-EG")
                        : movement.createdAt?.toDate
                        ? movement.createdAt.toDate().toLocaleString("ar-EG")
                        : "-"}
                    </td>

                    <td className="table-td">
                      {movement.assetId ? (
                        <Link
                          href={`/assets/${movement.assetId}`}
                          className="btn-secondary !py-2"
                        >
                          الأصل
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="table-td text-center" colSpan="10">
                    لا توجد حركات مطابقة
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
              loadMovementsPage(
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
              loadMovementsPage(currentPage + 1, pageCursors[currentPage + 1])
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

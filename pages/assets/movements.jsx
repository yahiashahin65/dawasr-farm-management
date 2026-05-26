import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import { db } from "../../lib/firebase";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

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
  const [currentPage, setCurrentPage] = useState(1);

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

  const loadMovements = async () => {
    let snap;

    try {
      snap = await getDocs(
        query(collection(db, "assetMovements"), orderBy("createdAt", "desc"))
      );
    } catch {
      snap = await getDocs(collection(db, "assetMovements"));
    }

    setMovements(
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
        await Promise.all([loadAssets(), loadMovements()]);
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
    const keyword = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const asset = assetMap[movement.assetId];

      const category = movement.category || asset?.category || "asset";
      const status = movement.status || asset?.status || "";

      const text = `
        ${movement.assetName || ""}
        ${asset?.name || ""}
        ${movement.fromPlaceName || ""}
        ${movement.toPlaceName || ""}
        ${movement.reason || ""}
        ${category || ""}
        ${status || ""}
      `.toLowerCase();

      return (
        (!filters.movementType ||
          movement.movementType === filters.movementType) &&
        (!filters.status || status === filters.status) &&
        (!filters.placeType || movement.toPlaceType === filters.placeType) &&
        (!filters.category || category === filters.category) &&
        (!keyword || text.includes(keyword))
      );
    });
  }, [movements, assetMap, filters, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;

  const paginatedMovements = useMemo(() => {
    return filtered.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filtered, currentPage]);

  const updateFilter = (key, value) => {
    setCurrentPage(1);

    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <ProtectedRoute>
      <Layout title="سجل الحركات">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل سجل الحركات..."
            subtitle="يتم تجهيز بيانات الحركات والأصول"
          />
        ) : (
          <>
            <div className="page-card mb-4 grid gap-3 p-3 lg:grid-cols-5">
              <input
                className="form-input"
                placeholder="بحث باسم الأصل أو المكان أو السبب"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />

              <select
                className="form-input"
                value={filters.movementType}
                onChange={(e) => updateFilter("movementType", e.target.value)}
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
                onChange={(e) => updateFilter("status", e.target.value)}
              >
                <option value="">كل الحالات</option>
                <option value="صالح">صالح</option>
                <option value="عاطل">عاطل</option>
                <option value="في الورشة">في الورشة</option>
              </select>

              <select
                className="form-input"
                value={filters.placeType}
                onChange={(e) => updateFilter("placeType", e.target.value)}
              >
                <option value="">كل الأماكن</option>
                <option value="farm">مزرعة</option>
                <option value="kubra">كِبرة</option>
                <option value="external_workshop">ورشة خارجية</option>
              </select>

              <select
                className="form-input"
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
              >
                <option value="">كل التصنيفات</option>
                <option value="asset">معدة</option>
                <option value="spare_part">قطعة غيار</option>
                <option value="tool">أداة</option>
                <option value="material">مواد</option>
              </select>
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض: {paginatedMovements.length} من إجمالي النتائج{" "}
              {filtered.length}
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
                  {paginatedMovements.map((movement) => {
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

                        <td className="table-td">
                          {movement.fromPlaceName || "-"}
                        </td>

                        <td className="table-td">
                          {movement.toPlaceName || "-"}
                        </td>

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

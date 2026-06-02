import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { db } from "../../lib/firebase";
import { subscribeCachedCollection } from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

import {
  badgeClass,
  getAssetCategoryLabel,
  getAssetTypeName,
} from "../../lib/inventory";

const vehicleStatusLabel = (status) => {
  if (status === "in_workshop") return "في الورشة";
  if (status === "repaired_unpaid") return "تم الإصلاح وعليه فاتورة";
  if (status === "repaired_paid") return "تم الإصلاح والفاتورة مسددة";
  return "سليمة";
};

const vehicleStatusClass = (status) => {
  if (status === "in_workshop") return "bg-amber-50 text-amber-700";
  if (status === "repaired_unpaid") return "bg-red-50 text-red-700";
  if (status === "repaired_paid") return "bg-blue-50 text-blue-700";
  return "bg-green-50 text-green-700";
};

export default function WorkshopAssets() {
  const [assets, setAssets] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");

  useEffect(() => {
    const unsubscribeAssets = subscribeCachedCollection({
      db,
      collectionName: "assets",
      cacheKey: "cache:assets",
      orderField: "updatedAt",
      orderDirection: "desc",
      onData: setAssets,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات أصول الورش لحظيًا");
      },
    });

    const unsubscribeVehicles = subscribeCachedCollection({
      db,
      collectionName: "vehicles",
      cacheKey: "cache:vehicles",
      orderField: "updatedAt",
      orderDirection: "desc",
      onData: setVehicles,
    });

    return () => {
      unsubscribeAssets?.();
      unsubscribeVehicles?.();
    };
  }, []);

  const workshopAssets = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const isWorkshop =
        asset.placeType === "external_workshop" ||
        asset.status === "في الورشة";

      if (!isWorkshop) return false;

      const text = `
        ${asset.name || ""}
        ${asset.code || ""}
        ${asset.externalWorkshopName || ""}
        ${asset.placeName || ""}
        ${asset.assetTypeName || ""}
        ${asset.workerNames || ""}
      `.toLowerCase();

      return !keyword || text.includes(keyword);
    });
  }, [assets, search]);

  const workshopVehicles = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const isWorkshop =
        vehicle.status === "in_workshop" ||
        vehicle.status === "repaired_unpaid";

      if (!isWorkshop) return false;

      const text = `
        ${vehicle.name || ""}
        ${vehicle.plateLetters || ""}
        ${vehicle.plateNumbers || ""}
        ${vehicle.workshopName || ""}
        ${vehicle.assignedToName || ""}
        ${vehicle.farmName || ""}
      `.toLowerCase();

      return !keyword || text.includes(keyword);
    });
  }, [vehicles, search]);

  const workshopGroups = useMemo(() => {
    const groups = {};

    workshopAssets.forEach((asset) => {
      const name =
        asset.externalWorkshopName ||
        asset.placeName ||
        "ورشة خارجية غير محددة";

      if (!groups[name]) groups[name] = [];

      groups[name].push(asset);
    });

    return Object.entries(groups).map(([name, items]) => ({
      name,
      count: items.length,
      items,
    }));
  }, [workshopAssets]);

  return (
    <ProtectedRoute>
      <Layout title="الأصول في الورش الخارجية">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل أصول الورش..."
            subtitle="يتم تجهيز بيانات الأصول والسيارات داخل الورش الخارجية"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="mb-4 grid gap-3 lg:grid-cols-4">
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي الأصول في الورشة
                </p>
                <h3 className="mt-2 text-4xl font-black">
                  {workshopAssets.length}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">عدد الورش</p>
                <h3 className="mt-2 text-4xl font-black">
                  {workshopGroups.length}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  سيارات في الورشة / عليها فاتورة
                </p>
                <h3 className="mt-2 text-4xl font-black">
                  {workshopVehicles.length}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">فلترة</p>
                <input
                  className="form-input mt-2"
                  placeholder="بحث باسم الأصل أو السيارة أو الورشة أو اللوحة"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* السيارات */}
            <div className="page-card mb-4 overflow-x-auto">
              <div className="flex items-center justify-between p-5 pb-3">
                <h3 className="font-black">
                  السيارات داخل الورشة أو التي تم إصلاحها ولم تسدد
                </h3>

                <Link href="/vehicles" className="btn-secondary !py-2">
                  إدارة السيارات
                </Link>
              </div>

              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">السيارة</th>
                    <th className="table-th">اللوحة</th>
                    <th className="table-th">الراكب</th>
                    <th className="table-th">المزرعة</th>
                    <th className="table-th">الحالة</th>
                    <th className="table-th">آخر تكلفة</th>
                    <th className="table-th">عرض</th>
                  </tr>
                </thead>

                <tbody>
                  {workshopVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-t border-slate-100">
                      <td className="table-td font-bold">
                        {vehicle.name || "-"}
                      </td>

                      <td className="table-td">
                        {vehicle.plateLetters || "-"} /{" "}
                        {vehicle.plateNumbers || "-"}
                      </td>

                      <td className="table-td">
                        {vehicle.assignedToName || "-"}
                      </td>

                      <td className="table-td">{vehicle.farmName || "-"}</td>

                      <td className="table-td">
                        <span
                          className={`badge ${vehicleStatusClass(
                            vehicle.status
                          )}`}
                        >
                          {vehicleStatusLabel(vehicle.status)}
                        </span>
                      </td>

                      <td className="table-td">
                        {vehicle.lastMaintenanceCost
                          ? `${vehicle.lastMaintenanceCost} ريال`
                          : "-"}
                      </td>

                      <td className="table-td">
                        <Link
                          href={`/vehicles/${vehicle.id}`}
                          className="btn-secondary !py-2"
                        >
                          التفاصيل
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {workshopVehicles.length === 0 && (
                <div className="p-8 text-center text-sm font-bold text-slate-500">
                  لا توجد سيارات في الورشة أو عليها فواتير حاليًا
                </div>
              )}
            </div>

            {/* العرض القديم الخاص بالأصول كما هو */}
            <div className="grid gap-4">
              {workshopGroups.map((group) => (
                <div key={group.name} className="page-card overflow-x-auto">
                  <div className="flex items-center justify-between p-5 pb-3">
                    <h3 className="font-black">{group.name}</h3>

                    <span className="badge bg-blue-50 text-blue-700">
                      {group.count} أصل
                    </span>
                  </div>

                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="table-th">الأصل</th>
                        <th className="table-th">التصنيف</th>
                        <th className="table-th">النوع</th>
                        <th className="table-th">الكود</th>
                        <th className="table-th">الحالة</th>
                        <th className="table-th">العمال</th>
                        <th className="table-th">عرض</th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.items.map((asset) => (
                        <tr key={asset.id} className="border-t border-slate-100">
                          <td className="table-td font-bold">
                            <div className="flex flex-col gap-1">
                              <span>{asset.name || "-"}</span>

                              {asset.syncStatus === "pending" && (
                                <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                                  قيد المزامنة
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="table-td">
                            <span className="badge bg-purple-50 text-purple-700">
                              {getAssetCategoryLabel(asset.category)}
                            </span>
                          </td>

                          <td className="table-td">
                            {getAssetTypeName(asset)}
                          </td>

                          <td className="table-td">{asset.code || "-"}</td>

                          <td className="table-td">
                            <span className={`badge ${badgeClass(asset.status)}`}>
                              {asset.status || "-"}
                            </span>
                          </td>

                          <td className="table-td">
                            {asset.workerNames || "-"}
                          </td>

                          <td className="table-td">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="btn-secondary !py-2"
                            >
                              التفاصيل
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {workshopGroups.length === 0 && (
                <div className="page-card p-5 text-center text-sm font-bold text-slate-500">
                  لا توجد أصول في الورشة حاليًا
                </div>
              )}
            </div>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

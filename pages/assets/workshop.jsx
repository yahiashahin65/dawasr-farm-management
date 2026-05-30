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

export default function WorkshopAssets() {
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({
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

    return () => unsubscribe?.();
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

  const workshopGroups = useMemo(() => {
    const groups = {};

    workshopAssets.forEach((asset) => {
      const name =
        asset.externalWorkshopName ||
        asset.placeName ||
        "ورشة خارجية غير محددة";

      if (!groups[name]) {
        groups[name] = [];
      }

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
            subtitle="يتم تجهيز بيانات الأصول داخل الورش الخارجية"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="mb-4 grid gap-3 lg:grid-cols-3">
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي في الورشة
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
                <p className="text-sm font-bold text-slate-500">فلترة</p>

                <input
                  className="form-input mt-2"
                  placeholder="بحث باسم الأصل أو الورشة"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

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

                          <td className="table-td">{getAssetTypeName(asset)}</td>
                          <td className="table-td">{asset.code || "-"}</td>

                          <td className="table-td">
                            <span className={`badge ${badgeClass(asset.status)}`}>
                              {asset.status || "-"}
                            </span>
                          </td>

                          <td className="table-td">{asset.workerNames || "-"}</td>

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

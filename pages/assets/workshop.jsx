import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import {
  badgeClass,
  getAssetCategoryLabel,
  getAssetTypeName,
} from "../../lib/inventory";

const PAGE_SIZE = 10;

export default function WorkshopAssets() {
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadWorkshopAssets = async () => {
    let snap;

    try {
      snap = await getDocs(
        query(collection(db, "assets"), orderBy("updatedAt", "desc"))
      );
    } catch {
      snap = await getDocs(collection(db, "assets"));
    }

    const allAssets = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const workshopOnly = allAssets.filter(
      (asset) =>
        asset.placeType === "external_workshop" ||
        asset.status === "في الورشة"
    );

    setAssets(workshopOnly);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        await loadWorkshopAssets();
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const workshopAssets = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const text = `
        ${asset.name || ""}
        ${asset.code || ""}
        ${asset.externalWorkshopName || ""}
        ${asset.placeName || ""}
        ${asset.assetTypeName || ""}
        ${asset.status || ""}
        ${asset.workerNames || ""}
      `.toLowerCase();

      return !keyword || text.includes(keyword);
    });
  }, [assets, search]);

  const totalPages = Math.ceil(workshopAssets.length / PAGE_SIZE) || 1;

  const paginatedWorkshopAssets = useMemo(() => {
    return workshopAssets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [workshopAssets, page]);

  const workshopGroups = useMemo(() => {
    const groups = {};

    paginatedWorkshopAssets.forEach((asset) => {
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
  }, [paginatedWorkshopAssets]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <ProtectedRoute pageLoading={initialLoading}>
      <Layout title="الأصول في الورش الخارجية">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <div className="page-card p-5">
            <p className="text-sm font-bold text-slate-500">إجمالي في الورشة</p>
            <h3 className="mt-2 text-4xl font-black">
              {workshopAssets.length}
            </h3>
          </div>

          <div className="page-card p-5">
            <p className="text-sm font-bold text-slate-500">عدد الورش</p>
            <h3 className="mt-2 text-4xl font-black">
              {
                new Set(
                  workshopAssets.map(
                    (asset) =>
                      asset.externalWorkshopName ||
                      asset.placeName ||
                      "ورشة خارجية غير محددة"
                  )
                ).size
              }
            </h3>
          </div>

          <div className="page-card p-5">
            <p className="text-sm font-bold text-slate-500">فلترة</p>
            <input
              className="form-input mt-2"
              placeholder="بحث باسم الأصل أو الورشة أو العامل"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-3 text-sm font-bold text-slate-500">
          المعروض: {paginatedWorkshopAssets.length} من {workshopAssets.length}
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
                      <td className="table-td font-bold">{asset.name}</td>

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

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={page === 1}
            onClick={() => setPage((prev) => prev - 1)}
            className="btn-secondary disabled:opacity-50"
          >
            السابق
          </button>

          <span className="font-bold text-slate-700">
            صفحة {page} من {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="btn-secondary disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

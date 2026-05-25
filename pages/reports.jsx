import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";
import { calculateAssetsStats } from "../lib/assetsStats";
import {
  badgeClass,
  getAssetTypeName,
  getPlaceName,
  normalizeList,
  getAssetCategoryLabel,
  getPlaceTypeLabel,
} from "../lib/inventory";

function Section({ title, children }) {
  return (
    <div className="page-card p-4">
      <h3 className="mb-3 font-black">{title}</h3>
      {children}
    </div>
  );
}

function RowList({ rows }) {
  return (
    <div className="space-y-2">
      {rows.length ? (
        rows.map((row) => (
          <Link
            key={row.href + row.label}
            href={row.href}
            className="flex items-center justify-between rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"
          >
            <span className="font-bold text-slate-700">{row.label}</span>
            <span className="badge bg-slate-100 text-slate-700">
              {row.count}
            </span>
          </Link>
        ))
      ) : (
        <p className="text-sm text-slate-400">لا توجد بيانات</p>
      )}
    </div>
  );
}

function HeapReportList({ rows }) {
  return (
    <div className="space-y-2">
      {rows.length ? (
        rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"
          >
            <span className="font-bold text-slate-700">{row.label}</span>

            <div className="flex gap-2">
              <span className="badge bg-slate-100 text-slate-700">
                {row.count} كوم
              </span>
              <span className="badge bg-green-50 text-green-700">
                {row.bricks} لبنة
              </span>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-400">لا توجد بيانات</p>
      )}
    </div>
  );
}

export default function Reports() {
  const [assets, setAssets] = useState([]);
  const [types, setTypes] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [heaps, setHeaps] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        const [a, t, f, k, w, h] = await Promise.all([
          getDocs(collection(db, "assets")),
          getDocs(collection(db, "assetTypes")),
          getDocs(collection(db, "farms")),
          getDocs(collection(db, "kubras")),
          getDocs(collection(db, "workers")),
          getDocs(collection(db, "heaps")),
        ]);

        setAssets(a.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTypes(normalizeList(t.docs));
        setFarms(normalizeList(f.docs));
        setKubras(normalizeList(k.docs));
        setWorkers(normalizeList(w.docs));
        setHeaps(h.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const stats = useMemo(() => calculateAssetsStats(assets), [assets]);

  const heapStats = useMemo(() => {
    const totalHeaps = heaps.length;

    const totalBricks = heaps.reduce(
      (sum, item) => sum + Number(item.bricksCount || 0),
      0
    );

    const byFarmMap = {};
    const bySprinklerMap = {};
    const byCropTypeMap = {};

    heaps.forEach((heap) => {
      const farmName = heap.farmName || "غير محدد";
      const sprinklerName = heap.sprinklerName || "غير محدد";
      const cropType = heap.cropType || "غير محدد";
      const bricks = Number(heap.bricksCount || 0);

      if (!byFarmMap[farmName]) {
        byFarmMap[farmName] = { label: farmName, count: 0, bricks: 0 };
      }
      byFarmMap[farmName].count += 1;
      byFarmMap[farmName].bricks += bricks;

      if (!bySprinklerMap[sprinklerName]) {
        bySprinklerMap[sprinklerName] = {
          label: sprinklerName,
          count: 0,
          bricks: 0,
        };
      }
      bySprinklerMap[sprinklerName].count += 1;
      bySprinklerMap[sprinklerName].bricks += bricks;

      if (!byCropTypeMap[cropType]) {
        byCropTypeMap[cropType] = { label: cropType, count: 0, bricks: 0 };
      }
      byCropTypeMap[cropType].count += 1;
      byCropTypeMap[cropType].bricks += bricks;
    });

    return {
      totalHeaps,
      totalBricks,
      byFarm: Object.values(byFarmMap).sort((a, b) => b.bricks - a.bricks),
      bySprinkler: Object.values(bySprinklerMap).sort(
        (a, b) => b.bricks - a.bricks
      ),
      byCropType: Object.values(byCropTypeMap).sort(
        (a, b) => b.bricks - a.bricks
      ),
      latest: [...heaps].slice(0, 5),
    };
  }, [heaps]);

  const rowsByStatus = [
    { label: "صالح", count: stats.good, href: "/assets?status=صالح" },
    { label: "عاطل", count: stats.broken, href: "/assets?status=عاطل" },
    {
      label: "في الورشة",
      count: stats.inWorkshop,
      href: "/assets?status=في الورشة",
    },
  ];

  const rowsByCategory = [
    { label: "معدات", count: stats.equipment, href: "/assets?category=asset" },
    {
      label: "قطع غيار",
      count: stats.spareParts,
      href: "/assets?category=spare_part",
    },
    { label: "أدوات", count: stats.tools, href: "/assets?category=tool" },
    { label: "مواد", count: stats.materials, href: "/assets?category=material" },
  ];

  const rowsByPlaceType = [
    {
      label: "داخل المزارع",
      count: stats.inFarms,
      href: "/assets?placeType=farm",
    },
    {
      label: "داخل الكِبر",
      count: stats.inKubras,
      href: "/assets?placeType=kubra",
    },
    {
      label: "ورش خارجية",
      count: stats.inExternalWorkshops,
      href: "/assets?placeType=external_workshop",
    },
  ];

  const rowsByType = types
    .map((type) => ({
      label: type.name,
      count: assets.filter((asset) => asset.assetTypeId === type.id).length,
      href: `/assets?assetTypeId=${type.id}`,
    }))
    .sort((a, b) => b.count - a.count);

  const rowsByFarm = farms
    .map((farm) => ({
      label: farm.name,
      count: assets.filter(
        (asset) => asset.farmId === farm.id || asset.placeId === farm.id
      ).length,
      href: `/assets?farmId=${farm.id}`,
    }))
    .sort((a, b) => b.count - a.count);

  const rowsByKubra = kubras
    .map((kubra) => ({
      label: kubra.name,
      count: assets.filter(
        (asset) => asset.kubraId === kubra.id || asset.placeId === kubra.id
      ).length,
      href: `/assets?kubraId=${kubra.id}`,
    }))
    .sort((a, b) => b.count - a.count);

  const rowsByWorker = workers
    .map((worker) => ({
      label: worker.name,
      count: assets.filter((asset) =>
        (asset.workerIds || []).includes(worker.id)
      ).length,
      href: `/assets?workerId=${worker.id}`,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <ProtectedRoute pageLoading={initialLoading}>
      <Layout title="التقارير">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {rowsByStatus.map((row) => (
            <Link key={row.label} href={row.href} className="page-card p-4">
              <p className="text-sm font-bold text-slate-500">{row.label}</p>
              <h3 className="mt-2 text-4xl font-black text-slate-900">
                {row.count}
              </h3>
              <span className={`mt-3 inline-flex badge ${badgeClass(row.label)}`}>
                عرض الأصول
              </span>
            </Link>
          ))}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Link href="/heaps" className="page-card p-4">
            <p className="text-sm font-bold text-slate-500">إجمالي الأكوام</p>
            <h3 className="mt-2 text-4xl font-black text-slate-900">
              {heapStats.totalHeaps}
            </h3>
            <span className="mt-3 inline-flex badge bg-green-50 text-green-700">
              عرض الأكوام
            </span>
          </Link>

          <div className="page-card p-4">
            <p className="text-sm font-bold text-slate-500">إجمالي عدد اللبن</p>
            <h3 className="mt-2 text-4xl font-black text-slate-900">
              {heapStats.totalBricks}
            </h3>
            <span className="mt-3 inline-flex badge bg-slate-100 text-slate-700">
              من الأكوام
            </span>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Section title="حسب التصنيف">
            <RowList rows={rowsByCategory} />
          </Section>

          <Section title="حسب نوع الأصل">
            <RowList rows={rowsByType} />
          </Section>

          <Section title="حسب نوع المكان">
            <RowList rows={rowsByPlaceType} />
          </Section>

          <Section title="حسب المزرعة">
            <RowList rows={rowsByFarm} />
          </Section>

          <Section title="حسب الكِبرة">
            <RowList rows={rowsByKubra} />
          </Section>

          <Section title="حسب العامل">
            <RowList rows={rowsByWorker} />
          </Section>

          <Section title="الأكوام حسب النوع">
            <HeapReportList rows={heapStats.byCropType} />
          </Section>

          <Section title="الأكوام حسب المزرعة">
            <HeapReportList rows={heapStats.byFarm} />
          </Section>

          <Section title="الأكوام حسب الرشاش">
            <HeapReportList rows={heapStats.bySprinkler} />
          </Section>
        </div>

        <div className="page-card mt-4 overflow-x-auto">
          <h3 className="p-4 pb-2 font-black">آخر الأكوام المضافة</h3>

          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">الكوم</th>
                <th className="table-th">النوع</th>
                <th className="table-th">المزرعة</th>
                <th className="table-th">الرشاش</th>
                <th className="table-th">عدد اللبن</th>
              </tr>
            </thead>

            <tbody>
              {heapStats.latest.map((heap) => (
                <tr key={heap.id} className="border-t border-slate-100">
                  <td className="table-td font-bold">
                    <Link href={`/heaps/${heap.id}`}>
                      {heap.pileName || "-"}
                    </Link>
                  </td>
                  <td className="table-td">{heap.cropType || "-"}</td>
                  <td className="table-td">{heap.farmName || "-"}</td>
                  <td className="table-td">{heap.sprinklerName || "-"}</td>
                  <td className="table-td">{heap.bricksCount || 0}</td>
                </tr>
              ))}

              {heapStats.latest.length === 0 && (
                <tr>
                  <td className="table-td text-center" colSpan="5">
                    لا توجد أكوام
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="page-card mt-4 overflow-x-auto">
          <h3 className="p-4 pb-2 font-black">كل الأصول للتدقيق السريع</h3>

          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">الأصل</th>
                <th className="table-th">التصنيف</th>
                <th className="table-th">النوع</th>
                <th className="table-th">المكان</th>
                <th className="table-th">نوع المكان</th>
                <th className="table-th">الحالة</th>
              </tr>
            </thead>

            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-t border-slate-100">
                  <td className="table-td font-bold">
                    <Link href={`/assets/${asset.id}`}>{asset.name}</Link>
                  </td>
                  <td className="table-td">
                    <span className="badge bg-purple-50 text-purple-700">
                      {getAssetCategoryLabel(asset.category)}
                    </span>
                  </td>
                  <td className="table-td">{getAssetTypeName(asset)}</td>
                  <td className="table-td">{getPlaceName(asset)}</td>
                  <td className="table-td">{getPlaceTypeLabel(asset.placeType)}</td>
                  <td className="table-td">
                    <Link
                      href={`/assets?status=${asset.status}`}
                      className={`badge ${badgeClass(asset.status)}`}
                    >
                      {asset.status}
                    </Link>
                  </td>
                </tr>
              ))}

              {assets.length === 0 && (
                <tr>
                  <td className="table-td text-center" colSpan="6">
                    لا توجد أصول
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

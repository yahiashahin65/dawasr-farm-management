import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";
import AppLoader from "../components/AppLoader";

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

const normalizeMovement = (value) => {
  const text = String(value || "").trim();

  if (text.includes("ثلاث") || text.includes("3") || text.includes("تلات")) {
    return "ثلاث أرباع دائري";
  }

  if (text.includes("نصين") || text.includes("نصفين")) return "نصين";
  if (text.includes("نصف") || text.includes("نص")) return "نصف دائري";
  if (text.includes("دائري") || text.includes("دايري")) return "دائري";

  return text || "غير محدد";
};

export default function Reports() {
  const [assets, setAssets] = useState([]);
  const [types, setTypes] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [heaps, setHeaps] = useState([]);
  const [sprinklers, setSprinklers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        const [a, t, f, k, w, h, s] = await Promise.all([
          getDocs(collection(db, "assets")),
          getDocs(collection(db, "assetTypes")),
          getDocs(collection(db, "farms")),
          getDocs(collection(db, "kubras")),
          getDocs(collection(db, "workers")),
          getDocs(collection(db, "heaps")),
          getDocs(collection(db, "sprinklers")),
        ]);

        setAssets(a.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTypes(normalizeList(t.docs));
        setFarms(normalizeList(f.docs));
        setKubras(normalizeList(k.docs));
        setWorkers(normalizeList(w.docs));
        setHeaps(h.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSprinklers(s.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      const sprinklerKey = `${farmName} - ${sprinklerName}`;
      const cropType = heap.cropType || "غير معلوم";
      const bricks = Number(heap.bricksCount || 0);

      if (!byFarmMap[farmName]) {
        byFarmMap[farmName] = { label: farmName, count: 0, bricks: 0 };
      }

      byFarmMap[farmName].count += 1;
      byFarmMap[farmName].bricks += bricks;

      if (!bySprinklerMap[sprinklerKey]) {
        bySprinklerMap[sprinklerKey] = {
          label: sprinklerKey,
          count: 0,
          bricks: 0,
        };
      }

      bySprinklerMap[sprinklerKey].count += 1;
      bySprinklerMap[sprinklerKey].bricks += bricks;

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

  const sprinklerStats = useMemo(() => {
    const byFarmMap = {};
    const byMovementMap = {};
    const byCropTypeMap = {};
    const byWorkerMap = {};
    const workersSet = new Set();
    const farmsSet = new Set();

    sprinklers.forEach((item) => {
      const farmName = item.farmName || "غير محدد";
      const movementType = normalizeMovement(item.movementType);
      const cropType = item.cropType || "غير محدد";
      const workerName = item.workerName || "غير محدد";

      if (item.workerId) workersSet.add(item.workerId);
      else if (item.workerName) workersSet.add(item.workerName);

      if (farmName && farmName !== "غير محدد") {
        farmsSet.add(farmName);
      }

      if (!byFarmMap[farmName]) {
        byFarmMap[farmName] = {
          label: farmName,
          count: 0,
          href: `/sprinklers?farmName=${farmName}`,
        };
      }

      byFarmMap[farmName].count += 1;

      if (!byMovementMap[movementType]) {
        byMovementMap[movementType] = {
          label: movementType,
          count: 0,
          href: "/sprinklers",
        };
      }

      byMovementMap[movementType].count += 1;

      if (!byCropTypeMap[cropType]) {
        byCropTypeMap[cropType] = {
          label: cropType,
          count: 0,
          href: "/sprinklers",
        };
      }

      byCropTypeMap[cropType].count += 1;

      if (!byWorkerMap[workerName]) {
        byWorkerMap[workerName] = {
          label: workerName,
          count: 0,
          href: item.workerId ? `/workers/${item.workerId}` : "/sprinklers",
        };
      }

      byWorkerMap[workerName].count += 1;
    });

    return {
      total: sprinklers.length,
      totalMachines: sprinklers.filter(
        (item) => item.machineName || item.machine
      ).length,
      totalWorkers: workersSet.size,
      totalFarms: farmsSet.size,
      byFarm: Object.values(byFarmMap).sort((a, b) => b.count - a.count),
      byMovement: Object.values(byMovementMap).sort(
        (a, b) => b.count - a.count
      ),
      byCropType: Object.values(byCropTypeMap).sort(
        (a, b) => b.count - a.count
      ),
      byWorker: Object.values(byWorkerMap).sort((a, b) => b.count - a.count),
    };
  }, [sprinklers]);

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
    <ProtectedRoute>
      <Layout title="التقارير">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل التقارير..."
            subtitle="يتم تجهيز بيانات الأصول والأكوام والرشاشات"
          />
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {rowsByStatus.map((row) => (
                <Link key={row.label} href={row.href} className="page-card p-4">
                  <p className="text-sm font-bold text-slate-500">{row.label}</p>
                  <h3 className="mt-2 text-4xl font-black text-slate-900">
                    {row.count}
                  </h3>
                  <span
                    className={`mt-3 inline-flex badge ${badgeClass(row.label)}`}
                  >
                    عرض الأصول
                  </span>
                </Link>
              ))}
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/heaps" className="page-card p-4">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي الأكوام
                </p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {heapStats.totalHeaps}
                </h3>
                <span className="mt-3 inline-flex badge bg-green-50 text-green-700">
                  عرض الأكوام
                </span>
              </Link>

              <div className="page-card p-4">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي عدد اللبن
                </p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {heapStats.totalBricks}
                </h3>
                <span className="mt-3 inline-flex badge bg-slate-100 text-slate-700">
                  من الأكوام
                </span>
              </div>

              <Link href="/sprinklers" className="page-card p-4">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي الرشاشات
                </p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {sprinklerStats.total}
                </h3>
                <span className="mt-3 inline-flex badge bg-blue-50 text-blue-700">
                  عرض الرشاشات
                </span>
              </Link>

              <div className="page-card p-4">
                <p className="text-sm font-bold text-slate-500">عدد المكائن</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {sprinklerStats.totalMachines}
                </h3>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="page-card p-4">
                <p className="text-sm font-bold text-slate-500">
                  عمال الرشاشات
                </p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {sprinklerStats.totalWorkers}
                </h3>
              </div>

              <div className="page-card p-4">
                <p className="text-sm font-bold text-slate-500">
                  مزارع بها رشاشات
                </p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {sprinklerStats.totalFarms}
                </h3>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <Section title="الأصول والعهد حسب التصنيف">
                <RowList rows={rowsByCategory} />
              </Section>

              <Section title="الأصول والعهد حسب نوع الأصل">
                <RowList rows={rowsByType} />
              </Section>

              <Section title="الأصول والعهد حسب نوع المكان">
                <RowList rows={rowsByPlaceType} />
              </Section>

              <Section title="الأصول والعهد حسب المزرعة">
                <RowList rows={rowsByFarm} />
              </Section>

              <Section title="الأصول والعهد حسب الكِبرة">
                <RowList rows={rowsByKubra} />
              </Section>

              <Section title="الأصول والعهد حسب العامل">
                <RowList rows={rowsByWorker} />
              </Section>

              <Section title="الأكوام حسب النوع">
                <HeapReportList rows={heapStats.byCropType} />
              </Section>

              <Section title="الأكوام حسب المزرعة">
                <HeapReportList rows={heapStats.byFarm} />
              </Section>

              <Section title="الأكوام حسب المزرعة والرشاش">
                <HeapReportList rows={heapStats.bySprinkler} />
              </Section>

              <Section title="الرشاشات حسب المزرعة">
                <RowList rows={sprinklerStats.byFarm} />
              </Section>

              <Section title="الرشاشات حسب العامل">
                <RowList rows={sprinklerStats.byWorker} />
              </Section>

              <Section title="الرشاشات حسب حركة الرشاش">
                <RowList rows={sprinklerStats.byMovement} />
              </Section>

              <Section title="الرشاشات حسب نوع المحصول">
                <RowList rows={sprinklerStats.byCropType} />
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
                      <td className="table-td">{heap.cropType || "غير معلوم"}</td>
                      <td className="table-td">{heap.farmName || "-"}</td>
                      <td className="table-td">{heap.sprinklerName || "-"}</td>
                      <td className="table-td">
                        {heap.bricksCount ? heap.bricksCount : "غير محدد"}
                      </td>
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
                      <td className="table-td">
                        {getPlaceTypeLabel(asset.placeType)}
                      </td>
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
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

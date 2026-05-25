import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

import { db } from "../lib/firebase";

import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faTractor,
  faUsers,
  faWheatAwn,
  faCircleCheck,
  faTriangleExclamation,
  faUserTie,
  faWarehouse,
  faLayerGroup,
  faLocationDot,
  faChartPie,
  faScrewdriverWrench,
  faToolbox,
  faBoxesStacked,
  faArrowUpRightDots,
  faSeedling,
  faCubesStacked,
} from "@fortawesome/free-solid-svg-icons";

import { calculateAssetsStats } from "../lib/assetsStats";
import {
  badgeClass,
  getAssetTypeName,
  getPlaceName,
  isAssetWithoutValidType,
  normalizeList,
  getAssetCategoryLabel,
} from "../lib/inventory";

function StatCard({ title, value, href, icon, sub, tone = "green" }) {
  const tones = {
    green: "bg-green-50 text-green-700 group-hover:bg-green-700",
    amber: "bg-amber-50 text-amber-700 group-hover:bg-amber-600",
    red: "bg-red-50 text-red-700 group-hover:bg-red-600",
    slate: "bg-slate-100 text-slate-700 group-hover:bg-slate-900",
    blue: "bg-blue-50 text-blue-700 group-hover:bg-blue-700",
    purple: "bg-purple-50 text-purple-700 group-hover:bg-purple-700",
  };

  return (
    <Link
      href={href}
      className="page-card group p-5 transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <h3 className="mt-2 text-4xl font-black text-slate-900">{value}</h3>
          {sub ? <p className="mt-2 text-xs text-slate-400">{sub}</p> : null}
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone]} group-hover:text-white`}
        >
          <FontAwesomeIcon icon={icon} />
        </div>
      </div>
    </Link>
  );
}

function MiniTable({ title, items, empty = "لا توجد بيانات" }) {
  return (
    <div className="page-card p-5">
      <h3 className="mb-4 font-black">{title}</h3>

      <div className="space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <Link
              key={`${item.label}-${index}`}
              href={item.href}
              className="flex items-center justify-between rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"
            >
              <span className="font-bold text-slate-700">{item.label}</span>
              <span className="badge bg-slate-100 text-slate-700">
                {item.count}
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-slate-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [assets, setAssets] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [farms, setFarms] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [types, setTypes] = useState([]);
  const [movements, setMovements] = useState([]);
  const [heaps, setHeaps] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        const [a, w, f, e, k, t, h, m] = await Promise.all([
          getDocs(query(collection(db, "assets"), orderBy("createdAt", "desc"))),
          getDocs(collection(db, "workers")),
          getDocs(collection(db, "farms")),
          getDocs(collection(db, "engineers")),
          getDocs(collection(db, "kubras")),
          getDocs(collection(db, "assetTypes")),
          getDocs(
            query(collection(db, "heaps"), orderBy("createdAt", "desc"))
          ).catch(() => getDocs(collection(db, "heaps"))),
          getDocs(
            query(
              collection(db, "assetMovements"),
              orderBy("createdAt", "desc"),
              limit(8)
            )
          ).catch(() => getDocs(collection(db, "assetMovements"))),
        ]);

        setAssets(a.docs.map((d) => ({ id: d.id, ...d.data() })));
        setWorkers(normalizeList(w.docs));
        setFarms(normalizeList(f.docs));
        setEngineers(normalizeList(e.docs));
        setKubras(normalizeList(k.docs));
        setTypes(normalizeList(t.docs));
        setHeaps(h.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 20));
        setMovements(
          m.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 8)
        );
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const stats = useMemo(() => calculateAssetsStats(assets), [assets]);

  const validTypeIds = useMemo(() => types.map((type) => type.id), [types]);

  const invalidTypesCount = useMemo(
    () =>
      assets.filter((asset) =>
        isAssetWithoutValidType(asset, validTypeIds)
      ).length,
    [assets, validTypeIds]
  );

  const healthRate = stats.total
    ? Math.round((stats.good / stats.total) * 100)
    : 0;

  const heapStats = useMemo(() => {
    const totalHeaps = heaps.length;
    const totalBricks = heaps.reduce(
      (sum, heap) => sum + Number(heap.bricksCount || 0),
      0
    );

    const byCropTypeMap = {};

    heaps.forEach((heap) => {
      const cropType = heap.cropType || "غير محدد";
      const bricks = Number(heap.bricksCount || 0);

      if (!byCropTypeMap[cropType]) {
        byCropTypeMap[cropType] = {
          label: cropType,
          count: 0,
          href: `/heaps?cropType=${cropType}`,
        };
      }

      byCropTypeMap[cropType].count += bricks;
    });

    return {
      totalHeaps,
      totalBricks,
      byCropType: Object.values(byCropTypeMap).sort(
        (a, b) => b.count - a.count
      ),
      latest: heaps.slice(0, 8),
    };
  }, [heaps]);

  const cards = [
    {
      title: "إجمالي الأصول",
      value: stats.total,
      href: "/assets",
      icon: faBoxesStacked,
      sub: "كل المعدات والعهد",
      tone: "slate",
    },
    {
      title: "إجمالي الأكوام",
      value: heapStats.totalHeaps,
      href: "/heaps",
      icon: faCubesStacked,
      sub: "كل أكوام البرسيم والرودس والتبن",
      tone: "green",
    },
    {
      title: "إجمالي اللبن",
      value: heapStats.totalBricks,
      href: "/heaps",
      icon: faSeedling,
      sub: "عدد اللبن داخل الأكوام",
      tone: "purple",
    },
    {
      title: "المعدات الصالحة",
      value: stats.good,
      href: "/assets?status=صالح",
      icon: faCircleCheck,
      sub: "جاهزة للعمل",
      tone: "green",
    },
    {
      title: "المعدات العاطلة",
      value: stats.broken,
      href: "/assets?status=عاطل",
      icon: faTriangleExclamation,
      sub: "تحتاج متابعة",
      tone: "amber",
    },
    {
      title: "في الورش",
      value: stats.inWorkshop,
      href: "/assets?status=في الورشة",
      icon: faScrewdriverWrench,
      sub: "داخل ورش خارجية",
      tone: "blue",
    },
    {
      title: "معدات",
      value: stats.equipment,
      href: "/assets?category=asset",
      icon: faTractor,
      sub: "كل المعدات",
      tone: "green",
    },
    {
      title: "قطع غيار",
      value: stats.spareParts,
      href: "/assets?category=spare_part",
      icon: faToolbox,
      sub: "المخزون والقطع",
      tone: "purple",
    },
    {
      title: "أدوات",
      value: stats.tools,
      href: "/assets?category=tool",
      icon: faLayerGroup,
      sub: "الأدوات المختلفة",
      tone: "blue",
    },
    {
      title: "داخل المزارع",
      value: stats.inFarms,
      href: "/assets?placeType=farm",
      icon: faWheatAwn,
      sub: "موجودة بالمزارع",
      tone: "green",
    },
    {
      title: "داخل الكِبر",
      value: stats.inKubras,
      href: "/assets?placeType=kubra",
      icon: faWarehouse,
      sub: "موجودة بالكِبر",
      tone: "blue",
    },
    {
      title: "ورش خارجية",
      value: stats.inExternalWorkshops,
      href: "/assets?placeType=external_workshop",
      icon: faScrewdriverWrench,
      sub: "تم إرسالها للصيانة",
      tone: "amber",
    },
    {
      title: "أنواع الأصول",
      value: types.length,
      href: "/asset-types",
      icon: faLayerGroup,
      sub: "إدارة الأنواع",
      tone: "slate",
    },
    {
      title: "بيانات تحتاج تصحيح",
      value: invalidTypesCount,
      href: "/asset-types",
      icon: faTriangleExclamation,
      sub: "أصول بدون نوع صحيح",
      tone: invalidTypesCount > 0 ? "amber" : "green",
    },
    {
      title: "العمال",
      value: workers.length,
      href: "/workers",
      icon: faUsers,
      sub: "كل العمال",
      tone: "blue",
    },
    {
      title: "المزارع",
      value: farms.length,
      href: "/farms",
      icon: faLocationDot,
      sub: "كل المزارع",
      tone: "green",
    },
    {
      title: "المهندسون",
      value: engineers.length,
      href: "/engineers",
      icon: faUserTie,
      sub: "مسئولو المزارع",
      tone: "slate",
    },
    {
      title: "نسبة الجاهزية",
      value: `${healthRate}%`,
      href: "/assets?status=صالح",
      icon: faChartPie,
      sub: "مؤشر سريع لحالة الجرد",
      tone: healthRate >= 70 ? "green" : "amber",
    },
  ];

  const byType = types
    .map((type) => ({
      label: type.name,
      count: assets.filter((asset) => asset.assetTypeId === type.id).length,
      href: `/assets?assetTypeId=${type.id}`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byFarm = farms
    .map((farm) => ({
      label: farm.name,
      count: assets.filter(
        (asset) => asset.farmId === farm.id || asset.placeId === farm.id
      ).length,
      href: `/assets?farmId=${farm.id}`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byKubra = kubras
    .map((kubra) => ({
      label: kubra.name,
      count: assets.filter(
        (asset) => asset.kubraId === kubra.id || asset.placeId === kubra.id
      ).length,
      href: `/assets?kubraId=${kubra.id}`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byWorker = workers
    .map((worker) => ({
      label: worker.name,
      count: assets.filter((asset) =>
        (asset.workerIds || []).includes(worker.id)
      ).length,
      href: `/assets?workerId=${worker.id}`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byCategory = [
    { label: "معدات", count: stats.equipment, href: "/assets?category=asset" },
    {
      label: "قطع غيار",
      count: stats.spareParts,
      href: "/assets?category=spare_part",
    },
    { label: "أدوات", count: stats.tools, href: "/assets?category=tool" },
    { label: "مواد", count: stats.materials, href: "/assets?category=material" },
  ];

  return (
    <ProtectedRoute pageLoading={initialLoading}>
      <Layout title="لوحة التحكم">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          {cards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <MiniTable
            title="الأكوام حسب النوع / عدد اللبن"
            items={heapStats.byCropType}
          />
          <MiniTable title="حسب نوع المعدة" items={byType} />
          <MiniTable title="حسب التصنيف" items={byCategory} />
          <MiniTable title="حسب المزرعة" items={byFarm} />
          <MiniTable title="حسب الكِبرة" items={byKubra} />
          <MiniTable title="حسب العامل" items={byWorker} />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="page-card overflow-x-auto">
            <h3 className="p-5 pb-2 font-black">آخر الأكوام</h3>

            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">الكوم</th>
                  <th className="table-th">النوع</th>
                  <th className="table-th">المزرعة</th>
                  <th className="table-th">عدد اللبن</th>
                </tr>
              </thead>

              <tbody>
                {heapStats.latest.map((heap) => (
                  <tr
                    key={heap.id}
                    className="clickable-row border-t border-slate-100"
                  >
                    <td className="table-td font-bold">
                      <Link href={`/heaps/${heap.id}`}>
                        {heap.pileName || "-"}
                      </Link>
                    </td>
                    <td className="table-td">{heap.cropType || "-"}</td>
                    <td className="table-td">{heap.farmName || "-"}</td>
                    <td className="table-td">{heap.bricksCount || 0}</td>
                  </tr>
                ))}

                {heapStats.latest.length === 0 && (
                  <tr>
                    <td className="table-td text-center" colSpan="4">
                      لا توجد أكوام
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="page-card overflow-x-auto">
            <h3 className="p-5 pb-2 font-black">آخر الأصول المسجلة</h3>

            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">الأصل</th>
                  <th className="table-th">التصنيف</th>
                  <th className="table-th">النوع</th>
                  <th className="table-th">المكان</th>
                  <th className="table-th">الحالة</th>
                </tr>
              </thead>

              <tbody>
                {assets.slice(0, 8).map((asset) => (
                  <tr
                    key={asset.id}
                    className="clickable-row border-t border-slate-100"
                  >
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
                      <Link
                        href={`/assets?status=${asset.status}`}
                        className={`badge ${badgeClass(asset.status)}`}
                      >
                        {asset.status}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="page-card overflow-x-auto xl:col-span-2">
            <h3 className="p-5 pb-2 font-black">آخر الحركات</h3>

            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">الأصل</th>
                  <th className="table-th">من</th>
                  <th className="table-th">إلى</th>
                  <th className="table-th">عرض</th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr
                    key={movement.id}
                    className="clickable-row border-t border-slate-100"
                  >
                    <td className="table-td font-bold">
                      {movement.assetName || "-"}
                    </td>
                    <td className="table-td">{movement.fromPlaceName || "-"}</td>
                    <td className="table-td">{movement.toPlaceName || "-"}</td>
                    <td className="table-td">
                      {movement.assetId ? (
                        <Link
                          className="btn-secondary !py-2"
                          href={`/assets/${movement.assetId}`}
                        >
                          <FontAwesomeIcon icon={faArrowUpRightDots} />
                          التفاصيل
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}

                {movements.length === 0 && (
                  <tr>
                    <td className="table-td text-center" colSpan="4">
                      لا توجد حركات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

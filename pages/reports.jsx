import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";
import {
  badgeClass,
  getAssetTypeName,
  getPlaceName,
  getStatusCounts,
  normalizeList,
  getAssetCategoryLabel,
  getPlaceTypeLabel,
} from "../lib/inventory";

function Section({ title, children }) {
  return (
    <div className="page-card p-5">
      <h3 className="mb-4 font-black">{title}</h3>
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

export default function Reports() {
  const [assets, setAssets] = useState([]);
  const [types, setTypes] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "assets")),
      getDocs(collection(db, "assetTypes")),
      getDocs(collection(db, "farms")),
      getDocs(collection(db, "kubras")),
      getDocs(collection(db, "workers")),
    ]).then(([a, t, f, k, w]) => {
      setAssets(a.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTypes(normalizeList(t.docs));
      setFarms(normalizeList(f.docs));
      setKubras(normalizeList(k.docs));
      setWorkers(normalizeList(w.docs));
    });
  }, []);

  const stats = useMemo(() => getStatusCounts(assets), [assets]);

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
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          {rowsByStatus.map((row) => (
            <Link key={row.label} href={row.href} className="page-card p-5">
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

        <div className="grid gap-4 xl:grid-cols-2">
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
        </div>

        <div className="page-card mt-5 overflow-x-auto">
          <h3 className="p-5 pb-2 font-black">كل الأصول للتدقيق السريع</h3>

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
      </Layout>
    </ProtectedRoute>
  );
}

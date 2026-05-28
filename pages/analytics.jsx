import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

import { db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";
import AppLoader from "../components/AppLoader";
import { calculateAssetsStats } from "../lib/assetsStats";

const COLORS = {
  green: "#16a34a",
  blue: "#2563eb",
  amber: "#f59e0b",
  purple: "#9333ea",
  red: "#dc2626",
  cyan: "#0891b2",
};

const PIE_COLORS = [
  COLORS.green,
  COLORS.blue,
  COLORS.amber,
  COLORS.purple,
  COLORS.red,
  COLORS.cyan,
];

const formatNumber = (value) => {
  const number = Number(value || 0);

  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${Math.round(number / 1000)}K`;

  return number;
};

const toChartRows = (map) =>
  Object.values(map).sort((a, b) => b.value - a.value);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/95 p-4 text-sm shadow-2xl backdrop-blur">
      <p className="mb-2 font-black text-slate-900">{label}</p>

      <div className="space-y-1">
        {payload.map((item, index) => (
          <p
            key={`${item.name}-${index}`}
            className="flex items-center justify-between gap-4 font-bold"
            style={{ color: item.color }}
          >
            <span>{item.name}</span>
            <span>{item.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, color = "green" }) {
  const styles = {
    green: {
      wrapper: "bg-green-50 text-green-700 shadow-green-100",
      icon: "bg-green-600",
    },
    blue: {
      wrapper: "bg-blue-50 text-blue-700 shadow-blue-100",
      icon: "bg-blue-600",
    },
    amber: {
      wrapper: "bg-amber-50 text-amber-700 shadow-amber-100",
      icon: "bg-amber-500",
    },
    purple: {
      wrapper: "bg-purple-50 text-purple-700 shadow-purple-100",
      icon: "bg-purple-600",
    },
  };

  const active = styles[color] || styles.green;

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-100 transition duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-500">{title}</p>

          <h3 className="mt-3 text-4xl font-black text-slate-900">
            {formatNumber(value)}
          </h3>

          <p className="mt-2 text-xs font-bold text-slate-400">{subtitle}</p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${active.wrapper}`}
        >
          <span className={`h-3 w-3 rounded-full ${active.icon}`} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, tall = false }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-100 transition duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="mb-4">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>

        {subtitle ? (
          <p className="mt-1 text-xs font-bold leading-6 text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className={tall ? "min-h-[440px]" : "min-h-[360px]"}>
        {children}
      </div>
    </div>
  );
}

function HorizontalListChart({ items, valueKey = "value", color = "green" }) {
  const barColors = {
    green: "bg-green-600",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    purple: "bg-purple-600",
  };

  const textColors = {
    green: "text-green-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    purple: "text-purple-700",
  };

  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);

  return (
    <div className="space-y-4 pt-2">
      {items.length ? (
        items.map((item) => {
          const value = Number(item[valueKey] || 0);
          const width = Math.max((value / max) * 100, 5);

          return (
            <div key={item.name} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="max-w-[70%] truncate text-sm font-black text-slate-700">
                  {item.name || "-"}
                </span>

                <span
                  className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-black ${
                    textColors[color] || textColors.green
                  }`}
                >
                  {value}
                </span>
              </div>

              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${barColors[color] || barColors.green}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <div className="flex min-h-[260px] items-center justify-center text-sm font-bold text-slate-400">
          لا توجد بيانات
        </div>
      )}
    </div>
  );
}

function WorkerLoadChart({ items }) {
  const max = Math.max(
    ...items.map(
      (item) => Number(item.assets || 0) + Number(item.sprinklers || 0)
    ),
    1
  );

  return (
    <div className="space-y-5 pt-2">
      {items.length ? (
        items.map((item) => {
          const assets = Number(item.assets || 0);
          const sprinklers = Number(item.sprinklers || 0);

          const assetsWidth = assets ? Math.max((assets / max) * 100, 4) : 0;
          const sprinklersWidth = sprinklers
            ? Math.max((sprinklers / max) * 100, 4)
            : 0;

          return (
            <div key={item.name} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="max-w-[70%] truncate text-sm font-black text-slate-700">
                  {item.name}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                  {item.total}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs font-black text-green-700">
                    أصول
                  </span>

                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-green-600"
                      style={{ width: `${assetsWidth}%` }}
                    />
                  </div>

                  <span className="w-8 shrink-0 text-xs font-black text-slate-500">
                    {assets}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs font-black text-blue-700">
                    رشاشات
                  </span>

                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${sprinklersWidth}%` }}
                    />
                  </div>

                  <span className="w-8 shrink-0 text-xs font-black text-slate-500">
                    {sprinklers}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="flex min-h-[260px] items-center justify-center text-sm font-bold text-slate-400">
          لا توجد بيانات
        </div>
      )}
    </div>
  );
}

const normalizeMovement = (value) => {
  const text = String(value || "").trim();

  if (text.includes("ثلاث") || text.includes("3") || text.includes("تلات")) {
    return "ثلاث أرباع";
  }

  if (text.includes("نصين") || text.includes("نصفين")) return "نصين";
  if (text.includes("نصف") || text.includes("نص")) return "نصف دائري";
  if (text.includes("دائري") || text.includes("دايري")) return "دائري";

  return text || "غير محدد";
};

export default function Analytics() {
  const [assets, setAssets] = useState([]);
  const [heaps, setHeaps] = useState([]);
  const [sprinklers, setSprinklers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);

      try {
        const [assetsSnap, heapsSnap, sprinklersSnap, workersSnap] =
          await Promise.all([
            getDocs(collection(db, "assets")),
            getDocs(collection(db, "heaps")),
            getDocs(collection(db, "sprinklers")),
            getDocs(collection(db, "workers")),
          ]);

        setAssets(assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setHeaps(heapsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSprinklers(
          sprinklersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
        setWorkers(workersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, []);

  const stats = useMemo(() => calculateAssetsStats(assets), [assets]);

  const totalMachines = useMemo(
    () => sprinklers.filter((item) => item.machineName || item.machine).length,
    [sprinklers]
  );

  const assetsByStatus = useMemo(
    () => [
      { name: "صالح", value: stats.good },
      { name: "عاطل", value: stats.broken },
      { name: "في الورشة", value: stats.inWorkshop },
    ],
    [stats]
  );

  const assetsByCategory = useMemo(
    () => [
      { name: "معدات", value: stats.equipment },
      { name: "قطع غيار", value: stats.spareParts },
      { name: "أدوات", value: stats.tools },
    ],
    [stats]
  );

  const sprinklersByFarm = useMemo(() => {
    const map = {};

    sprinklers.forEach((item) => {
      const name = item.farmName || "غير محدد";
      if (!map[name]) map[name] = { name, value: 0 };
      map[name].value += 1;
    });

    return toChartRows(map).slice(0, 8);
  }, [sprinklers]);

  const sprinklersByMovement = useMemo(() => {
    const map = {};

    sprinklers.forEach((item) => {
      const name = normalizeMovement(item.movementType);
      if (!map[name]) map[name] = { name, value: 0 };
      map[name].value += 1;
    });

    return toChartRows(map);
  }, [sprinklers]);

  const heapsByCrop = useMemo(() => {
    const map = {};

    heaps.forEach((item) => {
      const name = item.cropType || "غير محدد";
      const bricks = Number(item.bricksCount || 0);

      if (!map[name]) map[name] = { name, value: 0 };
      map[name].value += bricks;
    });

    return toChartRows(map).slice(0, 8);
  }, [heaps]);

  const workerLoad = useMemo(() => {
    return workers
      .map((worker) => {
        const assetsCount = assets.filter((asset) =>
          (asset.workerIds || []).includes(worker.id)
        ).length;

        const sprinklersCount = sprinklers.filter(
          (item) => item.workerId === worker.id
        ).length;

        return {
          name: worker.name || "-",
          assets: assetsCount,
          sprinklers: sprinklersCount,
          total: assetsCount + sprinklersCount,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [workers, assets, sprinklers]);

  const totalsComparison = useMemo(
    () => [
      { name: "الأصول", value: assets.length },
      { name: "الأكوام", value: heaps.length },
      { name: "الرشاشات", value: sprinklers.length },
      { name: "المكائن", value: totalMachines },
    ],
    [assets, heaps, sprinklers, totalMachines]
  );

  return (
    <ProtectedRoute>
      <Layout title="التحليلات">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل التحليلات..."
            subtitle="يتم تجهيز الرسوم البيانية"
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="إجمالي الأصول"
                value={assets.length}
                subtitle="معدات / قطع غيار / أدوات"
                color="green"
              />

              <SummaryCard
                title="إجمالي الأكوام"
                value={heaps.length}
                subtitle="كل الأكوام المسجلة"
                color="amber"
              />

              <SummaryCard
                title="إجمالي الرشاشات"
                value={sprinklers.length}
                subtitle="الرشاشات الموجودة بالمزارع"
                color="blue"
              />

              <SummaryCard
                title="عدد المكائن"
                value={totalMachines}
                subtitle="الرشاشات التي تحتوي على مكينة"
                color="purple"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ChartCard
                title="توزيع المعدات حسب الحالة"
                subtitle="بين صالح وعاطل وفي الورشة"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                    <Pie
                      data={assetsByStatus}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {assetsByStatus.map((_, index) => (
                        <Cell
                          key={index}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip content={<CustomTooltip />} />

                    <Legend
                      verticalAlign="bottom"
                      height={45}
                      wrapperStyle={{ fontSize: 12, fontWeight: 800 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="الأصول حسب التصنيف"
                subtitle="معدات وقطع غيار وأدوات فقط"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={assetsByCategory}
                    margin={{ top: 20, right: 10, left: 5, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      allowDecimals={false}
                      width={45}
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      name="العدد"
                      fill={COLORS.green}
                      radius={[16, 16, 0, 0]}
                      barSize={42}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="الرشاشات حسب المزرعة"
                subtitle="أعلى المزارع حسب عدد الرشاشات"
              >
                <HorizontalListChart
                  items={sprinklersByFarm}
                  valueKey="value"
                  color="blue"
                />
              </ChartCard>

              <ChartCard
                title="الرشاشات حسب حركة الرشاش"
                subtitle="دائري / نصف دائري / ثلاث أرباع / نصين"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                    <Pie
                      data={sprinklersByMovement}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {sprinklersByMovement.map((_, index) => (
                        <Cell
                          key={index}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip content={<CustomTooltip />} />

                    <Legend
                      verticalAlign="bottom"
                      height={45}
                      wrapperStyle={{ fontSize: 12, fontWeight: 800 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="الأكوام حسب نوع المحصول / عدد اللبن"
                subtitle="ترتيب المحاصيل حسب إجمالي عدد اللبن"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={heapsByCrop}
                    margin={{ top: 25, right: 10, left: 5, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      allowDecimals={false}
                      width={55}
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      name="عدد اللبن"
                      fill={COLORS.amber}
                      radius={[16, 16, 0, 0]}
                      barSize={44}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="أكثر العمال عليهم أصول ورشاشات"
                subtitle="مقارنة واضحة بين العهد والرشاشات لكل عامل"
                tall
              >
                <WorkerLoadChart items={workerLoad} />
              </ChartCard>

              <div className="xl:col-span-2">
                <ChartCard
                  title="مقارنة عامة"
                  subtitle="نظرة عامة على الأصول والأكوام والرشاشات والمكائن"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={totalsComparison}
                      margin={{ top: 25, right: 20, left: 5, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        allowDecimals={false}
                        width={60}
                        tick={{ fontSize: 12 }}
                        tickFormatter={formatNumber}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="الإجمالي"
                        stroke={COLORS.green}
                        strokeWidth={4}
                        dot={{ r: 5, fill: COLORS.green }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

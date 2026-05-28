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

const COLORS = [
  "#16a34a",
  "#2563eb",
  "#f59e0b",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#ea580c",
];

function SummaryCard({ title, value, subtitle, color = "green" }) {
  const colors = {
    green: "from-green-600 to-emerald-700 shadow-green-100",
    blue: "from-blue-600 to-cyan-700 shadow-blue-100",
    amber: "from-amber-500 to-orange-600 shadow-amber-100",
    purple: "from-purple-600 to-fuchsia-700 shadow-purple-100",
  };

  return (
    <div
      className={`rounded-3xl bg-gradient-to-br ${
        colors[color] || colors.green
      } p-5 text-white shadow-xl transition duration-300 hover:-translate-y-1`}
    >
      <p className="text-sm font-black text-white/80">{title}</p>
      <h3 className="mt-2 text-4xl font-black">{value}</h3>
      <p className="mt-2 text-xs font-bold text-white/75">{subtitle}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="page-card p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="mb-4">
        <h3 className="font-black text-slate-900">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-xs font-bold text-slate-400">{subtitle}</p>
        ) : null}
      </div>

      <div className="h-80">{children}</div>
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

const toChartRows = (map) =>
  Object.values(map).sort((a, b) => b.value - a.value);

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

    return toChartRows(map).slice(0, 10);
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

    return toChartRows(map).slice(0, 10);
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
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [workers, assets, sprinklers]);

  const totalMachines = useMemo(
    () =>
      sprinklers.filter((item) => item.machineName || item.machine).length,
    [sprinklers]
  );

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
                title="الأصول حسب الحالة"
                subtitle="توزيع المعدات بين صالح وعاطل وفي الورشة"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetsByStatus}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={110}
                      label
                    >
                      {assetsByStatus.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="الأصول حسب التصنيف"
                subtitle="معدات وقطع غيار وأدوات فقط"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assetsByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name="العدد"
                      fill="#16a34a"
                      radius={[12, 12, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="الرشاشات حسب المزرعة"
                subtitle="أعلى 10 مزارع حسب عدد الرشاشات"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sprinklersByFarm}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name="عدد الرشاشات"
                      fill="#2563eb"
                      radius={[12, 12, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="الرشاشات حسب حركة الرشاش"
                subtitle="دائري / نصف دائري / ثلاث أرباع / نصين"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sprinklersByMovement}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={110}
                      label
                    >
                      {sprinklersByMovement.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="الأكوام حسب نوع المحصول / عدد اللبن"
                subtitle="ترتيب المحاصيل حسب إجمالي عدد اللبن"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={heapsByCrop}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name="عدد اللبن"
                      fill="#f59e0b"
                      radius={[12, 12, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="أكثر العمال عليهم أصول ورشاشات"
                subtitle="مقارنة بين العهد والرشاشات لكل عامل"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workerLoad}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="assets"
                      name="أصول"
                      fill="#16a34a"
                      radius={[12, 12, 0, 0]}
                    />
                    <Bar
                      dataKey="sprinklers"
                      name="رشاشات"
                      fill="#2563eb"
                      radius={[12, 12, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="xl:col-span-2">
                <ChartCard
                  title="مقارنة عامة"
                  subtitle="نظرة عامة على الأصول والأكوام والرشاشات والمكائن"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={totalsComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="الإجمالي"
                        stroke="#16a34a"
                        strokeWidth={4}
                        dot={{ r: 6, fill: "#16a34a" }}
                        activeDot={{ r: 8 }}
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

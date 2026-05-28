import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
} from "firebase/firestore";

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

function ChartCard({ title, children }) {
  return (
    <div className="page-card p-5">
      <h3 className="mb-4 font-black text-slate-900">{title}</h3>
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
      { name: "مواد", value: stats.materials },
    ],
    [stats]
  );

  const sprinklersByFarm = useMemo(() => {
    const map = {};

    sprinklers.forEach((item) => {
      const name = item.farmName || "غير محدد";

      if (!map[name]) {
        map[name] = { name, value: 0 };
      }

      map[name].value += 1;
    });

    return toChartRows(map).slice(0, 10);
  }, [sprinklers]);

  const sprinklersByMovement = useMemo(() => {
    const map = {};

    sprinklers.forEach((item) => {
      const name = normalizeMovement(item.movementType);

      if (!map[name]) {
        map[name] = { name, value: 0 };
      }

      map[name].value += 1;
    });

    return toChartRows(map);
  }, [sprinklers]);

  const heapsByCrop = useMemo(() => {
    const map = {};

    heaps.forEach((item) => {
      const name = item.cropType || "غير محدد";
      const bricks = Number(item.bricksCount || 0);

      if (!map[name]) {
        map[name] = { name, value: 0 };
      }

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

  const totalsComparison = useMemo(
    () => [
      { name: "الأصول", value: assets.length },
      { name: "الأكوام", value: heaps.length },
      { name: "الرشاشات", value: sprinklers.length },
      {
        name: "المكائن",
        value: sprinklers.filter((item) => item.machineName || item.machine)
          .length,
      },
    ],
    [assets, heaps, sprinklers]
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
          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="الأصول حسب الحالة">
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
                      <Cell key={index} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="الأصول حسب التصنيف">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetsByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="العدد" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="الرشاشات حسب المزرعة">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sprinklersByFarm}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="عدد الرشاشات" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="الرشاشات حسب حركة الرشاش">
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
                      <Cell key={index} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="الأكوام حسب نوع المحصول / عدد اللبن">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heapsByCrop}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="عدد اللبن" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="أكثر العمال عليهم أصول ورشاشات">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerLoad}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="assets" name="أصول" />
                  <Bar dataKey="sprinklers" name="رشاشات" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="مقارنة عامة">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={totalsComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line dataKey="value" name="الإجمالي" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

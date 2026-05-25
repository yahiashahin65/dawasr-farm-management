import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { calculateAssetsStats } from "../../lib/assetsStats";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faPlus,
  faPen,
  faTrash,
  faMagnifyingGlass,
  faEye,
  faRightLeft,
  faTableCells,
  faTableList,
  faBroom,
} from "@fortawesome/free-solid-svg-icons";

import {
  badgeClass,
  getAssetTypeName,
  getPlaceName,
  getPlaceTypeLabel,
  normalizeList,
} from "../../lib/inventory";

const PAGE_SIZE = 10;

export default function Assets() {
  const router = useRouter();
  const { canManage } = useUserRole();

  const [allItems, setAllItems] = useState([]);

  const [types, setTypes] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);

  const [stats, setStats] = useState({
    total: 0,
    good: 0,
    broken: 0,
    inWorkshop: 0,
    equipment: 0,
    spareParts: 0,
    tools: 0,
    materials: 0,
    inFarms: 0,
    inKubras: 0,
    inExternalWorkshops: 0,
  });

  const [filters, setFilters] = useState({
    status: "",
    assetTypeId: "",
    placeType: "",
    farmId: "",
    kubraId: "",
    workerId: "",
    category: "",
  });

  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState("table");

  const loadAssets = async () => {
    const snap = await getDocs(
      query(collection(db, "assets"), orderBy("createdAt", "desc"))
    );

    const allAssets = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    setAllItems(allAssets);
    setStats(calculateAssetsStats(allAssets));
  };

  const loadMetaData = async () => {
    const [t, f, k, w] = await Promise.all([
      getDocs(collection(db, "assetTypes")),
      getDocs(collection(db, "farms")),
      getDocs(collection(db, "kubras")),
      getDocs(collection(db, "workers")),
    ]);

    setTypes(normalizeList(t.docs));
    setFarms(normalizeList(f.docs));
    setKubras(normalizeList(k.docs));
    setWorkers(normalizeList(w.docs));
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        await Promise.all([loadAssets(), loadMetaData()]);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const q = router.query;

    setFilters({
      status: q.status ? String(q.status) : "",
      assetTypeId: q.assetTypeId ? String(q.assetTypeId) : "",
      placeType: q.placeType ? String(q.placeType) : "",
      farmId: q.farmId ? String(q.farmId) : "",
      kubraId: q.kubraId ? String(q.kubraId) : "",
      workerId: q.workerId ? String(q.workerId) : "",
      category: q.category ? String(q.category) : "",
    });
  }, [router.query]);

  const setFilter = (key, value) => {
    setCurrentPage(1);

    const next = {
      ...router.query,
      [key]: value,
    };

    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k];
    });

    router.push({
      pathname: "/assets",
      query: next,
    });
  };

  const clearFilters = () => {
    setSearch("");
    setCurrentPage(1);
    router.push("/assets");
  };

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف الأصل؟")) {
      await deleteDoc(doc(db, "assets", id));
      await loadAssets();
    }
  };

  const filtered = useMemo(
    () =>
      allItems.filter((asset) => {
        const haystack = `
          ${asset.name || ""}
          ${getAssetTypeName(asset)}
          ${getPlaceName(asset)}
          ${asset.workerNames || ""}
          ${asset.code || ""}
        `.toLowerCase();

        return (
          (!filters.category ||
            (asset.category || "asset") === filters.category) &&
          (!filters.status || asset.status === filters.status) &&
          (!filters.assetTypeId || asset.assetTypeId === filters.assetTypeId) &&
          (!filters.placeType || asset.placeType === filters.placeType) &&
          (!filters.farmId ||
            asset.farmId === filters.farmId ||
            asset.placeId === filters.farmId) &&
          (!filters.kubraId ||
            asset.kubraId === filters.kubraId ||
            asset.placeId === filters.kubraId) &&
          (!filters.workerId ||
            (asset.workerIds || []).includes(filters.workerId)) &&
          (!search || haystack.includes(search.toLowerCase()))
        );
      }),
    [allItems, filters, search]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;

  const paginatedItems = useMemo(() => {
    return filtered.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filtered, currentPage]);

  const quick = [
    { label: "الكل", count: stats.total, key: "", value: "" },
    { label: "صالح", count: stats.good, key: "status", value: "صالح" },
    { label: "عاطل", count: stats.broken, key: "status", value: "عاطل" },
    {
      label: "في الورشة",
      count: stats.inWorkshop,
      key: "status",
      value: "في الورشة",
    },
    { label: "معدات", count: stats.equipment, key: "category", value: "asset" },
    {
      label: "قطع غيار",
      count: stats.spareParts,
      key: "category",
      value: "spare_part",
    },
    { label: "أدوات", count: stats.tools, key: "category", value: "tool" },
    {
      label: "داخل المزارع",
      count: stats.inFarms,
      key: "placeType",
      value: "farm",
    },
    {
      label: "داخل الكِبر",
      count: stats.inKubras,
      key: "placeType",
      value: "kubra",
    },
    {
      label: "في الورش",
      count: stats.inExternalWorkshops,
      key: "placeType",
      value: "external_workshop",
    },
  ];

  const isQuickActive = (q) => {
    if (!q.key) return !Object.values(filters).some(Boolean);

    return filters[q.key] === q.value;
  };

  const categoryLabel = (category) => {
    if (category === "spare_part") return "قطعة غيار";
    if (category === "tool") return "أداة";

    return "معدة";
  };

  return (
    <ProtectedRoute pageLoading={initialLoading}>
      <Layout title="إدارة الأصول والعهد">
        {/* باقي الكود زي ما هو */}

        <div className="mb-3 text-sm font-bold text-slate-500">
          المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
          {filtered.length}
        </div>

        {view === "table" ? (
          <div className="page-card overflow-x-auto">
            <table className="w-full">
              <tbody>
                {paginatedItems.map((asset) => (
                  <tr
                    className="clickable-row border-t border-slate-100"
                    key={asset.id}
                  >
                    {/* باقي صفوف الجدول زي ما هي */}
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td className="table-td text-center" colSpan="8">
                      لا توجد أصول مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedItems.map((asset) => (
              <div key={asset.id} className="page-card overflow-hidden">
                {/* نفس كود الكروت */}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="btn-secondary disabled:opacity-50"
          >
            السابق
          </button>

          <span className="font-bold text-slate-700">
            صفحة {currentPage} من {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="btn-secondary disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

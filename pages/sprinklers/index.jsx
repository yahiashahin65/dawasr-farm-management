import { useEffect, useMemo, useState } from "react";
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
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPen,
  faTrash,
  faMagnifyingGlass,
  faBroom,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";

const PAGE_SIZE = 10;

const normalizeMovement = (value) => {
  const text = String(value || "").trim();

  if (text.includes("ثلاث") || text.includes("3") || text.includes("تلات")) {
    return "ثلاث أرباع دائري";
  }

  if (text.includes("نصين") || text.includes("نصفين")) return "نصين";
  if (text.includes("نصف") || text.includes("نص")) return "نصف دائري";
  if (text.includes("دائري") || text.includes("دايري")) return "دائري";

  return text || "-";
};

export default function Sprinklers() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [farms, setFarms] = useState([]);
  const [machines, setMachines] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    farmName: "",
    machineName: "",
  });

  const loadData = async () => {
    const [sprinklersSnap, farmsSnap] = await Promise.all([
      getDocs(query(collection(db, "sprinklers"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "farms")),
    ]);

    const sprinklers = sprinklersSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    setItems(sprinklers);

    setFarms(
      farmsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );

    setMachines(
      Array.from(
        new Set(
          sprinklers
            .map((item) => item.machineName || item.machine || "")
            .filter(Boolean)
        )
      )
    );
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        await loadData();
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const updateFilter = (key, value) => {
    setCurrentPage(1);

    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setSearch("");
    setCurrentPage(1);

    setFilters({
      farmName: "",
      machineName: "",
    });
  };

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return items.filter((item) => {
      const farmName = item.farmName || "";
      const machineName = item.machineName || item.machine || "";

      const text = `
        ${item.name || ""}
        ${item.sprinklerName || ""}
        ${farmName}
        ${machineName}
        ${item.gearName || item.gear || ""}
        ${item.cropType || ""}
        ${item.workerName || ""}
        ${item.movementType || ""}
      `.toLowerCase();

      return (
        (!filters.farmName || farmName === filters.farmName) &&
        (!filters.machineName || machineName === filters.machineName) &&
        (!keyword || text.includes(keyword))
      );
    });
  }, [items, filters, search]);

  const totalWorkers = useMemo(() => {
    const workers = new Set();

    filteredItems.forEach((item) => {
      if (item.workerId) workers.add(item.workerId);
      else if (item.workerName) workers.add(item.workerName);
    });

    return workers.size;
  }, [filteredItems]);

  const totalMachines = useMemo(() => {
    return new Set(
      filteredItems
        .map((item) => item.machineName || item.machine)
        .filter(Boolean)
    ).size;
  }, [filteredItems]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filteredItems, currentPage]);

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف الرشاش؟")) {
      await deleteDoc(doc(db, "sprinklers", id));
      await loadData();

      if (paginatedItems.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      }
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="الرشاشات">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الرشاشات..."
            subtitle="يتم تجهيز بيانات الرشاشات"
          />
        ) : (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي الرشاشات
                </p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {filteredItems.length}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">عدد العمال</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {totalWorkers}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">عدد انواع المكاين</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {totalMachines}
                </h3>
              </div>
            </div>

            <div className="page-card mb-4 grid gap-3 p-3 lg:grid-cols-4">
              <div className="flex items-center gap-2 lg:col-span-2">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-slate-400"
                />

                <input
                  className="w-full bg-transparent p-2 outline-none"
                  placeholder="بحث باسم الرشاش أو المزرعة أو المكينة..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select
                className="form-input"
                value={filters.farmName}
                onChange={(e) => updateFilter("farmName", e.target.value)}
              >
                <option value="">كل المزارع</option>

                {farms.map((farm) => (
                  <option key={farm.id} value={farm.name}>
                    {farm.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.machineName}
                onChange={(e) => updateFilter("machineName", e.target.value)}
              >
                <option value="">كل المكاين</option>

                {machines.map((machine) => (
                  <option key={machine} value={machine}>
                    {machine}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-bold text-slate-500">
                المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
                {filteredItems.length}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={clearFilters} className="btn-secondary">
                  <FontAwesomeIcon icon={faBroom} />
                  مسح الفلاتر
                </button>

                {canManage && (
                  <Link href="/sprinklers/add" className="btn-primary">
                    <FontAwesomeIcon icon={faPlus} />
                    إضافة رشاش
                  </Link>
                )}
              </div>
            </div>

            <div className="page-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">الصورة</th>
                    <th className="table-th">الرشاش</th>
                    <th className="table-th">المزرعة</th>
                    <th className="table-th">المكينة</th>
                    <th className="table-th">الجير</th>
                    <th className="table-th">نوع المحصول</th>
                    <th className="table-th">حركة الرشاش</th>
                    <th className="table-th">العامل</th>
                    <th className="table-th">إجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="table-td">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name || item.sprinklerName || "رشاش"}
                            className="h-16 w-24 rounded-2xl object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="table-td font-bold">
                        {item.name || item.sprinklerName || "-"}
                      </td>

                      <td className="table-td">{item.farmName || "-"}</td>

                      <td className="table-td">
                        {item.machineName || item.machine || "-"}
                      </td>

                      <td className="table-td">
                        {item.gearName || item.gear || "-"}
                      </td>

                      <td className="table-td">{item.cropType || "-"}</td>

                      <td className="table-td">
                        <span className="badge bg-green-50 text-green-700">
                          {normalizeMovement(item.movementType)}
                        </span>
                      </td>

                      <td className="table-td">
                        {item.workerId ? (
                          <Link
                            href={`/workers/${item.workerId}`}
                            className="font-bold text-slate-900 hover:underline"
                          >
                            {item.workerName || "-"}
                          </Link>
                        ) : (
                          <span className="font-bold text-slate-900">
                            {item.workerName || "-"}
                          </span>
                        )}
                      </td>

                      <td className="table-td">
                        <div className="flex gap-2">
                          <Link
                            href={`/sprinklers/${item.id}`}
                            className="btn-secondary !p-2"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </Link>

                          {canManage && (
                            <>
                              <Link
                                href={`/sprinklers/edit/${item.id}`}
                                className="btn-secondary !p-2"
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </Link>

                              <button
                                onClick={() => remove(item.id)}
                                className="btn-danger !p-2"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td className="table-td text-center" colSpan="9">
                        لا توجد رشاشات مطابقة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredItems.length > PAGE_SIZE && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="btn-secondary disabled:opacity-50"
                >
                  السابق
                </button>

                <span className="font-bold text-slate-700">
                  صفحة {currentPage} من {totalPages}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className="btn-secondary disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

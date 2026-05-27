import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { sprinklersSeed } from "../../lib/sprinklersSeed";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faMagnifyingGlass,
  faRotate,
  faSeedling,
  faEye,
  faPen,
  faTrash,
  faBroom,
} from "@fortawesome/free-solid-svg-icons";

const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

const makeSprinklerId = (item) => {
  return `${item.farmName || "farm"}-${item.sequence || "no-seq"}-${item.name || "sprinkler"}`
    .replace(/\s+/g, "-")
    .replace(/[\/\\.#$[\]]/g, "-");
};

const uniqueOptions = (items, key) => {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
};

const findWorkerForSprinkler = (item, workers) => {
  const seedName = normalizeText(item.workerName);
  const seedPhone = normalizeText(item.workerPhone);

  return workers.find((worker) => {
    const workerName = normalizeText(worker.name);
    const workerPhone = normalizeText(worker.phone);

    return (
      (seedPhone && workerPhone && seedPhone === workerPhone) ||
      (seedName && workerName && seedName === workerName)
    );
  });
};

export default function SprinklersPage() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");

  const [farmFilter, setFarmFilter] = useState("");
  const [workerFilter, setWorkerFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [gearFilter, setGearFilter] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [cropFilter, setCropFilter] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const loadWorkers = async () => {
    const snap = await getDocs(query(collection(db, "workers"), orderBy("createdAt", "desc")));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setWorkers(list);
    return list;
  };

  const loadSprinklers = async () => {
    const snap = await getDocs(query(collection(db, "sprinklers"), orderBy("farmName", "asc")));
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([loadSprinklers(), loadWorkers()]);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const importFromExcelSeed = async () => {
    if (importing || !canManage) return;

    const ok = confirm(
      "هل تريد استيراد بيانات الرشاشات من الشيت؟ سيتم ربط العامل تلقائيًا من صفحة العمال بالاسم أو رقم الجوال."
    );

    if (!ok) return;

    setImporting(true);

    try {
      const workersList = workers.length ? workers : await loadWorkers();

      await Promise.all(
        sprinklersSeed.map((item) => {
          const id = makeSprinklerId(item);
          const matchedWorker = findWorkerForSprinkler(item, workersList);

          return setDoc(
            doc(db, "sprinklers", id),
            {
              ...item,
              workerId: matchedWorker?.id || "",
              workerName: matchedWorker?.name || item.workerName || "",
              workerPhone: matchedWorker?.phone || item.workerPhone || "",
              imageUrl: item.imageUrl || "",
              source: "excel_seed",
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        })
      );

      await loadSprinklers();
      alert("تم استيراد بيانات الرشاشات وربط العمال بنجاح");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء استيراد بيانات الرشاشات");
    } finally {
      setImporting(false);
    }
  };

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف الرشاش؟")) {
      await deleteDoc(doc(db, "sprinklers", id));
      await loadSprinklers();
    }
  };

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return items.filter((item) => {
      const text = `
        ${item.name || ""}
        ${item.machine || ""}
        ${item.gear || ""}
        ${item.farmName || ""}
        ${item.movement || ""}
        ${item.cropType || ""}
        ${item.workerName || ""}
        ${item.workerPhone || ""}
        ${item.hectareNumber || ""}
      `.toLowerCase();

      return (
        (!keyword || text.includes(keyword)) &&
        (!farmFilter || item.farmName === farmFilter) &&
        (!workerFilter || item.workerId === workerFilter) &&
        (!machineFilter || String(item.machine) === machineFilter) &&
        (!gearFilter || item.gear === gearFilter) &&
        (!movementFilter || item.movement === movementFilter) &&
        (!cropFilter || item.cropType === cropFilter)
      );
    });
  }, [
    items,
    search,
    farmFilter,
    workerFilter,
    machineFilter,
    gearFilter,
    movementFilter,
    cropFilter,
  ]);

  const stats = useMemo(() => {
    const totalTowers = filteredItems.reduce((sum, item) => sum + Number(item.towersCount || 0), 0);
    const totalHectares = filteredItems.reduce((sum, item) => sum + Number(item.hectareNumber || 0), 0);

    return {
      total: filteredItems.length,
      totalTowers,
      totalHectares,
      farmsCount: uniqueOptions(filteredItems, "farmName").length,
      workersCount: uniqueOptions(filteredItems, "workerId").length,
    };
  }, [filteredItems]);

  const optionsSource = items.length ? items : sprinklersSeed;

  const farmOptions = uniqueOptions(optionsSource, "farmName");
  const machineOptions = uniqueOptions(optionsSource, "machine").map(String);
  const gearOptions = uniqueOptions(optionsSource, "gear");
  const movementOptions = uniqueOptions(optionsSource, "movement");
  const cropOptions = uniqueOptions(optionsSource, "cropType");

  const resetFilters = () => {
    setSearch("");
    setFarmFilter("");
    setWorkerFilter("");
    setMachineFilter("");
    setGearFilter("");
    setMovementFilter("");
    setCropFilter("");
  };

  return (
    <ProtectedRoute>
      <Layout title="الرشاشات">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الرشاشات..."
            subtitle="يتم تجهيز بيانات الرشاشات والعمال"
          />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  رشاشات ومكاين المزارع
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  العامل مربوط بصفحة العمال عن طريق workerId، والصورة تظهر شرطة لو فارغة.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={loadSprinklers} disabled={importing} className="btn-secondary disabled:opacity-60">
                  <FontAwesomeIcon icon={faRotate} />
                  تحديث
                </button>

                {canManage && (
                  <button onClick={importFromExcelSeed} disabled={importing} className="btn-primary disabled:opacity-60">
                    <FontAwesomeIcon icon={faDownload} />
                    {importing ? "جاري الاستيراد..." : "استيراد بيانات الشيت"}
                  </button>
                )}
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">إجمالي الرشاشات</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">{stats.total}</h3>
              </div>
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">إجمالي الأبراج</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">{stats.totalTowers}</h3>
              </div>
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">إجمالي الهكتارات</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">{stats.totalHectares}</h3>
              </div>
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">عدد المزارع</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">{stats.farmsCount}</h3>
              </div>
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">عدد العمال</p>
                <h3 className="mt-2 text-4xl font-black text-slate-900">{stats.workersCount}</h3>
              </div>
            </div>

            <div className="page-card mb-4 grid gap-3 p-3 xl:grid-cols-7">
              <div className="flex items-center gap-2 xl:col-span-2">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="text-slate-400" />
                <input
                  className="w-full bg-transparent p-2 outline-none"
                  placeholder="بحث باسم الرشاش أو المزرعة أو العامل..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select className="form-input" value={farmFilter} onChange={(e) => setFarmFilter(e.target.value)}>
                <option value="">كل المزارع</option>
                {farmOptions.map((farm) => <option key={farm} value={farm}>{farm}</option>)}
              </select>

              <select className="form-input" value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
                <option value="">كل العمال</option>
                {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
              </select>

              <select className="form-input" value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
                <option value="">كل المكاين</option>
                {machineOptions.map((machine) => <option key={machine} value={machine}>{machine}</option>)}
              </select>

              <select className="form-input" value={gearFilter} onChange={(e) => setGearFilter(e.target.value)}>
                <option value="">كل الجير</option>
                {gearOptions.map((gear) => <option key={gear} value={gear}>{gear}</option>)}
              </select>

              <button onClick={resetFilters} className="btn-secondary">
                <FontAwesomeIcon icon={faBroom} />
                مسح الفلاتر
              </button>

              <select className="form-input xl:col-span-3" value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)}>
                <option value="">كل حركات الرشاش</option>
                {movementOptions.map((movement) => <option key={movement} value={movement}>{movement}</option>)}
              </select>

              <select className="form-input xl:col-span-4" value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
                <option value="">كل أنواع المحصول</option>
                {cropOptions.map((crop) => <option key={crop} value={crop}>{crop}</option>)}
              </select>
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض: {filteredItems.length} من إجمالي {items.length}
            </div>

            <div className="page-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">الصورة</th>
                    <th className="table-th">الرشاش</th>
                    <th className="table-th">المكينة</th>
                    <th className="table-th">الأبراج</th>
                    <th className="table-th">الجير</th>
                    <th className="table-th">التسلسل</th>
                    <th className="table-th">المزرعة</th>
                    <th className="table-th">حركة الرشاش</th>
                    <th className="table-th">نوع المحصول</th>
                    <th className="table-th">رقم هكتار</th>
                    <th className="table-th">العامل</th>
                    <th className="table-th">جوال العامل</th>
                    <th className="table-th">إجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="table-td">
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-16 w-24 rounded-2xl object-cover ring-1 ring-slate-200" /> : "-"}
                      </td>
                      <td className="table-td font-black">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faSeedling} className="text-green-600" />
                          <span>{item.name || "-"}</span>
                        </div>
                      </td>
                      <td className="table-td">{item.machine || "-"}</td>
                      <td className="table-td">{item.towersCount || "-"}</td>
                      <td className="table-td">{item.gear || "-"}</td>
                      <td className="table-td">{item.sequence || "-"}</td>
                      <td className="table-td"><span className="badge bg-green-50 text-green-700">{item.farmName || "-"}</span></td>
                      <td className="table-td">{item.movement || "-"}</td>
                      <td className="table-td"><span className="badge bg-amber-50 text-amber-700">{item.cropType || "-"}</span></td>
                      <td className="table-td">{item.hectareNumber || "-"}</td>
                      <td className="table-td">
                        {item.workerId ? (
                          <Link className="font-bold text-green-700 hover:underline" href={`/workers/${item.workerId}`}>
                            {item.workerName || "-"}
                          </Link>
                        ) : (
                          item.workerName || "-"
                        )}
                      </td>
                      <td className="table-td">{item.workerPhone || "-"}</td>
                      <td className="table-td">
                        <div className="flex gap-2">
                          <Link href={`/sprinklers/${item.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faEye} /></Link>
                          {canManage && (
                            <>
                              <Link href={`/sprinklers/edit/${item.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faPen} /></Link>
                              <button type="button" onClick={() => remove(item.id)} className="btn-danger !p-2"><FontAwesomeIcon icon={faTrash} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr><td className="table-td text-center" colSpan="13">لا توجد رشاشات مطابقة</td></tr>
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

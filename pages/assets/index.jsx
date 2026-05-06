import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
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
import { badgeClass, getAssetTypeName, getPlaceName, getPlaceTypeLabel, normalizeList } from "../../lib/inventory";

export default function Assets() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    assetTypeId: "",
    placeType: "",
    farmId: "",
    kubraId: "",
    workerId: "",
  });
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState("table");

  const load = async () => {
    const [a, t, f, k, w] = await Promise.all([
      getDocs(query(collection(db, "assets"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "assetTypes")),
      getDocs(collection(db, "farms")),
      getDocs(collection(db, "kubras")),
      getDocs(collection(db, "workers")),
    ]);

    setItems(a.docs.map((d) => ({ id: d.id, ...d.data() })));
    setTypes(normalizeList(t.docs));
    setFarms(normalizeList(f.docs));
    setKubras(normalizeList(k.docs));
    setWorkers(normalizeList(w.docs));
  };

  useEffect(() => {
    load();
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
    });
  }, [router.query]);

  const setFilter = (key, value) => {
    const next = { ...router.query, [key]: value };
    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k];
    });
    router.push({ pathname: "/assets", query: next });
  };

  const clearFilters = () => {
    setSearch("");
    router.push("/assets");
  };

  const remove = async (id) => {
    if (confirm("هل تريد حذف المعدة؟")) {
      await deleteDoc(doc(db, "assets", id));
      load();
    }
  };

  const filtered = useMemo(
    () =>
      items.filter((asset) => {
        const haystack = `${asset.name || ""} ${getAssetTypeName(asset)} ${getPlaceName(asset)} ${asset.workerNames || ""} ${asset.code || ""}`;

        return (
          (!filters.status || asset.status === filters.status) &&
          (!filters.assetTypeId || asset.assetTypeId === filters.assetTypeId) &&
          (!filters.placeType || asset.placeType === filters.placeType) &&
          (!filters.farmId || asset.farmId === filters.farmId || asset.placeId === filters.farmId) &&
          (!filters.kubraId || asset.kubraId === filters.kubraId || asset.placeId === filters.kubraId) &&
          (!filters.workerId || (asset.workerIds || []).includes(filters.workerId)) &&
          (!search || haystack.toLowerCase().includes(search.toLowerCase()))
        );
      }),
    [items, filters, search]
  );

  const quick = [
    { label: "الكل", count: items.length, key: "", value: "" },
    { label: "صالح", count: items.filter((a) => a.status === "صالح").length, key: "status", value: "صالح" },
    { label: "عاطل", count: items.filter((a) => a.status === "عاطل").length, key: "status", value: "عاطل" },
    { label: "تالف", count: items.filter((a) => a.status === "تالف").length, key: "status", value: "تالف" },
    { label: "داخل المزارع", count: items.filter((a) => a.placeType === "farm").length, key: "placeType", value: "farm" },
    { label: "داخل الكِبر", count: items.filter((a) => a.placeType === "kubra").length, key: "placeType", value: "kubra" },
  ];

  const isQuickActive = (q) => {
    if (!q.key) return !Object.values(filters).some(Boolean);
    return filters[q.key] === q.value;
  };

  return (
    <ProtectedRoute>
      <Layout title="إدارة المعدات والعهد">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={() => (q.key ? setFilter(q.key, q.value) : clearFilters())}
                className={`btn-secondary ${isQuickActive(q) ? "!bg-slate-900 !text-white" : ""}`}
              >
                {q.label} {q.count}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={clearFilters} className="btn-secondary">
              <FontAwesomeIcon icon={faBroom} />
              مسح الفلاتر
            </button>
            <button onClick={() => setView(view === "table" ? "grid" : "table")} className="btn-secondary">
              <FontAwesomeIcon icon={view === "table" ? faTableCells : faTableList} />
              {view === "table" ? "عرض كروت" : "عرض جدول"}
            </button>
            <Link href="/assets/add" className="btn-primary">
              <FontAwesomeIcon icon={faPlus} />
              إضافة معدة
            </Link>
          </div>
        </div>

        <div className="page-card mb-4 grid gap-3 p-3 lg:grid-cols-6">
          <div className="flex items-center gap-2 lg:col-span-2">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-slate-400" />
            <input
              className="w-full bg-transparent p-2 outline-none"
              placeholder="بحث باسم المعدة أو النوع أو المكان أو العامل"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="form-input" value={filters.assetTypeId} onChange={(e) => setFilter("assetTypeId", e.target.value)}>
            <option value="">كل الأنواع</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select className="form-input" value={filters.farmId} onChange={(e) => setFilter("farmId", e.target.value)}>
            <option value="">كل المزارع</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <select className="form-input" value={filters.kubraId} onChange={(e) => setFilter("kubraId", e.target.value)}>
            <option value="">كل الكِبر</option>
            {kubras.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>

          <select className="form-input" value={filters.workerId} onChange={(e) => setFilter("workerId", e.target.value)}>
            <option value="">كل العمال</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-3 text-sm font-bold text-slate-500">
          المعروض: {filtered.length} من {items.length}
        </div>

        {view === "table" ? (
          <div className="page-card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">الصورة</th>
                  <th className="table-th">المعدة</th>
                  <th className="table-th">النوع</th>
                  <th className="table-th">المكان الحالي</th>
                  <th className="table-th">العمال</th>
                  <th className="table-th">الحالة</th>
                  <th className="table-th">إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((asset) => (
                  <tr className="clickable-row border-t border-slate-100" key={asset.id}>
                    <td className="table-td">
                      {asset.imageUrl ? (
                        <button onClick={() => setPreview(asset)}>
                          <img src={asset.imageUrl} alt={asset.name} className="h-16 w-24 rounded-2xl object-cover ring-1 ring-slate-200" />
                        </button>
                      ) : "-"}
                    </td>
                    <td className="table-td">
                      <Link href={`/assets/${asset.id}`}>
                        <b>{asset.name}</b>
                        <p className="text-xs text-slate-400">{asset.code || ""}</p>
                      </Link>
                    </td>
                    <td className="table-td">
                      {asset.assetTypeId ? (
                        <Link href={`/assets?assetTypeId=${asset.assetTypeId}`}>{getAssetTypeName(asset)}</Link>
                      ) : getAssetTypeName(asset)}
                    </td>
                    <td className="table-td">
                      <Link href={asset.placeType === "kubra" ? `/assets?kubraId=${asset.kubraId || asset.placeId}` : `/assets?farmId=${asset.farmId || asset.placeId}`}>
                        <b>{getPlaceName(asset)}</b>
                        <p className="text-xs text-slate-400">{getPlaceTypeLabel(asset.placeType)}</p>
                      </Link>
                    </td>
                    <td className="table-td max-w-xs overflow-hidden text-ellipsis">{asset.workerNames || "-"}</td>
                    <td className="table-td">
                      <Link href={`/assets?status=${asset.status}`} className={`badge ${badgeClass(asset.status)}`}>{asset.status}</Link>
                    </td>
                    <td className="table-td">
                      <div className="flex gap-2">
                        <Link href={`/assets/${asset.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faEye} /></Link>
                        <Link href={`/assets/move/${asset.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faRightLeft} /></Link>
                        <Link href={`/assets/edit/${asset.id}`} className="btn-secondary !p-2"><FontAwesomeIcon icon={faPen} /></Link>
                        <button onClick={() => remove(asset.id)} className="btn-danger !p-2"><FontAwesomeIcon icon={faTrash} /></button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td className="table-td text-center" colSpan="7">لا توجد معدات مطابقة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((asset) => (
              <div key={asset.id} className="page-card overflow-hidden">
                <button onClick={() => asset.imageUrl && setPreview(asset)} className="block h-44 w-full bg-slate-100">
                  {asset.imageUrl ? <img src={asset.imageUrl} className="h-full w-full object-cover" alt={asset.name} /> : null}
                </button>
                <div className="p-4">
                  <Link href={`/assets/${asset.id}`} className="text-lg font-black">{asset.name}</Link>
                  <p className="mt-1 text-sm text-slate-500">{getAssetTypeName(asset)} - {getPlaceName(asset)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`badge ${badgeClass(asset.status)}`}>{asset.status}</span>
                    <span className="badge bg-slate-100 text-slate-600">{getPlaceTypeLabel(asset.placeType)}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/assets/${asset.id}`} className="btn-secondary">عرض</Link>
                    <Link href={`/assets/move/${asset.id}`} className="btn-secondary">نقل</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {preview && (
          <div onClick={() => setPreview(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black">{preview.name}</h3>
                <button className="btn-secondary !py-2" onClick={() => setPreview(null)}>إغلاق</button>
              </div>
              <img src={preview.imageUrl} alt={preview.name} className="max-h-[75vh] w-full rounded-2xl object-contain" />
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

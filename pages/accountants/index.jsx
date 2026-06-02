import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { subscribeCachedCollection, getCachedCollection, setCachedCollection } from "../../lib/realtimeCache";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faEye, faMagnifyingGlass, faBroom } from "@fortawesome/free-solid-svg-icons";

const PAGE_SIZE = 10;

const removeAccountantFromCache = (accountantId) => {
  const cached = getCachedCollection("cache:accountants");
  setCachedCollection("cache:accountants", cached.filter((item) => item.id !== accountantId));
};

export default function Accountants() {
  const { canManage } = useUserRole();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({
      db,
      collectionName: "accountants",
      cacheKey: "cache:accountants",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setItems,
      onLoading: setInitialLoading,
      onError: () => setRealtimeError("تعذر تحديث بيانات المحاسبين لحظيًا"),
    });
    return () => unsubscribe?.();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((accountant) => `${accountant.name || ""} ${accountant.phone || ""} ${accountant.notes || ""}`.toLowerCase().includes(keyword));
  }, [items, search]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filteredItems, currentPage]);

  const remove = async (id) => {
    if (!canManage) return;
    if (!confirm("هل تريد حذف المحاسب؟")) return;
    const target = items.find((item) => item.id === id);
    removeAccountantFromCache(id);
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (!isOnline()) {
      addOfflineOperation({ collectionName: "accountants", operation: "delete", documentId: id, payload: {}, meta: { label: "حذف محاسب", name: target?.name || "" } });
      alert("تم حذف المحاسب محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "accountants", id));
    } catch (error) {
      console.error(error);
      addOfflineOperation({ collectionName: "accountants", operation: "delete", documentId: id, payload: {}, meta: { label: "حذف محاسب", name: target?.name || "" } });
      alert("تعذر الاتصال، تم حفظ عملية الحذف وسيتم تنفيذها عند عودة الاتصال");
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إدارة المحاسبين">
        {initialLoading ? <AppLoader variant="compact" title="جاري تحميل المحاسبين..." subtitle="يتم تجهيز بيانات المحاسبين" /> : (
          <>
            {realtimeError && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">{realtimeError}</div>}

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <div className="page-card p-5"><p className="text-sm font-bold text-slate-500">إجمالي المحاسبين</p><h3 className="mt-2 text-4xl font-black text-slate-900">{filteredItems.length}</h3></div>
              <div className="page-card p-5"><p className="text-sm font-bold text-slate-500">المسجلون حاليًا</p><h3 className="mt-2 text-4xl font-black text-slate-900">{items.length}</h3></div>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="page-card flex flex-1 items-center gap-2 p-3">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="text-slate-400" />
                <input className="w-full bg-transparent p-2 outline-none" placeholder="بحث باسم المحاسب أو الجوال..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="btn-secondary"><FontAwesomeIcon icon={faBroom} />مسح البحث</button>
                {canManage && <Link href="/accountants/add" className="btn-primary"><FontAwesomeIcon icon={faPlus} />إضافة محاسب</Link>}
              </div>
            </div>

            <div className="page-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50"><tr><th className="table-th">الاسم</th><th className="table-th">الجوال</th><th className="table-th">ملاحظات</th><th className="table-th">الإجراءات</th></tr></thead>
                <tbody>
                  {paginatedItems.map((accountant) => (
                    <tr key={accountant.id} className="border-t border-slate-100">
                      <td className="table-td font-bold">{accountant.name || "-"}</td>
                      <td className="table-td">{accountant.phone || "-"}</td>
                      <td className="table-td">{accountant.notes || "-"}</td>
                      <td className="table-td"><div className="flex flex-wrap gap-2"><Link href={`/accountants/${accountant.id}`} className="btn-secondary !py-2"><FontAwesomeIcon icon={faEye} /></Link>{canManage && <Link href={`/accountants/edit/${accountant.id}`} className="btn-secondary !py-2"><FontAwesomeIcon icon={faPen} /></Link>}{canManage && <button onClick={() => remove(accountant.id)} className="btn-danger !py-2"><FontAwesomeIcon icon={faTrash} /></button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {paginatedItems.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-500">لا توجد بيانات</div>}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>السابق</button>
              <span className="rounded-2xl bg-white px-4 py-2 text-sm font-black shadow">{currentPage} / {totalPages}</span>
              <button className="btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>التالي</button>
            </div>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

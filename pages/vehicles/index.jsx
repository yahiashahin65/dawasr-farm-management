import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { getCachedCollection, setCachedCollection, subscribeCachedCollection } from "../../lib/realtimeCache";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faEye, faMagnifyingGlass, faBroom, faScrewdriverWrench, faCheck, faMoneyBill } from "@fortawesome/free-solid-svg-icons";

const PAGE_SIZE = 10;
const emptyExitForm = { repairCost: "", hasSpareParts: "no", spareParts: [{ name: "", price: "" }], exitedAt: new Date().toISOString().slice(0, 10), invoicePaid: "no", notes: "" };

const statusLabel = (status) => {
  if (status === "in_workshop") return "في الورشة";
  if (status === "repaired_unpaid") return "تم الإصلاح وعليه فاتورة";
  if (status === "available") return "سليمة";
  return "غير محدد";
};
const statusClass = (status) => {
  if (status === "in_workshop") return "bg-amber-50 text-amber-700";
  if (status === "repaired_unpaid") return "bg-red-50 text-red-700";
  return "bg-green-50 text-green-700";
};
const typeLabel = (type) => ({ worker: "عامل", engineer: "مهندس", accountant: "محاسب" }[type] || "-");
const removeVehicleFromCache = (vehicleId) => setCachedCollection("cache:vehicles", getCachedCollection("cache:vehicles").filter((item) => item.id !== vehicleId));

export default function Vehicles() {
  const { canManage } = useUserRole();
  const [items, setItems] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entryVehicle, setEntryVehicle] = useState(null);
  const [exitVehicle, setExitVehicle] = useState(null);
  const [entryForm, setEntryForm] = useState({ workshopName: "", faultReason: "", enteredAt: new Date().toISOString().slice(0, 10), notes: "" });
  const [exitForm, setExitForm] = useState(emptyExitForm);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    const unsubscribeVehicles = subscribeCachedCollection({ db, collectionName: "vehicles", cacheKey: "cache:vehicles", orderField: "createdAt", orderDirection: "desc", onData: setItems, onLoading: setInitialLoading, onError: () => setRealtimeError("تعذر تحديث بيانات السيارات لحظيًا") });
    const unsubscribeMaintenance = subscribeCachedCollection({ db, collectionName: "vehicleMaintenance", cacheKey: "cache:vehicleMaintenance", orderField: "enteredAt", orderDirection: "desc", onData: setMaintenance });
    return () => { unsubscribeVehicles?.(); unsubscribeMaintenance?.(); };
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((vehicle) => {
      if (statusFilter && vehicle.status !== statusFilter) return false;
      const haystack = `${vehicle.name || ""} ${vehicle.plateLetters || ""} ${vehicle.plateNumbers || ""} ${vehicle.assignedToName || ""} ${vehicle.farmName || ""}`.toLowerCase();
      return !keyword || haystack.includes(keyword);
    });
  }, [items, search, statusFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    inWorkshop: items.filter((item) => item.status === "in_workshop").length,
    repairedUnpaid: items.filter((item) => item.status === "repaired_unpaid").length,
    available: items.filter((item) => item.status === "available" || !item.status).length,
  }), [items]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1); }, [currentPage, totalPages]);
  const paginatedItems = useMemo(() => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filteredItems, currentPage]);

  const openEntry = (vehicle) => {
    setEntryVehicle(vehicle);
    setEntryForm({ workshopName: "", faultReason: "", enteredAt: new Date().toISOString().slice(0, 10), notes: "" });
  };

  const enterWorkshop = async (e) => {
    e.preventDefault();
    if (!entryVehicle || savingAction) return;
    if (!entryForm.faultReason.trim()) return alert("سبب العطل مطلوب");
    setSavingAction(true);
    try {
      const entryPayload = { vehicleId: entryVehicle.id, vehicleName: entryVehicle.name || "", plateLetters: entryVehicle.plateLetters || "", plateNumbers: entryVehicle.plateNumbers || "", workshopName: entryForm.workshopName.trim(), faultReason: entryForm.faultReason.trim(), enteredAt: entryForm.enteredAt, exitedAt: "", status: "in_workshop", repairCost: 0, hasSpareParts: false, spareParts: [], totalSparePartsCost: 0, totalCost: 0, invoicePaid: false, invoiceStatus: "pending", notes: entryForm.notes.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const maintenanceRef = await addDoc(collection(db, "vehicleMaintenance"), entryPayload);
      await updateDoc(doc(db, "vehicles", entryVehicle.id), { status: "in_workshop", workshopEntryId: maintenanceRef.id, workshopName: entryForm.workshopName.trim(), faultReason: entryForm.faultReason.trim(), workshopEnteredAt: entryForm.enteredAt, updatedAt: serverTimestamp() });
      setEntryVehicle(null);
    } catch (error) { console.error(error); alert("تعذر إدخال السيارة الورشة"); }
    finally { setSavingAction(false); }
  };

  const openExit = (vehicle) => { setExitVehicle(vehicle); setExitForm(emptyExitForm); };
  const addPart = () => setExitForm((prev) => ({ ...prev, spareParts: [...prev.spareParts, { name: "", price: "" }] }));
  const updatePart = (index, key, value) => setExitForm((prev) => ({ ...prev, spareParts: prev.spareParts.map((part, i) => i === index ? { ...part, [key]: value } : part) }));
  const removePart = (index) => setExitForm((prev) => ({ ...prev, spareParts: prev.spareParts.filter((_, i) => i !== index) }));

  const calculatedTotals = useMemo(() => {
    const repairCost = Number(exitForm.repairCost || 0);
    const parts = exitForm.hasSpareParts === "yes" ? exitForm.spareParts.filter((part) => part.name.trim() || part.price) : [];
    const totalSparePartsCost = parts.reduce((sum, part) => sum + Number(part.price || 0), 0);
    return { repairCost, parts, totalSparePartsCost, totalCost: repairCost + totalSparePartsCost };
  }, [exitForm]);

  const exitWorkshop = async (e) => {
    e.preventDefault();
    if (!exitVehicle || savingAction) return;
    setSavingAction(true);
    try {
      const invoicePaid = exitForm.invoicePaid === "yes";
      const maintenanceId = exitVehicle.workshopEntryId;
      if (maintenanceId) {
        await updateDoc(doc(db, "vehicleMaintenance", maintenanceId), { exitedAt: exitForm.exitedAt, status: "completed", repairCost: calculatedTotals.repairCost, hasSpareParts: exitForm.hasSpareParts === "yes", spareParts: calculatedTotals.parts, totalSparePartsCost: calculatedTotals.totalSparePartsCost, totalCost: calculatedTotals.totalCost, invoicePaid, invoiceStatus: invoicePaid ? "paid" : "unpaid", exitNotes: exitForm.notes.trim(), updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "vehicleMaintenance"), { vehicleId: exitVehicle.id, vehicleName: exitVehicle.name || "", plateLetters: exitVehicle.plateLetters || "", plateNumbers: exitVehicle.plateNumbers || "", enteredAt: exitVehicle.workshopEnteredAt || "", exitedAt: exitForm.exitedAt, status: "completed", repairCost: calculatedTotals.repairCost, hasSpareParts: exitForm.hasSpareParts === "yes", spareParts: calculatedTotals.parts, totalSparePartsCost: calculatedTotals.totalSparePartsCost, totalCost: calculatedTotals.totalCost, invoicePaid, invoiceStatus: invoicePaid ? "paid" : "unpaid", notes: exitForm.notes.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      await updateDoc(doc(db, "vehicles", exitVehicle.id), { status: invoicePaid ? "available" : "repaired_unpaid", workshopEntryId: "", workshopName: "", faultReason: "", workshopEnteredAt: "", lastMaintenanceCost: calculatedTotals.totalCost, lastMaintenancePaid: invoicePaid, lastMaintenanceExitedAt: exitForm.exitedAt, updatedAt: serverTimestamp() });
      setExitVehicle(null);
    } catch (error) { console.error(error); alert("تعذر إخراج السيارة من الورشة"); }
    finally { setSavingAction(false); }
  };

  const markInvoicePaid = async (vehicle) => {
    if (!confirm("تأكيد سداد فاتورة السيارة؟")) return;
    try {
      const last = maintenance.filter((item) => item.vehicleId === vehicle.id && item.invoiceStatus === "unpaid").sort((a, b) => String(b.exitedAt || "").localeCompare(String(a.exitedAt || "")))[0];
      if (last?.id) await updateDoc(doc(db, "vehicleMaintenance", last.id), { invoicePaid: true, invoiceStatus: "paid", paidAt: new Date().toISOString().slice(0, 10), updatedAt: serverTimestamp() });
      await updateDoc(doc(db, "vehicles", vehicle.id), { status: "available", lastMaintenancePaid: true, updatedAt: serverTimestamp() });
    } catch (error) { console.error(error); alert("تعذر تسجيل السداد"); }
  };

  const remove = async (id) => {
    if (!canManage) return;
    if (!confirm("هل تريد حذف السيارة؟")) return;
    const target = items.find((item) => item.id === id);
    removeVehicleFromCache(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (!isOnline()) {
      addOfflineOperation({ collectionName: "vehicles", operation: "delete", documentId: id, payload: {}, meta: { label: "حذف سيارة", name: target?.name || "" } });
      alert("تم حذف السيارة محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }
    try { await deleteDoc(doc(db, "vehicles", id)); } catch (error) { console.error(error); alert("تعذر حذف السيارة"); }
  };

  return <ProtectedRoute><Layout title="إدارة السيارات">
    {initialLoading ? <AppLoader variant="compact" title="جاري تحميل السيارات..." subtitle="يتم تجهيز بيانات السيارات" /> : <>
      {realtimeError && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">{realtimeError}</div>}
      <div className="mb-4 grid gap-3 md:grid-cols-4"><div className="page-card p-5"><p className="text-sm font-bold text-slate-500">إجمالي السيارات</p><h3 className="mt-2 text-4xl font-black">{stats.total}</h3></div><div className="page-card p-5"><p className="text-sm font-bold text-slate-500">سليمة</p><h3 className="mt-2 text-4xl font-black text-green-700">{stats.available}</h3></div><div className="page-card p-5"><p className="text-sm font-bold text-slate-500">في الورشة</p><h3 className="mt-2 text-4xl font-black text-amber-700">{stats.inWorkshop}</h3></div><div className="page-card p-5"><p className="text-sm font-bold text-slate-500">اتصلحت وعليها فلوس</p><h3 className="mt-2 text-4xl font-black text-red-700">{stats.repairedUnpaid}</h3></div></div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="page-card flex flex-1 items-center gap-2 p-3"><FontAwesomeIcon icon={faMagnifyingGlass} className="text-slate-400" /><input className="w-full bg-transparent p-2 outline-none" placeholder="بحث باسم السيارة أو الراكب أو المزرعة أو حروف/أرقام اللوحة..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} /></div><select className="form-input lg:w-56" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}><option value="">كل الحالات</option><option value="available">سليمة</option><option value="in_workshop">في الورشة</option><option value="repaired_unpaid">اتصلحت وعليها فلوس</option></select><div className="flex flex-wrap gap-2"><button onClick={() => { setSearch(""); setStatusFilter(""); setCurrentPage(1); }} className="btn-secondary"><FontAwesomeIcon icon={faBroom} />مسح</button>{canManage && <Link href="/vehicles/add" className="btn-primary"><FontAwesomeIcon icon={faPlus} />إضافة سيارة</Link>}</div></div>
      <Link href="/vehicles/import" className="btn-secondary">
  استيراد Excel
</Link>
      <div className="page-card overflow-x-auto"><table className="w-full"><thead className="bg-slate-50"><tr><th className="table-th">السيارة</th><th className="table-th">اللوحة</th><th className="table-th">الراكب</th><th className="table-th">المكان / المزرعة</th><th className="table-th">الحالة</th><th className="table-th">آخر تكلفة</th><th className="table-th">الإجراءات</th></tr></thead><tbody>{paginatedItems.map((vehicle) => <tr key={vehicle.id} className="border-t border-slate-100"><td className="table-td font-bold">{vehicle.name || "-"}</td><td className="table-td"><span className="badge bg-slate-100 text-slate-700">{vehicle.plateLetters || "-"} / {vehicle.plateNumbers || "-"}</span></td><td className="table-td">{vehicle.assignedToName ? `${vehicle.assignedToName} (${typeLabel(vehicle.assignedToType)})` : "اختياري / غير محدد"}</td><td className="table-td">{vehicle.farmName || "اختياري / غير محدد"}</td><td className="table-td"><span className={`badge ${statusClass(vehicle.status)}`}>{statusLabel(vehicle.status)}</span></td><td className="table-td">{vehicle.lastMaintenanceCost ? `${vehicle.lastMaintenanceCost} ريال` : "-"}</td><td className="table-td"><div className="flex flex-wrap gap-2"><Link href={`/vehicles/${vehicle.id}`} className="btn-secondary !py-2"><FontAwesomeIcon icon={faEye} /></Link>{canManage && <Link href={`/vehicles/edit/${vehicle.id}`} className="btn-secondary !py-2"><FontAwesomeIcon icon={faPen} /></Link>}{canManage && vehicle.status !== "in_workshop" && <button onClick={() => openEntry(vehicle)} className="btn-secondary !py-2"><FontAwesomeIcon icon={faScrewdriverWrench} />إدخال الورشة</button>}{canManage && vehicle.status === "in_workshop" && <button onClick={() => openExit(vehicle)} className="btn-primary !py-2"><FontAwesomeIcon icon={faCheck} />خروج من الورشة</button>}{canManage && vehicle.status === "repaired_unpaid" && <button onClick={() => markInvoicePaid(vehicle)} className="btn-primary !py-2"><FontAwesomeIcon icon={faMoneyBill} />تسديد</button>}{canManage && <button onClick={() => remove(vehicle.id)} className="btn-danger !py-2"><FontAwesomeIcon icon={faTrash} /></button>}</div></td></tr>)}</tbody></table>{paginatedItems.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-500">لا توجد سيارات</div>}</div>
      <div className="mt-4 flex items-center justify-center gap-2"><button className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>السابق</button><span className="rounded-2xl bg-white px-4 py-2 text-sm font-black shadow">{currentPage} / {totalPages}</span><button className="btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>التالي</button></div>
    </>}

    {entryVehicle && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={enterWorkshop} className="page-card w-full max-w-2xl space-y-4 p-5"><h3 className="text-xl font-black">إدخال السيارة الورشة: {entryVehicle.name}</h3><input className="form-input" placeholder="اسم الورشة اختياري" value={entryForm.workshopName} onChange={(e) => setEntryForm({ ...entryForm, workshopName: e.target.value })} /><input className="form-input" type="date" value={entryForm.enteredAt} onChange={(e) => setEntryForm({ ...entryForm, enteredAt: e.target.value })} /><textarea className="form-input h-24" placeholder="سبب العطل" value={entryForm.faultReason} onChange={(e) => setEntryForm({ ...entryForm, faultReason: e.target.value })} /><textarea className="form-input h-20" placeholder="ملاحظات اختياري" value={entryForm.notes} onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })} /><div className="flex gap-2"><button disabled={savingAction} className="btn-primary">تأكيد الإدخال</button><button type="button" onClick={() => setEntryVehicle(null)} className="btn-secondary">إلغاء</button></div></form></div>}

    {exitVehicle && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"><form onSubmit={exitWorkshop} className="page-card my-8 w-full max-w-3xl space-y-4 p-5"><h3 className="text-xl font-black">خروج السيارة من الورشة: {exitVehicle.name}</h3><div className="grid gap-4 md:grid-cols-2"><input className="form-input" type="date" value={exitForm.exitedAt} onChange={(e) => setExitForm({ ...exitForm, exitedAt: e.target.value })} /><input className="form-input" type="number" min="0" placeholder="سعر الصيانة الأساسي" value={exitForm.repairCost} onChange={(e) => setExitForm({ ...exitForm, repairCost: e.target.value })} /><select className="form-input" value={exitForm.hasSpareParts} onChange={(e) => setExitForm({ ...exitForm, hasSpareParts: e.target.value })}><option value="no">لا يوجد قطع غيار</option><option value="yes">يوجد قطع غيار</option></select><select className="form-input" value={exitForm.invoicePaid} onChange={(e) => setExitForm({ ...exitForm, invoicePaid: e.target.value })}><option value="no">الفاتورة غير مسددة</option><option value="yes">الفاتورة مسددة</option></select></div>{exitForm.hasSpareParts === "yes" && <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><h4 className="font-black">قطع الغيار</h4><button type="button" onClick={addPart} className="btn-secondary !py-2">إضافة قطعة</button></div><div className="space-y-2">{exitForm.spareParts.map((part, index) => <div key={index} className="grid gap-2 md:grid-cols-[1fr_160px_auto]"><input className="form-input" placeholder="اسم القطعة" value={part.name} onChange={(e) => updatePart(index, "name", e.target.value)} /><input className="form-input" type="number" min="0" placeholder="السعر" value={part.price} onChange={(e) => updatePart(index, "price", e.target.value)} /><button type="button" onClick={() => removePart(index)} className="btn-danger !py-2">حذف</button></div>)}</div></div>}<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-green-50 p-4 font-black text-green-700">الصيانة: {calculatedTotals.repairCost}</div><div className="rounded-2xl bg-blue-50 p-4 font-black text-blue-700">قطع الغيار: {calculatedTotals.totalSparePartsCost}</div><div className="rounded-2xl bg-slate-900 p-4 font-black text-white">الإجمالي: {calculatedTotals.totalCost}</div></div><textarea className="form-input h-20" placeholder="ملاحظات الفاتورة اختياري" value={exitForm.notes} onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })} /><div className="flex gap-2"><button disabled={savingAction} className="btn-primary">تسجيل الخروج والفاتورة</button><button type="button" onClick={() => setExitVehicle(null)} className="btn-secondary">إلغاء</button></div></form></div>}
  </Layout></ProtectedRoute>;
}

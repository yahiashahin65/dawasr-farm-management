import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { subscribeCachedCollection } from "../../lib/realtimeCache";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

const statusLabel = (status) => status === "in_workshop" ? "في الورشة" : status === "repaired_unpaid" ? "تم الإصلاح وعليه فاتورة" : "سليمة";

export default function VehicleDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [vehicle, setVehicle] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, "vehicles", id));
      setVehicle(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({ db, collectionName: "vehicleMaintenance", cacheKey: "cache:vehicleMaintenance", orderField: "enteredAt", orderDirection: "desc", onData: setMaintenance });
    return () => unsubscribe?.();
  }, []);

  const history = useMemo(() => maintenance.filter((item) => item.vehicleId === id), [maintenance, id]);

  return <ProtectedRoute><Layout title="تفاصيل السيارة">{loading ? <AppLoader variant="compact" title="جاري تحميل السيارة..." /> : !vehicle ? <div className="page-card p-5 text-center font-bold text-slate-500">السيارة غير موجودة</div> : <div className="space-y-4"><div className="page-card p-5"><h2 className="text-2xl font-black">{vehicle.name}</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><p><b>اللوحة:</b> {vehicle.plateLetters || "-"} / {vehicle.plateNumbers || "-"}</p><p><b>الحالة:</b> {statusLabel(vehicle.status)}</p><p><b>الراكب / المسؤول:</b> {vehicle.assignedToName || "غير محدد"}</p><p><b>المكان / المزرعة:</b> {vehicle.farmName || "غير محدد"}</p><p><b>آخر تكلفة:</b> {vehicle.lastMaintenanceCost ? `${vehicle.lastMaintenanceCost} ريال` : "-"}</p><p><b>ملاحظات:</b> {vehicle.notes || "-"}</p></div></div><div className="page-card overflow-x-auto"><div className="p-5 pb-3"><h3 className="font-black">تاريخ صيانة السيارة</h3></div><table className="w-full"><thead className="bg-slate-50"><tr><th className="table-th">دخول الورشة</th><th className="table-th">الخروج</th><th className="table-th">سبب العطل</th><th className="table-th">الصيانة</th><th className="table-th">قطع الغيار</th><th className="table-th">الإجمالي</th><th className="table-th">السداد</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="table-td">{item.enteredAt || "-"}</td><td className="table-td">{item.exitedAt || "-"}</td><td className="table-td">{item.faultReason || "-"}</td><td className="table-td">{item.repairCost || 0}</td><td className="table-td">{item.totalSparePartsCost || 0}</td><td className="table-td font-black">{item.totalCost || 0}</td><td className="table-td">{item.invoiceStatus === "paid" ? "مسددة" : item.invoiceStatus === "unpaid" ? "غير مسددة" : "قيد العمل"}</td></tr>)}</tbody></table>{history.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-500">لا يوجد سجل صيانة لهذه السيارة</div>}</div></div>}</Layout></ProtectedRoute>;
}

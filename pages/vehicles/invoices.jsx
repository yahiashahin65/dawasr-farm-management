import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { subscribeCachedCollection } from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faBroom,
  faMoneyBill,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";

export default function VehicleInvoices() {
  const { canManage } = useUserRole();

  const [maintenance, setMaintenance] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [farmFilter, setFarmFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState("");

  useEffect(() => {
    const unsubscribeMaintenance = subscribeCachedCollection({
      db,
      collectionName: "vehicleMaintenance",
      cacheKey: "cache:vehicleMaintenance",
      orderField: "enteredAt",
      orderDirection: "desc",
      onData: setMaintenance,
      onLoading: setLoading,
    });

    const unsubscribeVehicles = subscribeCachedCollection({
      db,
      collectionName: "vehicles",
      cacheKey: "cache:vehicles",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setVehicles,
    });

    return () => {
      unsubscribeMaintenance?.();
      unsubscribeVehicles?.();
    };
  }, []);

  const vehicleMap = useMemo(() => {
    const map = {};

    vehicles.forEach((vehicle) => {
      map[vehicle.id] = vehicle;
    });

    return map;
  }, [vehicles]);

  const unpaidInvoices = useMemo(() => {
    return maintenance
      .filter((item) => item.invoiceStatus === "unpaid")
      .map((item) => {
        const vehicle = vehicleMap[item.vehicleId] || {};

        return {
          ...item,
          vehicleName: item.vehicleName || vehicle.name || "",
          plateLetters: item.plateLetters || vehicle.plateLetters || "",
          plateNumbers: item.plateNumbers || vehicle.plateNumbers || "",
          farmName: vehicle.farmName || item.farmName || "",
        };
      });
  }, [maintenance, vehicleMap]);

  const farms = useMemo(() => {
    return Array.from(
      new Set(unpaidInvoices.map((item) => item.farmName).filter(Boolean))
    );
  }, [unpaidInvoices]);

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return unpaidInvoices.filter((invoice) => {
      if (farmFilter && invoice.farmName !== farmFilter) return false;

      const text = `
        ${invoice.vehicleName || ""}
        ${invoice.plateLetters || ""}
        ${invoice.plateNumbers || ""}
        ${invoice.farmName || ""}
        ${invoice.faultReason || ""}
      `.toLowerCase();

      return !keyword || text.includes(keyword);
    });
  }, [unpaidInvoices, search, farmFilter]);

  const stats = useMemo(() => {
    const totalAmount = filteredInvoices.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0
    );

    const vehicleIds = new Set(filteredInvoices.map((item) => item.vehicleId));

    return {
      invoicesCount: filteredInvoices.length,
      vehiclesCount: vehicleIds.size,
      totalAmount,
    };
  }, [filteredInvoices]);

  const markInvoicePaid = async (invoice) => {
    if (!canManage) return;
    if (!confirm("تأكيد تسديد هذه الفاتورة؟")) return;

    setPayingId(invoice.id);

    try {
      await updateDoc(doc(db, "vehicleMaintenance", invoice.id), {
        invoicePaid: true,
        invoiceStatus: "paid",
        paidAt: new Date().toISOString().slice(0, 10),
        updatedAt: serverTimestamp(),
      });

      const hasOtherUnpaid = maintenance.some(
        (item) =>
          item.id !== invoice.id &&
          item.vehicleId === invoice.vehicleId &&
          item.invoiceStatus === "unpaid"
      );

      await updateDoc(doc(db, "vehicles", invoice.vehicleId), {
        status: "صالح",
        hasUnpaidInvoices: hasOtherUnpaid,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("تعذر تسديد الفاتورة");
    } finally {
      setPayingId("");
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تسديد فواتير السيارات">
        {loading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الفواتير..."
            subtitle="يتم تجهيز فواتير الصيانة غير المسددة"
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Link href="/vehicles" className="btn-secondary">
                <FontAwesomeIcon icon={faArrowRight} />
                رجوع للسيارات
              </Link>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي الفواتير غير المسددة
                </p>
                <h3 className="mt-2 text-4xl font-black text-red-700">
                  {stats.totalAmount}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-400">ريال</p>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  عدد الفواتير غير المسددة
                </p>
                <h3 className="mt-2 text-4xl font-black">
                  {stats.invoicesCount}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  سيارات عليها فواتير
                </p>
                <h3 className="mt-2 text-4xl font-black">
                  {stats.vehiclesCount}
                </h3>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row">
              <div className="page-card flex flex-1 items-center gap-2 p-3">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-slate-400"
                />
                <input
                  className="w-full bg-transparent p-2 outline-none"
                  placeholder="بحث باسم السيارة أو اللوحة أو سبب العطل..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="form-input lg:w-64"
                value={farmFilter}
                onChange={(e) => setFarmFilter(e.target.value)}
              >
                <option value="">كل المزارع / الأماكن</option>
                {farms.map((farm) => (
                  <option key={farm} value={farm}>
                    {farm}
                  </option>
                ))}
              </select>

              <button
                className="btn-secondary"
                onClick={() => {
                  setSearch("");
                  setFarmFilter("");
                }}
              >
                <FontAwesomeIcon icon={faBroom} />
                مسح
              </button>
            </div>

            <div className="page-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">السيارة</th>
                    <th className="table-th">اللوحة</th>
                    <th className="table-th">المكان / المزرعة</th>
                    <th className="table-th">دخول الورشة</th>
                    <th className="table-th">الخروج</th>
                    <th className="table-th">سبب العطل</th>
                    <th className="table-th">الصيانة</th>
                    <th className="table-th">قطع الغيار</th>
                    <th className="table-th">الإجمالي</th>

                    {canManage && <th className="table-th">الإجراء</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-slate-100">
                      <td className="table-td font-bold">
                        <Link href={`/vehicles/${invoice.vehicleId}`}>
                          {invoice.vehicleName || "-"}
                        </Link>
                      </td>

                      <td className="table-td">
                        {invoice.plateLetters || "-"} /{" "}
                        {invoice.plateNumbers || "-"}
                      </td>

                      <td className="table-td">{invoice.farmName || "-"}</td>

                      <td className="table-td">{invoice.enteredAt || "-"}</td>
                      <td className="table-td">{invoice.exitedAt || "-"}</td>
                      <td className="table-td">{invoice.faultReason || "-"}</td>
                      <td className="table-td">{invoice.repairCost || 0}</td>
                      <td className="table-td">
                        {invoice.totalSparePartsCost || 0}
                      </td>

                      <td className="table-td font-black text-red-700">
                        {invoice.totalCost || 0} ريال
                      </td>

                      {canManage && (
                        <td className="table-td">
                          <button
                            type="button"
                            disabled={payingId === invoice.id}
                            onClick={() => markInvoicePaid(invoice)}
                            className="btn-primary !py-2"
                          >
                            <FontAwesomeIcon icon={faMoneyBill} />
                            {payingId === invoice.id ? "جاري..." : "تسديد"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredInvoices.length === 0 && (
                <div className="p-8 text-center text-sm font-bold text-slate-500">
                  لا توجد فواتير غير مسددة
                </div>
              )}
            </div>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { getCachedCollection } from "../../lib/realtimeCache";
import { isOnline } from "../../lib/offlineQueue";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

const getAccountantFromCache = (accountantId) => {
  const cached = getCachedCollection("cache:accountants");
  return cached.find((item) => item.id === accountantId) || null;
};

const getAccountantVehiclesFromCache = (accountantId) => {
  const cached = getCachedCollection("cache:vehicles");

  return cached.filter(
    (vehicle) =>
      vehicle.assignedToType === "accountant" &&
      vehicle.assignedToId === accountantId
  );
};

const vehicleStatusLabel = (status) => {
  if (status === "in_workshop") return "في الورشة";
  if (status === "repaired_unpaid") return "تم الإصلاح وعليه فاتورة";
  if (status === "repaired_paid") return "تم الإصلاح والفاتورة مسددة";
  if (status === "عاطل") return "عاطل";
  return "صالح";
};

export default function AccountantDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [item, setItem] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);

      try {
        const cachedAccountant = getAccountantFromCache(id);
        const cachedVehicles = getAccountantVehiclesFromCache(id);

        if (cachedAccountant) {
          setItem(cachedAccountant);
          setVehicles(cachedVehicles);

          if (!isOnline()) {
            setOfflineNotice("يتم عرض البيانات من الكاش لأن الجهاز غير متصل");
            setLoading(false);
            return;
          }
        }

        const [accountantSnap, vehiclesSnap] = await Promise.all([
          getDoc(doc(db, "accountants", id)),
          getDocs(
            query(
              collection(db, "vehicles"),
              where("assignedToType", "==", "accountant"),
              where("assignedToId", "==", id)
            )
          ),
        ]);

        if (accountantSnap.exists()) {
          setItem({
            id: accountantSnap.id,
            ...accountantSnap.data(),
          });
        } else if (!cachedAccountant) {
          setItem(null);
        }

        setVehicles(
          vehiclesSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error(error);

        const cachedAccountant = getAccountantFromCache(id);

        if (cachedAccountant) {
          setItem(cachedAccountant);
          setVehicles(getAccountantVehiclesFromCache(id));
          setOfflineNotice("تعذر الاتصال، يتم عرض آخر نسخة محفوظة من الكاش");
        } else {
          setItem(null);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل محاسب">
        {loading ? (
          <AppLoader variant="compact" title="جاري التحميل..." />
        ) : !item ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            المحاسب غير موجود
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="page-card p-5">
              {offlineNotice && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                  {offlineNotice}
                </div>
              )}

              {item.syncStatus === "pending" && (
                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
                  هذا المحاسب قيد المزامنة وسيتم رفع التغييرات عند عودة الاتصال
                </div>
              )}

              <h2 className="text-2xl font-black">{item.name || "-"}</h2>

              <div className="mt-4 grid gap-3">
                <p>
                  <b>الجوال:</b> {item.phone || "-"}
                </p>

                <p>
                  <b>ملاحظات:</b> {item.notes || "-"}
                </p>
              </div>

              <div className="mt-5 rounded-2xl bg-purple-50 p-4 text-purple-800">
                <b>{vehicles.length}</b>
                <span className="mr-2 text-sm font-bold">
                  سيارة مسجلة على المحاسب
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/accountants/edit/${item.id}`}
                  className="btn-primary"
                >
                  تعديل المحاسب
                </Link>

                <Link href="/accountants" className="btn-secondary">
                  رجوع للمحاسبين
                </Link>
              </div>
            </div>

            <div className="page-card p-5 lg:col-span-2">
              <h3 className="mb-4 font-black">
                السيارات المسجلة على المحاسب
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {vehicles.length ? (
                  vehicles.map((vehicle) => (
                    <Link
                      key={vehicle.id}
                      href={`/vehicles/${vehicle.id}`}
                      className="rounded-2xl border p-4 hover:bg-slate-50"
                    >
                      <b>{vehicle.name || "-"}</b>

                      <p className="mt-1 text-sm text-slate-500">
                        {vehicle.plateLetters || "-"} /{" "}
                        {vehicle.plateNumbers || "-"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {vehicle.farmName || "غير محدد"}
                      </p>

                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {vehicleStatusLabel(vehicle.status)}
                      </p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    لا توجد سيارات مسجلة على هذا المحاسب.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

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
import useUserRole from "../../hooks/useUserRole";

const getEngineerFromCache = (engineerId) => {
  const cached = getCachedCollection("cache:engineers");
  return cached.find((item) => item.id === engineerId) || null;
};

const getEngineerFarmsFromCache = (engineerId) => {
  const cached = getCachedCollection("cache:farms");

  return cached.filter((farm) =>
    Array.isArray(farm.engineerIds)
      ? farm.engineerIds.includes(engineerId)
      : false
  );
};

const getEngineerVehiclesFromCache = (engineerId) => {
  const cached = getCachedCollection("cache:vehicles");

  return cached.filter(
    (vehicle) =>
      vehicle.assignedToType === "engineer" &&
      vehicle.assignedToId === engineerId
  );
};

const vehicleStatusLabel = (status) => {
  if (status === "in_workshop") return "في الورشة";
  if (status === "repaired_unpaid") return "تم الإصلاح وعليه فاتورة";
  if (status === "repaired_paid") return "تم الإصلاح والفاتورة مسددة";
  if (status === "عاطل") return "عاطل";
  return "صالح";
};

export default function EngineerDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [engineer, setEngineer] = useState(null);
  const [farms, setFarms] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setInitialLoading(true);

      try {
        const cachedEngineer = getEngineerFromCache(id);
        const cachedFarms = getEngineerFarmsFromCache(id);
        const cachedVehicles = getEngineerVehiclesFromCache(id);

        if (cachedEngineer) {
          setEngineer(cachedEngineer);
          setFarms(cachedFarms);
          setVehicles(cachedVehicles);

          if (!isOnline()) {
            setOfflineNotice("يتم عرض البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [engineerSnap, farmsSnap, vehiclesSnap] = await Promise.all([
          getDoc(doc(db, "engineers", id)),
          getDocs(
            query(
              collection(db, "farms"),
              where("engineerIds", "array-contains", id)
            )
          ),
          getDocs(
            query(
              collection(db, "vehicles"),
              where("assignedToType", "==", "engineer"),
              where("assignedToId", "==", id)
            )
          ),
        ]);

        if (engineerSnap.exists()) {
          setEngineer({
            id: engineerSnap.id,
            ...engineerSnap.data(),
          });
        } else if (!cachedEngineer) {
          setEngineer(null);
        }

        setFarms(
          farmsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setVehicles(
          vehiclesSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error(error);

        const cachedEngineer = getEngineerFromCache(id);

        if (cachedEngineer) {
          setEngineer(cachedEngineer);
          setFarms(getEngineerFarmsFromCache(id));
          setVehicles(getEngineerVehiclesFromCache(id));
          setOfflineNotice("تعذر الاتصال، يتم عرض آخر نسخة محفوظة من الكاش");
        } else {
          setEngineer(null);
        }
      } finally {
        setInitialLoading(false);
      }
    };

    load();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل المهندس">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل تفاصيل المهندس..."
            subtitle="يتم تجهيز بيانات المهندس والمزارع والسيارات"
          />
        ) : !engineer ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            المهندس غير موجود
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="page-card p-5">
              {offlineNotice && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                  {offlineNotice}
                </div>
              )}

              {engineer.syncStatus === "pending" && (
                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
                  هذا المهندس قيد المزامنة وسيتم رفع التغييرات عند عودة الاتصال
                </div>
              )}

              <h3 className="text-lg font-black">{engineer.name || "-"}</h3>

              <p className="mt-2 text-sm text-slate-500">
                {engineer.phone || "لا يوجد رقم"}
              </p>

              <p className="mt-3 text-sm">{engineer.notes || "-"}</p>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl bg-green-50 p-4 text-green-800">
                  <b>{farms.length}</b>
                  <span className="mr-2 text-sm font-bold">
                    مزرعة مسؤول عنها
                  </span>
                </div>

                <div className="rounded-2xl bg-purple-50 p-4 text-purple-800">
                  <b>{vehicles.length}</b>
                  <span className="mr-2 text-sm font-bold">
                    سيارة مسجلة على المهندس
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {canManage && (
                  <Link
                    href={`/engineers/edit/${engineer.id}`}
                    className="btn-primary"
                  >
                    تعديل المهندس
                  </Link>
                )}

                <Link href="/engineers" className="btn-secondary">
                  رجوع للمهندسين
                </Link>
              </div>
            </div>

            <div className="space-y-5 lg:col-span-2">
              <div className="page-card p-5">
                <h3 className="mb-4 font-black">المزارع المسئول عنها</h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  {farms.length ? (
                    farms.map((farm) => (
                      <Link
                        key={farm.id}
                        href={`/farms/${farm.id}`}
                        className="rounded-2xl border p-4 font-bold hover:bg-slate-50"
                      >
                        {farm.name || "-"}
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      لا توجد مزارع مسجلة على هذا المهندس.
                    </p>
                  )}
                </div>
              </div>

              <div className="page-card p-5">
                <h3 className="mb-4 font-black">
                  السيارات المسجلة على المهندس
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
                      لا توجد سيارات مسجلة على هذا المهندس.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

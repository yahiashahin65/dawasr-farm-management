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

const getFarmFromCache = (farmId) => {
  const cached = getCachedCollection("cache:farms");
  return cached.find((item) => item.id === farmId) || null;
};

const getFarmAssetsFromCache = (farmId) => {
  const cached = getCachedCollection("cache:assets");

  return cached.filter(
    (asset) =>
      (asset.placeType === "farm" && asset.placeId === farmId) ||
      asset.farmId === farmId
  );
};

export default function FarmDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [farm, setFarm] = useState(null);
  const [assets, setAssets] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setInitialLoading(true);

      try {
        const cachedFarm = getFarmFromCache(id);
        const cachedAssets = getFarmAssetsFromCache(id);

        if (cachedFarm) {
          setFarm(cachedFarm);
          setAssets(cachedAssets);

          if (!isOnline()) {
            setOfflineNotice("يتم عرض البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [farmSnap, assetsSnap] = await Promise.all([
          getDoc(doc(db, "farms", id)),
          getDocs(
            query(
              collection(db, "assets"),
              where("placeId", "==", id),
              where("placeType", "==", "farm")
            )
          ),
        ]);

        if (farmSnap.exists()) {
          setFarm({
            id: farmSnap.id,
            ...farmSnap.data(),
          });
        } else if (!cachedFarm) {
          setFarm(null);
        }

        setAssets(
          assetsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error(error);

        const cachedFarm = getFarmFromCache(id);

        if (cachedFarm) {
          setFarm(cachedFarm);
          setAssets(getFarmAssetsFromCache(id));
          setOfflineNotice("تعذر الاتصال، يتم عرض آخر نسخة محفوظة من الكاش");
        } else {
          setFarm(null);
        }
      } finally {
        setInitialLoading(false);
      }
    };

    load();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل المزرعة">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل تفاصيل المزرعة..."
            subtitle="يتم تجهيز بيانات المزرعة والمعدات"
          />
        ) : !farm ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            المزرعة غير موجودة
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="page-card p-5">
              {offlineNotice && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                  {offlineNotice}
                </div>
              )}

              {farm.syncStatus === "pending" && (
                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
                  هذه المزرعة قيد المزامنة وسيتم رفع التغييرات عند عودة الاتصال
                </div>
              )}

              <h3 className="text-lg font-black">{farm.name || "-"}</h3>

              <p className="mt-2 text-sm text-slate-500">
                مسئول المزرعة: {farm.managerName || "-"}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                المهندسون: {farm.engineerNames || "-"}
              </p>

              <p className="mt-3 text-sm">{farm.notes || "-"}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {canManage && (
                  <Link href={`/farms/edit/${farm.id}`} className="btn-primary">
                    تعديل المزرعة
                  </Link>
                )}

                <Link href="/farms" className="btn-secondary">
                  رجوع للمزارع
                </Link>
              </div>
            </div>

            <div className="page-card p-5 lg:col-span-2">
              <h3 className="mb-4 font-black">معدات المزرعة</h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {assets.length ? (
                  assets.map((asset) => (
                    <Link
                      key={asset.id}
                      href={`/assets/${asset.id}`}
                      className="rounded-2xl border p-4 hover:bg-slate-50"
                    >
                      <b>{asset.name || "-"}</b>

                      <p className="text-xs text-slate-500">
                        {asset.status || "-"}
                      </p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    لا توجد معدات مسجلة على هذه المزرعة.
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

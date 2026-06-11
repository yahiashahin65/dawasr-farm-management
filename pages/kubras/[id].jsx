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

const getKubraFromCache = (kubraId) => {
  const cached = getCachedCollection("cache:kubras");
  return cached.find((item) => item.id === kubraId) || null;
};

const getKubraAssetsFromCache = (kubraId) => {
  const cached = getCachedCollection("cache:assets");

  return cached.filter(
    (asset) =>
      (asset.placeType === "kubra" && asset.placeId === kubraId) ||
      asset.kubraId === kubraId
  );
};

export default function KubraDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [kubra, setKubra] = useState(null);
  const [assets, setAssets] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setInitialLoading(true);

      try {
        const cachedKubra = getKubraFromCache(id);
        const cachedAssets = getKubraAssetsFromCache(id);

        if (cachedKubra) {
          setKubra(cachedKubra);
          setAssets(cachedAssets);

          if (!isOnline()) {
            setOfflineNotice("يتم عرض البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [kubraSnap, assetsSnap] = await Promise.all([
          getDoc(doc(db, "kubras", id)),
          getDocs(
            query(
              collection(db, "assets"),
              where("placeId", "==", id),
              where("placeType", "==", "kubra")
            )
          ),
        ]);

        if (kubraSnap.exists()) {
          setKubra({
            id: kubraSnap.id,
            ...kubraSnap.data(),
          });
        } else if (!cachedKubra) {
          setKubra(null);
        }

        setAssets(
          assetsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error(error);

        const cachedKubra = getKubraFromCache(id);

        if (cachedKubra) {
          setKubra(cachedKubra);
          setAssets(getKubraAssetsFromCache(id));
          setOfflineNotice("تعذر الاتصال، يتم عرض آخر نسخة محفوظة من الكاش");
        } else {
          setKubra(null);
        }
      } finally {
        setInitialLoading(false);
      }
    };

    load();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل الكِبرة">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل تفاصيل الكِبرة..."
            subtitle="يتم تجهيز بيانات الكِبرة والمعدات"
          />
        ) : !kubra ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            الكِبرة غير موجودة
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="page-card p-5">
              {offlineNotice && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                  {offlineNotice}
                </div>
              )}

              {kubra.syncStatus === "pending" && (
                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
                  هذه الكِبرة قيد المزامنة وسيتم رفع التغييرات عند عودة الاتصال
                </div>
              )}

              <h3 className="text-lg font-black">{kubra.name || "-"}</h3>

              <p className="mt-3 text-sm text-slate-500">
                {kubra.notes || "-"}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {canManage && (
                  <Link href={`/kubras/edit/${kubra.id}`} className="btn-primary">
                    تعديل الكِبرة
                  </Link>
                )}

                <Link href="/kubras" className="btn-secondary">
                  رجوع للكِبر
                </Link>
              </div>
            </div>

            <div className="page-card p-5 lg:col-span-2">
              <h3 className="mb-4 font-black">المعدات داخل الكِبرة</h3>

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
                    لا توجد معدات مسجلة داخل هذه الكِبرة.
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

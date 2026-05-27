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

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

const normalizeMovement = (value) => {
  const text = String(value || "").trim();

  if (text.includes("ثلاث") || text.includes("3") || text.includes("تلات")) {
    return "ثلاث أرباع دائري";
  }

  if (text.includes("نصين") || text.includes("نصفين")) {
    return "نصين";
  }

  if (text.includes("نصف") || text.includes("نص")) {
    return "نصف دائري";
  }

  if (text.includes("دائري") || text.includes("دايري")) {
    return "دائري";
  }

  return text || "-";
};

export default function WorkerDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [worker, setWorker] = useState(null);
  const [assets, setAssets] = useState([]);
  const [sprinklers, setSprinklers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setInitialLoading(true);

      try {
        const [workerSnap, assetsSnap, sprinklersSnap] = await Promise.all([
          getDoc(doc(db, "workers", id)),
          getDocs(
            query(
              collection(db, "assets"),
              where("workerIds", "array-contains", id)
            )
          ),
          getDocs(
            query(
              collection(db, "sprinklers"),
              where("workerId", "==", id)
            )
          ),
        ]);

        if (workerSnap.exists()) {
          setWorker({
            id: workerSnap.id,
            ...workerSnap.data(),
          });
        } else {
          setWorker(null);
        }

        setAssets(
          assetsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setSprinklers(
          sprinklersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء تحميل بيانات العامل");
      } finally {
        setInitialLoading(false);
      }
    };

    load();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل العامل">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل تفاصيل العامل..."
            subtitle="يتم تجهيز بيانات العامل والعهد والرشاشات"
          />
        ) : !worker ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            العامل غير موجود
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="page-card p-5">
              <h3 className="text-lg font-black text-slate-900">
                {worker.name || "-"}
              </h3>

              <p className="mt-3 text-sm text-slate-600">
                الجوال: {worker.phone || "-"}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                الجنسية: {worker.nationality || "-"}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                ملاحظات: {worker.notes || "-"}
              </p>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl bg-green-50 p-4 text-green-800">
                  <b>{assets.length}</b>
                  <span className="mr-2 text-sm font-bold">
                    معدة مسجلة على العامل
                  </span>
                </div>

                <div className="rounded-2xl bg-blue-50 p-4 text-blue-800">
                  <b>{sprinklers.length}</b>
                  <span className="mr-2 text-sm font-bold">
                    رشاش مسجل على العامل
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-5 lg:col-span-2">
              <div className="page-card p-5">
                <h3 className="mb-4 text-lg font-black">
                  العهد المسجلة على العامل
                </h3>

                <div className="grid gap-3 md:grid-cols-2">
                  {assets.length ? (
                    assets.map((asset) => (
                      <Link
                        key={asset.id}
                        href={`/assets/edit/${asset.id}`}
                        className="rounded-2xl border border-slate-100 p-4 hover:bg-slate-50"
                      >
                        <b>{asset.name || "-"}</b>

                        <p className="mt-1 text-sm text-slate-500">
                          {asset.placeName ||
                            asset.farmName ||
                            asset.kubraName ||
                            "-"}{" "}
                          — {asset.status || "-"}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      لا توجد عهد مسجلة.
                    </p>
                  )}
                </div>
              </div>

              <div className="page-card p-5">
                <h3 className="mb-4 text-lg font-black">
                  الرشاشات المسجلة على العامل
                </h3>

                <div className="grid gap-3 md:grid-cols-2">
                  {sprinklers.length ? (
                    sprinklers.map((sprinkler) => (
                      <Link
                        key={sprinkler.id}
                        href={`/sprinklers/${sprinkler.id}`}
                        className="rounded-2xl border border-slate-100 p-4 hover:bg-slate-50"
                      >
                        <b>{sprinkler.name || sprinkler.sprinklerName || "-"}</b>

                        <p className="mt-1 text-sm text-slate-500">
                          {sprinkler.farmName || "-"} —{" "}
                          {sprinkler.machineName || sprinkler.machine || "-"}
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {sprinkler.cropType || "-"} —{" "}
                          {normalizeMovement(sprinkler.movementType)}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      لا توجد رشاشات مسجلة.
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

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faPen,
  faSeedling,
} from "@fortawesome/free-solid-svg-icons";

function InfoItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-base font-black text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

export default function SprinklerDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [item, setItem] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadSprinkler = async () => {
      setInitialLoading(true);

      try {
        const snap = await getDoc(doc(db, "sprinklers", id));

        if (snap.exists()) {
          setItem({ id: snap.id, ...snap.data() });
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء تحميل بيانات الرشاش");
      } finally {
        setInitialLoading(false);
      }
    };

    loadSprinkler();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل الرشاش">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل تفاصيل الرشاش..."
            subtitle="يتم تجهيز بيانات الرشاش"
          />
        ) : !item ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            الرشاش غير موجود
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/sprinklers" className="btn-secondary">
                <FontAwesomeIcon icon={faArrowRight} />
                رجوع للرشاشات
              </Link>

              {canManage && (
                <Link href={`/sprinklers/edit/${item.id}`} className="btn-primary">
                  <FontAwesomeIcon icon={faPen} />
                  تعديل الرشاش
                </Link>
              )}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="page-card overflow-hidden lg:col-span-1">
                <div className="flex h-72 items-center justify-center bg-slate-100">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name || "رشاش"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl font-black text-slate-300">-</span>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700">
                      <FontAwesomeIcon icon={faSeedling} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-400">اسم الرشاش</p>
                      <h2 className="text-2xl font-black text-slate-900">
                        {item.name || "-"}
                      </h2>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="badge bg-green-50 text-green-700">
                      {item.farmName || "-"}
                    </span>
                    <span className="badge bg-amber-50 text-amber-700">
                      {item.cropType || "-"}
                    </span>
                    <span className="badge bg-blue-50 text-blue-700">
                      {item.movement || "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="page-card p-5 lg:col-span-2">
                <h3 className="mb-4 text-lg font-black text-slate-900">
                  بيانات الرشاش
                </h3>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <InfoItem label="المكينة" value={item.machine} />
                  <InfoItem label="عدد الأبراج" value={item.towersCount} />
                  <InfoItem label="الجير" value={item.gear} />
                  <InfoItem label="التسلسل" value={item.sequence} />
                  <InfoItem label="المزرعة" value={item.farmName} />
                  <InfoItem label="حركة الرشاش" value={item.movement} />
                  <InfoItem label="نوع المحصول" value={item.cropType} />
                  <InfoItem label="رقم هكتار" value={item.hectareNumber} />
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-bold text-slate-400">العامل</p>
                    {item.workerId ? (
                      <Link
                        href={`/workers/${item.workerId}`}
                        className="mt-2 inline-block text-base font-black text-green-700 hover:underline"
                      >
                        {item.workerName || "-"}
                      </Link>
                    ) : (
                      <p className="mt-2 text-base font-black text-slate-800">
                        {item.workerName || "-"}
                      </p>
                    )}
                  </div>
                  <InfoItem label="جوال العامل" value={item.workerPhone} />
                </div>
              </div>
            </div>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
                   }

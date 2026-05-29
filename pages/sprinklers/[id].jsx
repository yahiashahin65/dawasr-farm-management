import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

const normalizeMovement = (value) => {
  const text = String(value || "").trim();

  if (text.includes("ثلاث") || text.includes("3") || text.includes("تلات")) {
    return "ثلاث أرباع دائري";
  }

  if (text.includes("نصين") || text.includes("نصفين")) return "نصين";
  if (text.includes("نصف") || text.includes("نص")) return "نصف دائري";
  if (text.includes("دائري") || text.includes("دايري")) return "دائري";

  return text || "-";
};

const getTowersCount = (item) =>
  item?.towersCount ??
  item?.towerCount ??
  item?.towersNumber ??
  item?.towers ??
  "";

const getHectareNumber = (item) =>
  item?.hectareNumber ??
  item?.hectare ??
  item?.hectar ??
  item?.hiktar ??
  "";

function InfoCard({ label, value, href = null }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-sm font-bold text-slate-400">{label}</p>

      {href ? (
        <Link
          href={href}
          className="mt-2 block text-lg font-black text-slate-900 hover:underline"
        >
          {value || "-"}
        </Link>
      ) : (
        <h3 className="mt-2 text-lg font-black text-slate-900">
          {value || "-"}
        </h3>
      )}
    </div>
  );
}

export default function SprinklerDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [item, setItem] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const snap = await getDoc(doc(db, "sprinklers", id));

        if (!snap.exists()) {
          setItem(null);
          return;
        }

        setItem({
          id: snap.id,
          ...snap.data(),
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [id]);

  return (
    <ProtectedRoute>
      <Layout title="تفاصيل الرشاش">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات الرشاش..."
            subtitle="يتم تجهيز التفاصيل"
          />
        ) : !item ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            الرشاش غير موجود
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="page-card overflow-hidden p-4">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name || "رشاش"}
                  className="h-[320px] w-full rounded-3xl object-cover"
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center rounded-3xl bg-slate-100 text-6xl font-black text-slate-300">
                  -
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="page-card p-5">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900">
                      {item.name || item.sprinklerName || "-"}
                    </h1>

                    <p className="mt-2 text-sm font-bold text-slate-400">
                      تفاصيل الرشاش والمكينة والمحصول
                    </p>
                  </div>

                  <Link
                    href={`/sprinklers/edit/${item.id}`}
                    className="btn-primary"
                  >
                    تعديل
                  </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard label="المزرعة" value={item.farmName} />

                  <InfoCard
                    label="المكينة"
                    value={item.machineName || item.machine}
                  />

                  <InfoCard
                    label="الجير"
                    value={item.gearName || item.gear}
                  />

                  <InfoCard label="نوع المحصول" value={item.cropType} />

                  <InfoCard
                    label="حركة الرشاش"
                    value={normalizeMovement(item.movementType)}
                  />

                  <InfoCard
                    label="عدد الأبراج"
                    value={getTowersCount(item)}
                  />

                  <InfoCard
                    label="الهكتار"
                    value={getHectareNumber(item)}
                  />

                  <InfoCard
                    label="العامل"
                    value={item.workerName}
                    href={item.workerId ? `/workers/${item.workerId}` : null}
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/sprinklers" className="btn-secondary">
                    رجوع للقائمة
                  </Link>

                  {item.workerId && (
                    <Link
                      href={`/workers/${item.workerId}`}
                      className="btn-secondary"
                    >
                      فتح صفحة العامل
                    </Link>
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

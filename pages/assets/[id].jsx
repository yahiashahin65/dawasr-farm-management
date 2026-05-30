import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { getCachedCollection } from "../../lib/realtimeCache";
import { isOnline } from "../../lib/offlineQueue";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

const badgeClass = (status) => {
  if (status === "صالح") return "bg-green-50 text-green-700";
  if (status === "عاطل") return "bg-amber-50 text-amber-700";
  if (status === "في الورشة") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
};

const categoryLabel = (category) => {
  if (category === "spare_part") return "قطعة غيار";
  if (category === "tool") return "أداة";
  if (category === "material") return "مواد";
  return "معدة";
};

const placeTypeLabel = (placeType) => {
  if (placeType === "farm") return "مزرعة";
  if (placeType === "kubra") return "كِبرة";
  if (placeType === "external_workshop") return "ورشة خارجية";
  return "-";
};

const movementTypeLabel = (type) => {
  if (type === "created") return "تسجيل أول مكان";
  if (type === "transfer") return "نقل";
  if (type === "moved") return "نقل";
  if (type === "maintenance") return "ورشة / صيانة";
  return type || "-";
};

const getAssetFromCache = (assetId) => {
  const cached = getCachedCollection("cache:assets");
  return cached.find((item) => item.id === assetId) || null;
};

const getAssetMovementsFromCache = (assetId) => {
  const cached = getCachedCollection("cache:assetMovements");

  return cached.filter((item) => item.assetId === assetId);
};

const formatDate = (value) => {
  if (value?.toDate) return value.toDate().toLocaleString("ar-EG");

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("ar-EG");
    }
  }

  return "-";
};

export default function AssetDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [asset, setAsset] = useState(null);
  const [moves, setMoves] = useState([]);
  const [preview, setPreview] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const cachedAsset = getAssetFromCache(id);
        const cachedMoves = getAssetMovementsFromCache(id);

        if (cachedAsset) {
          setAsset(cachedAsset);
          setMoves(cachedMoves);

          if (!isOnline()) {
            setOfflineNotice("يتم عرض البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [assetSnap, movesSnap] = await Promise.all([
          getDoc(doc(db, "assets", id)),
          getDocs(
            query(
              collection(db, "assetMovements"),
              where("assetId", "==", id),
              orderBy("movedAt", "desc")
            )
          ).catch(() =>
            getDocs(
              query(
                collection(db, "assetMovements"),
                where("assetId", "==", id)
              )
            )
          ),
        ]);

        if (assetSnap.exists()) {
          setAsset({
            id: assetSnap.id,
            ...assetSnap.data(),
          });
        } else if (!cachedAsset) {
          setAsset(null);
        }

        setMoves(
          movesSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error(error);

        const cachedAsset = getAssetFromCache(id);

        if (cachedAsset) {
          setAsset(cachedAsset);
          setMoves(getAssetMovementsFromCache(id));
          setOfflineNotice("تعذر الاتصال، يتم عرض آخر نسخة محفوظة من الكاش");
        } else {
          setAsset(null);
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [id]);

  const sortedMoves = useMemo(() => {
    return [...moves].sort((a, b) => {
      const aDate = a.movedAt?.toDate
        ? a.movedAt.toDate()
        : new Date(a.movedAt || a.createdAt || 0);

      const bDate = b.movedAt?.toDate
        ? b.movedAt.toDate()
        : new Date(b.movedAt || b.createdAt || 0);

      return bDate - aDate;
    });
  }, [moves]);

  if (initialLoading) {
    return (
      <ProtectedRoute>
        <Layout title="تفاصيل الأصل">
          <AppLoader
            variant="compact"
            title="جاري تحميل تفاصيل الأصل..."
            subtitle="يتم تجهيز بيانات الأصل وسجل الحركة"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!asset) {
    return (
      <ProtectedRoute>
        <Layout title="تفاصيل الأصل">
          <div className="page-card p-5 text-center font-bold text-slate-500">
            الأصل غير موجود
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const currentPlaceName =
    asset.placeName ||
    asset.farmName ||
    asset.kubraName ||
    asset.externalWorkshopName ||
    "-";

  const currentPlaceHref =
    asset.placeType === "kubra"
      ? `/assets?kubraId=${asset.kubraId || asset.placeId}`
      : asset.placeType === "external_workshop"
      ? `/assets?placeType=external_workshop`
      : `/assets?farmId=${asset.farmId || asset.placeId}`;

  return (
    <ProtectedRoute>
      <Layout title={`تفاصيل الأصل - ${asset.name || ""}`}>
        {offlineNotice && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
            {offlineNotice}
          </div>
        )}

        {asset.syncStatus === "pending" && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            هذا الأصل قيد المزامنة وسيتم رفع التغييرات عند عودة الاتصال
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="page-card p-5 xl:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row">
              <button
                type="button"
                onClick={() => asset.imageUrl && setPreview(true)}
                className="h-64 w-full overflow-hidden rounded-3xl bg-slate-100 md:w-80"
              >
                {asset.imageUrl ? (
                  <img
                    src={asset.imageUrl}
                    className="h-full w-full object-cover"
                    alt={asset.name || "asset"}
                  />
                ) : null}
              </button>

              <div className="flex-1 space-y-3">
                <h1 className="text-2xl font-black">{asset.name || "-"}</h1>

                <div className="flex flex-wrap gap-2">
                  <span className={`badge ${badgeClass(asset.status)}`}>
                    {asset.status || "-"}
                  </span>

                  <span className="badge bg-purple-50 text-purple-700">
                    {categoryLabel(asset.category)}
                  </span>

                  <Link
                    className="badge bg-slate-100 text-slate-700"
                    href={`/assets?assetTypeId=${asset.assetTypeId || ""}`}
                  >
                    {asset.assetTypeName || "مكينة"}
                  </Link>

                  <Link
                    className="badge bg-blue-50 text-blue-700"
                    href={currentPlaceHref}
                  >
                    {currentPlaceName}
                  </Link>

                  <span className="badge bg-slate-100 text-slate-600">
                    {placeTypeLabel(asset.placeType)}
                  </span>
                </div>

                <p className="text-sm text-slate-500">
                  الكود: {asset.code || "-"}
                </p>

                <p className="text-sm text-slate-500">
                  العمال: {asset.workerNames || "-"}
                </p>

                <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  {asset.notes || "لا توجد ملاحظات"}
                </p>

                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="btn-primary"
                      href={`/assets/edit/${asset.id}`}
                    >
                      تعديل
                    </Link>

                    <Link
                      className="btn-secondary"
                      href={`/assets/move/${asset.id}`}
                    >
                      نقل الأصل
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="mb-4 font-black">روابط سريعة</h3>

            <div className="space-y-2">
              <Link
                className="btn-secondary w-full"
                href={`/assets?status=${asset.status}`}
              >
                أصول بنفس الحالة
              </Link>

              <Link
                className="btn-secondary w-full"
                href={`/assets?placeType=${asset.placeType}`}
              >
                أصول بنفس نوع المكان
              </Link>

              {asset.assetTypeId && (
                <Link
                  className="btn-secondary w-full"
                  href={`/assets?assetTypeId=${asset.assetTypeId}`}
                >
                  أصول بنفس النوع
                </Link>
              )}

              {(asset.workerIds || []).map((workerId) => (
                <Link
                  key={workerId}
                  className="btn-secondary w-full"
                  href={`/assets?workerId=${workerId}`}
                >
                  أصول عامل مرتبط
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="page-card mt-4 overflow-x-auto">
          <h3 className="p-5 pb-2 font-black">سجل حركة الأصل</h3>

          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">نوع الحركة</th>
                <th className="table-th">من</th>
                <th className="table-th">إلى</th>
                <th className="table-th">الحالة</th>
                <th className="table-th">السبب</th>
                <th className="table-th">التاريخ</th>
              </tr>
            </thead>

            <tbody>
              {sortedMoves.map((move) => (
                <tr key={move.id} className="border-t border-slate-100">
                  <td className="table-td">
                    <div className="flex flex-col gap-1">
                      <span>{movementTypeLabel(move.movementType)}</span>

                      {move.syncStatus === "pending" && (
                        <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                          قيد المزامنة
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="table-td">{move.fromPlaceName || "-"}</td>
                  <td className="table-td">{move.toPlaceName || "-"}</td>
                  <td className="table-td">{move.status || "-"}</td>
                  <td className="table-td">{move.reason || "-"}</td>
                  <td className="table-td">{formatDate(move.movedAt)}</td>
                </tr>
              ))}

              {sortedMoves.length === 0 && (
                <tr>
                  <td className="table-td text-center" colSpan="6">
                    لا توجد حركات مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {preview && (
          <div
            onClick={() => setPreview(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          >
            <div className="max-h-[90vh] max-w-5xl rounded-3xl bg-white p-4">
              <button
                className="btn-secondary mb-3"
                onClick={() => setPreview(false)}
              >
                إغلاق
              </button>

              <img
                src={asset.imageUrl}
                className="max-h-[75vh] w-full object-contain"
                alt={asset.name || "asset"}
              />
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

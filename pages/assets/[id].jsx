import { useEffect, useState } from "react";
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
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
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
  if (type === "moved") return "نقل";
  return type || "-";
};

export default function AssetDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [asset, setAsset] = useState(null);
  const [moves, setMoves] = useState([]);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!id) return;

    getDoc(doc(db, "assets", id)).then((snap) => {
      if (snap.exists()) {
        setAsset({ id: snap.id, ...snap.data() });
      }
    });

    getDocs(
      query(
        collection(db, "assetMovements"),
        where("assetId", "==", id),
        orderBy("movedAt", "desc")
      )
    )
      .then((snap) =>
        setMoves(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      )
      .catch(() =>
        getDocs(
          query(collection(db, "assetMovements"), where("assetId", "==", id))
        ).then((snap) =>
          setMoves(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        )
      );
  }, [id]);

  if (!asset) {
    return (
      <ProtectedRoute>
        <Layout title="تفاصيل الأصل">
          <div className="page-card p-5">جاري التحميل...</div>
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
      <Layout title={`تفاصيل الأصل - ${asset.name}`}>
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
                    alt={asset.name}
                  />
                ) : null}
              </button>

              <div className="flex-1 space-y-3">
                <h1 className="text-2xl font-black">{asset.name}</h1>

                <div className="flex flex-wrap gap-2">
                  <span className={`badge ${badgeClass(asset.status)}`}>
                    {asset.status}
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

                  <Link className="badge bg-blue-50 text-blue-700" href={currentPlaceHref}>
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
                    <Link className="btn-primary" href={`/assets/edit/${asset.id}`}>
                      تعديل
                    </Link>

                    <Link className="btn-secondary" href={`/assets/move/${asset.id}`}>
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
              <Link className="btn-secondary w-full" href={`/assets?status=${asset.status}`}>
                أصول بنفس الحالة
              </Link>

              <Link className="btn-secondary w-full" href={`/assets?placeType=${asset.placeType}`}>
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
              {moves.map((move) => (
                <tr key={move.id} className="border-t border-slate-100">
                  <td className="table-td">
                    {movementTypeLabel(move.movementType)}
                  </td>

                  <td className="table-td">{move.fromPlaceName || "-"}</td>
                  <td className="table-td">{move.toPlaceName || "-"}</td>
                  <td className="table-td">{move.status || "-"}</td>
                  <td className="table-td">{move.reason || "-"}</td>

                  <td className="table-td">
                    {move.movedAt?.toDate
                      ? move.movedAt.toDate().toLocaleString("ar-EG")
                      : "-"}
                  </td>
                </tr>
              ))}

              {moves.length === 0 && (
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
              <button className="btn-secondary mb-3" onClick={() => setPreview(false)}>
                إغلاق
              </button>

              <img
                src={asset.imageUrl}
                className="max-h-[75vh] w-full object-contain"
                alt={asset.name}
              />
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

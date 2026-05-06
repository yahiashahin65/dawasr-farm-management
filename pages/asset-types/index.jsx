import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faEye, faRotate } from "@fortawesome/free-solid-svg-icons";
import { DEFAULT_ASSET_TYPE_NAME, cleanName, normalizeList, isAssetWithoutValidType } from "../../lib/inventory";

export default function AssetTypes() {
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [typesSnap, assetsSnap] = await Promise.all([
      getDocs(query(collection(db, "assetTypes"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "assets")),
    ]);

    setItems(normalizeList(typesSnap.docs));
    setAssets(assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const validTypeIds = useMemo(() => items.map((item) => item.id), [items]);

  const unlinkedCount = useMemo(
    () => assets.filter((asset) => isAssetWithoutValidType(asset, validTypeIds)).length,
    [assets, validTypeIds]
  );

  const getOrCreateMachineType = async () => {
    const machineQuery = query(
      collection(db, "assetTypes"),
      where("name", "==", DEFAULT_ASSET_TYPE_NAME)
    );
    const machineSnap = await getDocs(machineQuery);

    if (!machineSnap.empty) {
      return machineSnap.docs[0].id;
    }

    const created = await addDoc(collection(db, "assetTypes"), {
      name: DEFAULT_ASSET_TYPE_NAME,
      notes: "نوع افتراضي للمعدات القديمة",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return created.id;
  };

  const migrateOldAssets = async () => {
    setLoading(true);

    try {
      const machineTypeId = await getOrCreateMachineType();

      const [typesSnap, assetsSnap] = await Promise.all([
        getDocs(collection(db, "assetTypes")),
        getDocs(collection(db, "assets")),
      ]);

      const currentValidTypeIds = typesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => cleanName(item.name))
        .map((item) => item.id);

      let updatedCount = 0;

      for (const assetDoc of assetsSnap.docs) {
        const asset = assetDoc.data();

        if (isAssetWithoutValidType(asset, currentValidTypeIds)) {
          await updateDoc(doc(db, "assets", assetDoc.id), {
            assetTypeId: machineTypeId,
            assetTypeName: DEFAULT_ASSET_TYPE_NAME,
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
        }
      }

      alert(`تم ربط ${updatedCount} معدة قديمة بنوع ${DEFAULT_ASSET_TYPE_NAME}`);
      await load();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء ربط البيانات القديمة");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (confirm("هل تريد حذف نوع المعدة؟")) {
      await deleteDoc(doc(db, "assetTypes", id));
      await load();
    }
  };

  const count = (type) => assets.filter((asset) => asset.assetTypeId === type.id).length;

  return (
    <ProtectedRoute>
      <Layout title="أنواع المعدات">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Link href="/asset-types/add" className="btn-primary">
              <FontAwesomeIcon icon={faPlus} />
              إضافة نوع
            </Link>
            <button
              type="button"
              onClick={migrateOldAssets}
              disabled={loading}
              className="btn-secondary"
            >
              <FontAwesomeIcon icon={faRotate} />
              {loading ? "جاري الربط..." : "ربط المعدات بدون نوع بمكينة"}
            </button>
          </div>

          <Link href="/assets" className="btn-secondary">
            إجمالي المعدات: {assets.length}
          </Link>
        </div>

        {unlinkedCount > 0 && (
          <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            يوجد {unlinkedCount} معدة بدون نوع صحيح. اضغط زر الربط لتصحيح البيانات.
          </div>
        )}

        <div className="page-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">نوع المعدة</th>
                <th className="table-th">عدد المعدات</th>
                <th className="table-th">ملاحظات</th>
                <th className="table-th">إجراءات</th>
              </tr>
            </thead>

            <tbody>
              {items.map((type) => (
                <tr key={type.id} className="clickable-row border-t border-slate-100">
                  <td className="table-td font-black">
                    <Link href={`/assets?assetTypeId=${type.id}`}>{type.name}</Link>
                  </td>

                  <td className="table-td">
                    <Link className="badge bg-green-50 text-green-700" href={`/assets?assetTypeId=${type.id}`}>
                      {count(type)}
                    </Link>
                  </td>

                  <td className="table-td">{type.notes || "-"}</td>

                  <td className="table-td">
                    <div className="flex gap-2">
                      <Link href={`/assets?assetTypeId=${type.id}`} className="btn-secondary !p-2">
                        <FontAwesomeIcon icon={faEye} />
                      </Link>
                      <Link href={`/asset-types/edit/${type.id}`} className="btn-secondary !p-2">
                        <FontAwesomeIcon icon={faPen} />
                      </Link>
                      <button type="button" onClick={() => remove(type.id)} className="btn-danger !p-2">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td className="table-td text-center" colSpan="4">
                    لا توجد أنواع معدات حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

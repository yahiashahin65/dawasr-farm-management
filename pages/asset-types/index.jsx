import { useEffect, useState } from "react";
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
import { faPlus, faPen, faTrash, faEye } from "@fortawesome/free-solid-svg-icons";

export default function AssetTypes() {
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [typesSnap, assetsSnap] = await Promise.all([
      getDocs(query(collection(db, "assetTypes"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "assets")),
    ]);

    setItems(
      typesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.name && item.name.trim() !== "")
    );

    setAssets(assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const migrateOldAssets = async () => {
    setLoading(true);

    try {
      const machineTypeName = "مكينة";
      let machineTypeId = "";

      const machineQuery = query(
        collection(db, "assetTypes"),
        where("name", "==", machineTypeName)
      );

      const machineSnap = await getDocs(machineQuery);

      if (!machineSnap.empty) {
        machineTypeId = machineSnap.docs[0].id;
      } else {
        const created = await addDoc(collection(db, "assetTypes"), {
          name: machineTypeName,
          notes: "نوع افتراضي للمعدات القديمة",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        machineTypeId = created.id;
      }

      const [typesSnap, assetsSnap] = await Promise.all([
        getDocs(collection(db, "assetTypes")),
        getDocs(collection(db, "assets")),
      ]);

      const validTypeIds = typesSnap.docs.map((d) => d.id);

      let updatedCount = 0;

      for (const assetDoc of assetsSnap.docs) {
        const asset = assetDoc.data();

        const hasInvalidType =
          !asset.assetTypeId ||
          !asset.assetTypeName ||
          String(asset.assetTypeName).trim() === "" ||
          !validTypeIds.includes(asset.assetTypeId);

        if (hasInvalidType) {
          await updateDoc(doc(db, "assets", assetDoc.id), {
            assetTypeId: machineTypeId,
            assetTypeName: machineTypeName,
            updatedAt: serverTimestamp(),
          });

          updatedCount++;
        }
      }

      alert(`تم ربط ${updatedCount} معدة قديمة بنوع مكينة`);
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
      load();
    }
  };

  const count = (type) => {
    return assets.filter((asset) => asset.assetTypeId === type.id).length;
  };

  return (
    <ProtectedRoute>
      <Layout title="أنواع المعدات">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={migrateOldAssets}
              disabled={loading}
              className="btn-secondary"
            >
              {loading ? "جاري الربط..." : "ربط البيانات القديمة بنوع مكينة"}
            </button>

            <Link href="/asset-types/add" className="btn-primary">
              <FontAwesomeIcon icon={faPlus} />
              إضافة نوع
            </Link>
          </div>
        </div>

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
                    <Link href={`/assets?assetTypeId=${type.id}`}>
                      {type.name}
                    </Link>
                  </td>

                  <td className="table-td">
                    <Link
                      className="badge bg-green-50 text-green-700"
                      href={`/assets?assetTypeId=${type.id}`}
                    >
                      {count(type)}
                    </Link>
                  </td>

                  <td className="table-td">{type.notes || "-"}</td>

                  <td className="table-td">
                    <div className="flex gap-2">
                      <Link
                        href={`/assets?assetTypeId=${type.id}`}
                        className="btn-secondary !p-2"
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </Link>

                      <Link
                        href={`/asset-types/edit/${type.id}`}
                        className="btn-secondary !p-2"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </Link>

                      <button
                        type="button"
                        onClick={() => remove(type.id)}
                        className="btn-danger !p-2"
                      >
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

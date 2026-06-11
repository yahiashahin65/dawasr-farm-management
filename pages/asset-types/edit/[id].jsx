import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { addOfflineOperation, isOnline } from "../../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../../lib/realtimeCache";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";
import useUserRole from "../../../hooks/useUserRole";

const getAssetTypeFromCache = (typeId) => {
  const cached = getCachedCollection("cache:assetTypes");
  return cached.find((item) => item.id === typeId) || null;
};

const updateAssetTypeCache = (typeId, payload) => {
  const cached = getCachedCollection("cache:assetTypes");
  const exists = cached.some((item) => item.id === typeId);

  const updatedItem = {
    id: typeId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === typeId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:assetTypes", next);
};

const updateLinkedAssetsCache = (typeId, typeName) => {
  const cached = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cached.map((asset) =>
      asset.assetTypeId === typeId
        ? {
            ...asset,
            assetTypeName: typeName,
            updatedAt: new Date().toISOString(),
          }
        : asset
    )
  );
};

const queueAssetTypeUpdate = (typeId, payload) => {
  addOfflineOperation({
    collectionName: "assetTypes",
    operation: "update",
    documentId: typeId,
    payload: {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    meta: {
      label: "تعديل نوع معدة",
      name: payload.name,
    },
  });

  addOfflineOperation({
    collectionName: "assets",
    operation: "bulk-update-asset-type-name",
    documentId: typeId,
    payload: {
      assetTypeId: typeId,
      assetTypeName: payload.name,
      updatedAt: serverTimestamp(),
    },
    meta: {
      label: "تحديث اسم النوع في الأصول",
      name: payload.name,
    },
  });
};

export default function EditAssetType() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage, loadingRole } = useUserRole();

  const [form, setForm] = useState({
    name: "",
    notes: "",
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!loadingRole && !canManage) {
      router.replace("/asset-types");
    }
  }, [loadingRole, canManage, router]);

  useEffect(() => {
    if (!id || loadingRole || !canManage) return;

    const loadType = async () => {
      setInitialLoading(true);

      try {
        const cachedType = getAssetTypeFromCache(id);

        if (cachedType) {
          setForm({
            name: cachedType.name || "",
            notes: cachedType.notes || "",
          });

          if (!isOnline()) {
            setOfflineNotice("يتم تعديل البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const snapshot = await getDoc(doc(db, "assetTypes", id));

        if (snapshot.exists()) {
          const data = snapshot.data();

          setForm({
            name: data.name || "",
            notes: data.notes || "",
          });
        } else if (!cachedType) {
          alert("نوع المعدة غير موجود");
          router.push("/asset-types");
        }
      } catch (error) {
        console.error(error);

        const cachedType = getAssetTypeFromCache(id);

        if (cachedType) {
          setForm({
            name: cachedType.name || "",
            notes: cachedType.notes || "",
          });

          setOfflineNotice("تعذر الاتصال، يتم تعديل آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل نوع المعدة");
          router.push("/asset-types");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadType();
  }, [id, router, loadingRole, canManage]);

  const submit = async (event) => {
    event.preventDefault();

    if (!canManage) return;
    if (loading) return;

    const name = form.name.trim();
    const notes = form.notes.trim();

    if (!name) {
      alert("اكتب اسم نوع المعدة");
      return;
    }

    setLoading(true);

    const payload = {
      name,
      notes,
    };

    try {
      updateAssetTypeCache(id, payload);
      updateLinkedAssetsCache(id, name);

      if (!isOnline()) {
        queueAssetTypeUpdate(id, payload);

        alert("تم حفظ تعديل نوع المعدة محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/asset-types");
        return;
      }

      await updateDoc(doc(db, "assetTypes", id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      const linkedAssets = await getDocs(
        query(collection(db, "assets"), where("assetTypeId", "==", id))
      );

      await Promise.all(
        linkedAssets.docs.map((assetDoc) =>
          updateDoc(doc(db, "assets", assetDoc.id), {
            assetTypeName: name,
            updatedAt: serverTimestamp(),
          })
        )
      );

      router.push("/asset-types");
    } catch (error) {
      console.error(error);

      updateAssetTypeCache(id, payload);
      updateLinkedAssetsCache(id, name);

      queueAssetTypeUpdate(id, payload);

      alert("تعذر الاتصال، تم حفظ تعديل نوع المعدة محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/asset-types");
    } finally {
      setLoading(false);
    }
  };

  if (loadingRole || !canManage) {
    return (
      <ProtectedRoute>
        <Layout title="تعديل نوع معدة">
          <AppLoader
            variant="compact"
            title="جاري التحقق من الصلاحيات..."
            subtitle="يتم التأكد من صلاحية تعديل نوع معدة"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="تعديل نوع معدة">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل نوع المعدة..."
            subtitle="يتم تجهيز بيانات التعديل"
          />
        ) : (
          <form onSubmit={submit} className="page-card max-w-2xl space-y-4 p-5">
            {offlineNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {offlineNotice}
              </div>
            )}

            <input
              className="form-input"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />

            <textarea
              className="form-input h-28"
              placeholder="ملاحظات"
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />

            <button disabled={loading} className="btn-primary">
              {loading ? "جاري التحديث..." : "تحديث النوع"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

import { useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const addAssetTypeToCache = (type) => {
  const cached = getCachedCollection("cache:assetTypes");
  setCachedCollection("cache:assetTypes", [type, ...cached]);
};

export default function AddAssetType() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const name = form.name.trim();
    const notes = form.notes.trim();

    if (!name) {
      alert("اكتب اسم نوع المعدة");
      return;
    }

    setLoading(true);

    const localId = createLocalId();

    const payload = {
      name,
      notes,
    };

    try {
      if (!isOnline()) {
        addAssetTypeToCache({
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "assetTypes",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة نوع معدة",
            name: payload.name,
          },
        });

        alert("تم حفظ نوع المعدة محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/asset-types");
        return;
      }

      await addDoc(collection(db, "assetTypes"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/asset-types");
    } catch (error) {
      console.error(error);

      addAssetTypeToCache({
        id: localId,
        ...payload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "assetTypes",
        operation: "create",
        documentId: localId,
        payload: {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة نوع معدة",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ نوع المعدة محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/asset-types");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة نوع معدة">
        <form onSubmit={submit} className="page-card max-w-2xl space-y-4 p-5">
          <input
            className="form-input"
            placeholder="اسم نوع المعدة، مثال: مكينة"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات اختيارية"
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ النوع"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
    }

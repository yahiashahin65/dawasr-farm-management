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

const addKubraToCache = (kubra) => {
  const cached = getCachedCollection("cache:kubras");
  setCachedCollection("cache:kubras", [kubra, ...cached]);
};

export default function AddKubra() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.name.trim()) {
      alert("اسم الكِبرة مطلوب");
      return;
    }

    setLoading(true);

    const localId = createLocalId();

    const payload = {
      name: form.name.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (!isOnline()) {
        addKubraToCache({
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "kubras",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة كِبرة",
            name: payload.name,
          },
        });

        alert("تم حفظ الكِبرة محليًا وسيتم رفعها عند عودة الاتصال");
        router.push("/kubras");
        return;
      }

      await addDoc(collection(db, "kubras"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/kubras");
    } catch (error) {
      console.error(error);

      addKubraToCache({
        id: localId,
        ...payload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "kubras",
        operation: "create",
        documentId: localId,
        payload: {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة كِبرة",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ الكِبرة محليًا وسيتم رفعها عند عودة الاتصال");
      router.push("/kubras");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة كِبرة">
        <form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4">
          <input
            className="form-input"
            placeholder="اسم الكِبرة"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

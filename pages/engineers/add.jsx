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

const addEngineerToCache = (engineer) => {
  const cached = getCachedCollection("cache:engineers");
  setCachedCollection("cache:engineers", [engineer, ...cached]);
};

export default function AddEngineer() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.name.trim()) {
      alert("اسم المهندس مطلوب");
      return;
    }

    setLoading(true);

    const localId = createLocalId();

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (!isOnline()) {
        addEngineerToCache({
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "engineers",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة مهندس",
            name: payload.name,
          },
        });

        alert("تم حفظ المهندس محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/engineers");
        return;
      }

      await addDoc(collection(db, "engineers"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/engineers");
    } catch (error) {
      console.error(error);

      addEngineerToCache({
        id: localId,
        ...payload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "engineers",
        operation: "create",
        documentId: localId,
        payload: {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة مهندس",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ المهندس محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/engineers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة مهندس">
        <form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4">
          <input
            className="form-input"
            placeholder="اسم المهندس"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            className="form-input"
            placeholder="رقم الجوال"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
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

import { useEffect, useState } from "react";
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
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const addWorkerToCache = (worker) => {
  const cached = getCachedCollection("cache:workers");
  setCachedCollection("cache:workers", [worker, ...cached]);
};

export default function AddWorker() {
  const router = useRouter();
  const { canManage, loadingRole } = useUserRole();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    nationality: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loadingRole && !canManage) {
      router.replace("/workers");
    }
  }, [loadingRole, canManage, router]);

  const submit = async (e) => {
    e.preventDefault();

    if (!canManage) return;
    if (loading) return;

    if (!form.name.trim()) {
      alert("اسم العامل مطلوب");
      return;
    }

    setLoading(true);

    const localId = createLocalId();

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      nationality: form.nationality.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (!isOnline()) {
        addWorkerToCache({
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "workers",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة عامل",
            name: payload.name,
          },
        });

        alert("تم حفظ العامل محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/workers");
        return;
      }

      await addDoc(collection(db, "workers"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/workers");
    } catch (error) {
      console.error(error);

      addWorkerToCache({
        id: localId,
        ...payload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "workers",
        operation: "create",
        documentId: localId,
        payload: {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة عامل",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ العامل محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/workers");
    } finally {
      setLoading(false);
    }
  };

  if (loadingRole || !canManage) {
    return (
      <ProtectedRoute>
        <Layout title="إضافة عامل">
          <AppLoader
            variant="compact"
            title="جاري التحقق من الصلاحيات..."
            subtitle="يتم التأكد من صلاحية إضافة عامل"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="إضافة عامل">
        <form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4">
          <input
            className="form-input"
            placeholder="اسم العامل"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="form-input"
              placeholder="رقم الجوال"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <input
              className="form-input"
              placeholder="الجنسية"
              value={form.nationality}
              onChange={(e) =>
                setForm({ ...form, nationality: e.target.value })
              }
            />
          </div>

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ العامل"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

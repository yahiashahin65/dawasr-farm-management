import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { addOfflineOperation, isOnline } from "../../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../../lib/realtimeCache";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";

const getWorkerFromCache = (workerId) => {
  const cached = getCachedCollection("cache:workers");
  return cached.find((item) => item.id === workerId) || null;
};

const updateWorkerCache = (workerId, payload) => {
  const cached = getCachedCollection("cache:workers");

  const exists = cached.some((item) => item.id === workerId);

  const updatedItem = {
    id: workerId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === workerId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:workers", next);
};

export default function EditWorker() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    nationality: "",
    notes: "",
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const loadWorker = async () => {
      setInitialLoading(true);

      try {
        const cachedWorker = getWorkerFromCache(id);

        if (cachedWorker) {
          setForm({
            name: cachedWorker.name || "",
            phone: cachedWorker.phone || "",
            nationality: cachedWorker.nationality || "",
            notes: cachedWorker.notes || "",
          });

          if (!isOnline()) {
            setOfflineNotice("يتم تعديل البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const snap = await getDoc(doc(db, "workers", id));

        if (snap.exists()) {
          const data = snap.data();

          setForm({
            name: data.name || "",
            phone: data.phone || "",
            nationality: data.nationality || "",
            notes: data.notes || "",
          });
        } else if (!cachedWorker) {
          alert("العامل غير موجود");
          router.push("/workers");
        }
      } catch (error) {
        console.error(error);

        const cachedWorker = getWorkerFromCache(id);

        if (cachedWorker) {
          setForm({
            name: cachedWorker.name || "",
            phone: cachedWorker.phone || "",
            nationality: cachedWorker.nationality || "",
            notes: cachedWorker.notes || "",
          });

          setOfflineNotice("تعذر الاتصال، يتم تعديل آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات العامل");
          router.push("/workers");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadWorker();
  }, [id, router]);

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.name.trim()) {
      alert("اسم العامل مطلوب");
      return;
    }

    setLoading(true);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      nationality: form.nationality.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (!isOnline()) {
        updateWorkerCache(id, payload);

        addOfflineOperation({
          collectionName: "workers",
          operation: "update",
          documentId: id,
          payload: {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "تعديل عامل",
            name: payload.name,
          },
        });

        alert("تم حفظ تعديل العامل محليًا وسيتم رفعه عند عودة الاتصال");
        router.push(`/workers/${id}`);
        return;
      }

      await updateDoc(doc(db, "workers", id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      updateWorkerCache(id, {
        ...payload,
        isOffline: false,
        syncStatus: "synced",
      });

      router.push(`/workers/${id}`);
    } catch (error) {
      console.error(error);

      updateWorkerCache(id, payload);

      addOfflineOperation({
        collectionName: "workers",
        operation: "update",
        documentId: id,
        payload: {
          ...payload,
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "تعديل عامل",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ تعديل العامل محليًا وسيتم رفعه عند عودة الاتصال");
      router.push(`/workers/${id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل بيانات عامل">
        {initialLoading ? (
          <div className="page-card p-5 font-bold text-slate-500">
            جاري تحميل بيانات العامل...
          </div>
        ) : (
          <form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4">
            {offlineNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {offlineNotice}
              </div>
            )}

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
              {loading ? "جاري التعديل..." : "حفظ التعديلات"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

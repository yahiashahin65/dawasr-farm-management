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
import AppLoader from "../../../components/AppLoader";

const getEngineerFromCache = (engineerId) => {
  const cached = getCachedCollection("cache:engineers");
  return cached.find((item) => item.id === engineerId) || null;
};

const updateEngineerCache = (engineerId, payload) => {
  const cached = getCachedCollection("cache:engineers");
  const exists = cached.some((item) => item.id === engineerId);

  const updatedItem = {
    id: engineerId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === engineerId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:engineers", next);
};

const updateRelatedEngineerCache = (engineerId, engineerName, engineerPhone) => {
  const cachedFarms = getCachedCollection("cache:farms");

  setCachedCollection(
    "cache:farms",
    cachedFarms.map((farm) => {
      if (!(farm.engineerIds || []).includes(engineerId)) return farm;

      const engineers = Array.isArray(farm.engineers)
        ? farm.engineers.map((engineer) =>
            engineer.id === engineerId
              ? {
                  ...engineer,
                  name: engineerName,
                  phone: engineerPhone,
                }
              : engineer
          )
        : [];

      return {
        ...farm,
        engineers,
        engineerNames: engineers.map((engineer) => engineer.name).join("، "),
        updatedAt: new Date().toISOString(),
      };
    })
  );
};

const queueEngineerUpdate = (engineerId, payload) => {
  addOfflineOperation({
    collectionName: "engineers",
    operation: "update",
    documentId: engineerId,
    payload: {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    meta: {
      label: "تعديل مهندس",
      name: payload.name,
    },
  });

  addOfflineOperation({
    collectionName: "engineers",
    operation: "update-related-engineer-name",
    documentId: engineerId,
    payload: {
      engineerId,
      engineerName: payload.name,
      engineerPhone: payload.phone,
    },
    meta: {
      label: "تحديث اسم المهندس في المزارع",
      name: payload.name,
    },
  });
};

export default function EditEngineer() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: "",
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const loadEngineer = async () => {
      setInitialLoading(true);

      try {
        const cachedEngineer = getEngineerFromCache(id);

        if (cachedEngineer) {
          setForm({
            name: cachedEngineer.name || "",
            phone: cachedEngineer.phone || "",
            notes: cachedEngineer.notes || "",
          });

          if (!isOnline()) {
            setOfflineNotice("يتم تعديل البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const snap = await getDoc(doc(db, "engineers", id));

        if (snap.exists()) {
          const data = snap.data();

          setForm({
            name: data.name || "",
            phone: data.phone || "",
            notes: data.notes || "",
          });
        } else if (!cachedEngineer) {
          alert("المهندس غير موجود");
          router.push("/engineers");
        }
      } catch (error) {
        console.error(error);

        const cachedEngineer = getEngineerFromCache(id);

        if (cachedEngineer) {
          setForm({
            name: cachedEngineer.name || "",
            phone: cachedEngineer.phone || "",
            notes: cachedEngineer.notes || "",
          });

          setOfflineNotice("تعذر الاتصال، يتم تعديل آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات المهندس");
          router.push("/engineers");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadEngineer();
  }, [id, router]);

  const submit = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!form.name.trim()) {
      alert("اسم المهندس مطلوب");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
    };

    try {
      updateEngineerCache(id, payload);
      updateRelatedEngineerCache(id, payload.name, payload.phone);

      if (!isOnline()) {
        queueEngineerUpdate(id, payload);

        alert("تم حفظ تعديل المهندس محليًا وسيتم رفعه عند عودة الاتصال");
        router.push(`/engineers/${id}`);
        return;
      }

      await updateDoc(doc(db, "engineers", id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      router.push(`/engineers/${id}`);
    } catch (error) {
      console.error(error);

      updateEngineerCache(id, payload);
      updateRelatedEngineerCache(id, payload.name, payload.phone);

      queueEngineerUpdate(id, payload);

      alert("تعذر الاتصال، تم حفظ تعديل المهندس محليًا وسيتم رفعه عند عودة الاتصال");
      router.push(`/engineers/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل مهندس">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات المهندس..."
            subtitle="يتم تجهيز بيانات التعديل"
          />
        ) : (
          <form onSubmit={submit} className="page-card max-w-2xl p-5 space-y-4">
            {offlineNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {offlineNotice}
              </div>
            )}

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

            <button disabled={saving} className="btn-primary">
              {saving ? "جاري الحفظ..." : "تحديث"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

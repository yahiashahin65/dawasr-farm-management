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

const getKubraFromCache = (kubraId) => {
  const cached = getCachedCollection("cache:kubras");
  return cached.find((item) => item.id === kubraId) || null;
};

const updateKubraCache = (kubraId, payload) => {
  const cached = getCachedCollection("cache:kubras");
  const exists = cached.some((item) => item.id === kubraId);

  const updatedItem = {
    id: kubraId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === kubraId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:kubras", next);
};

const updateRelatedKubraCache = (kubraId, kubraName) => {
  const cachedAssets = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cachedAssets.map((asset) => {
      const isRelated =
        asset.kubraId === kubraId ||
        (asset.placeType === "kubra" && asset.placeId === kubraId);

      if (!isRelated) return asset;

      return {
        ...asset,
        kubraName,
        placeName: asset.placeType === "kubra" ? kubraName : asset.placeName,
        currentPlace:
          asset.placeType === "kubra"
            ? {
                ...(asset.currentPlace || {}),
                id: kubraId,
                type: "kubra",
                name: kubraName,
              }
            : asset.currentPlace,
        updatedAt: new Date().toISOString(),
      };
    })
  );
};

export default function EditKubra() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState({
    name: "",
    notes: "",
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!id) return;

    const loadKubra = async () => {
      setInitialLoading(true);

      try {
        const cachedKubra = getKubraFromCache(id);

        if (cachedKubra) {
          setForm({
            name: cachedKubra.name || "",
            notes: cachedKubra.notes || "",
          });

          if (!isOnline()) {
            setOfflineNotice("يتم تعديل البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const snap = await getDoc(doc(db, "kubras", id));

        if (snap.exists()) {
          const data = snap.data();

          setForm({
            name: data.name || "",
            notes: data.notes || "",
          });
        } else if (!cachedKubra) {
          alert("الكِبرة غير موجودة");
          router.push("/kubras");
        }
      } catch (error) {
        console.error(error);

        const cachedKubra = getKubraFromCache(id);

        if (cachedKubra) {
          setForm({
            name: cachedKubra.name || "",
            notes: cachedKubra.notes || "",
          });

          setOfflineNotice("تعذر الاتصال، يتم تعديل آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات الكِبرة");
          router.push("/kubras");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadKubra();
  }, [id, router]);

  const queueRelatedKubraUpdate = (payload) => {
    addOfflineOperation({
      collectionName: "kubras",
      operation: "update-related-kubra-name",
      documentId: id,
      payload: {
        kubraId: id,
        kubraName: payload.name,
      },
      meta: {
        label: "تحديث اسم الكِبرة في الأصول",
        name: payload.name,
      },
    });
  };

  const submit = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!form.name.trim()) {
      alert("اسم الكِبرة مطلوب");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      notes: form.notes.trim(),
    };

    try {
      updateKubraCache(id, payload);
      updateRelatedKubraCache(id, payload.name);

      if (!isOnline()) {
        addOfflineOperation({
          collectionName: "kubras",
          operation: "update",
          documentId: id,
          payload: {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "تعديل كِبرة",
            name: payload.name,
          },
        });

        queueRelatedKubraUpdate(payload);

        alert("تم حفظ تعديل الكِبرة محليًا وسيتم رفعه عند عودة الاتصال");
        router.push(`/kubras/${id}`);
        return;
      }

      await updateDoc(doc(db, "kubras", id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      queueRelatedKubraUpdate(payload);

      router.push(`/kubras/${id}`);
    } catch (error) {
      console.error(error);

      updateKubraCache(id, payload);
      updateRelatedKubraCache(id, payload.name);

      addOfflineOperation({
        collectionName: "kubras",
        operation: "update",
        documentId: id,
        payload: {
          ...payload,
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "تعديل كِبرة",
          name: payload.name,
        },
      });

      queueRelatedKubraUpdate(payload);

      alert("تعذر الاتصال، تم حفظ تعديل الكِبرة محليًا وسيتم رفعه عند عودة الاتصال");
      router.push(`/kubras/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل كِبرة">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات الكِبرة..."
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

            <button disabled={saving} className="btn-primary">
              {saving ? "جاري الحفظ..." : "تحديث"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

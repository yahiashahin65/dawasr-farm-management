import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { isOnline, addOfflineOperation } from "../../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../../lib/realtimeCache";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";

const getFarmFromCache = (farmId) => {
  const cached = getCachedCollection("cache:farms");
  return cached.find((item) => item.id === farmId) || null;
};

const cleanList = (items = []) =>
  items.filter((item) => item.name && item.name.trim() !== "");

const updateFarmCache = (farmId, payload) => {
  const cached = getCachedCollection("cache:farms");
  const exists = cached.some((item) => item.id === farmId);

  const updatedItem = {
    id: farmId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === farmId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:farms", next);
};

const updateRelatedFarmCache = (farmId, farmName) => {
  const cachedAssets = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cachedAssets.map((asset) => {
      const isRelated =
        asset.farmId === farmId ||
        (asset.placeType === "farm" && asset.placeId === farmId);

      if (!isRelated) return asset;

      return {
        ...asset,
        farmName,
        placeName: asset.placeType === "farm" ? farmName : asset.placeName,
        currentPlace:
          asset.placeType === "farm"
            ? {
                ...(asset.currentPlace || {}),
                id: farmId,
                type: "farm",
                name: farmName,
              }
            : asset.currentPlace,
        updatedAt: new Date().toISOString(),
      };
    })
  );

  const cachedHeaps = getCachedCollection("cache:heaps");

  setCachedCollection(
    "cache:heaps",
    cachedHeaps.map((heap) =>
      heap.farmId === farmId
        ? {
            ...heap,
            farmName,
            updatedAt: new Date().toISOString(),
          }
        : heap
    )
  );

  const cachedSprinklers = getCachedCollection("cache:sprinklers");

  setCachedCollection(
    "cache:sprinklers",
    cachedSprinklers.map((sprinkler) =>
      sprinkler.farmId === farmId
        ? {
            ...sprinkler,
            farmName,
            updatedAt: new Date().toISOString(),
          }
        : sprinkler
    )
  );
};

const queueFarmUpdate = (farmId, payload) => {
  addOfflineOperation({
    collectionName: "farms",
    operation: "update",
    documentId: farmId,
    payload: {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    meta: {
      label: "تعديل مزرعة",
      name: payload.name,
    },
  });

  addOfflineOperation({
    collectionName: "farms",
    operation: "update-related-farm-name",
    documentId: farmId,
    payload: {
      farmId,
      farmName: payload.name,
    },
    meta: {
      label: "تحديث اسم المزرعة في البيانات المرتبطة",
      name: payload.name,
    },
  });
};

export default function EditFarm() {
  const router = useRouter();
  const { id } = router.query;

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  const [engineers, setEngineers] = useState([]);

  const [form, setForm] = useState({
    name: "",
    managerName: "",
    notes: "",
    engineerIds: [],
  });

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const cachedFarm = getFarmFromCache(id);
        const cachedEngineers = cleanList(getCachedCollection("cache:engineers"));

        if (cachedFarm) {
          setForm({
            name: cachedFarm.name || "",
            managerName: cachedFarm.managerName || "",
            notes: cachedFarm.notes || "",
            engineerIds: cachedFarm.engineerIds || [],
          });

          setEngineers(cachedEngineers);

          if (!isOnline()) {
            setOfflineNotice("يتم تعديل البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [engineersSnap, farmSnap] = await Promise.all([
          getDocs(collection(db, "engineers")),
          getDoc(doc(db, "farms", id)),
        ]);

        setEngineers(
          engineersSnap.docs
            .map((d) => ({
              id: d.id,
              ...d.data(),
            }))
            .filter((item) => item.name && item.name.trim() !== "")
        );

        if (farmSnap.exists()) {
          const data = farmSnap.data();

          setForm({
            name: data.name || "",
            managerName: data.managerName || "",
            notes: data.notes || "",
            engineerIds: data.engineerIds || [],
          });
        } else if (!cachedFarm) {
          alert("المزرعة غير موجودة");
          router.push("/farms");
        }
      } catch (error) {
        console.error(error);

        const cachedFarm = getFarmFromCache(id);

        if (cachedFarm) {
          setForm({
            name: cachedFarm.name || "",
            managerName: cachedFarm.managerName || "",
            notes: cachedFarm.notes || "",
            engineerIds: cachedFarm.engineerIds || [],
          });

          setEngineers(cleanList(getCachedCollection("cache:engineers")));
          setOfflineNotice("تعذر الاتصال، يتم تعديل آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات المزرعة");
          router.push("/farms");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  const toggle = (engineerId) => {
    setForm((prev) => ({
      ...prev,
      engineerIds: prev.engineerIds.includes(engineerId)
        ? prev.engineerIds.filter((x) => x !== engineerId)
        : [...prev.engineerIds, engineerId],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!form.name.trim()) {
      alert("اسم المزرعة مطلوب");
      return;
    }

    setSaving(true);

    const selectedEngineers = engineers.filter((item) =>
      form.engineerIds.includes(item.id)
    );

    const payload = {
      name: form.name.trim(),
      managerName: form.managerName.trim(),
      notes: form.notes.trim(),
      engineerIds: form.engineerIds,
      engineers: selectedEngineers.map((item) => ({
        id: item.id,
        name: item.name,
        phone: item.phone || "",
      })),
      engineerNames: selectedEngineers.map((item) => item.name).join("، "),
    };

    try {
      updateFarmCache(id, payload);
      updateRelatedFarmCache(id, payload.name);

      if (!isOnline()) {
        queueFarmUpdate(id, payload);

        alert("تم حفظ التعديلات محليًا وسيتم رفعها عند عودة الاتصال");
        router.push("/farms");
        return;
      }

      await updateDoc(doc(db, "farms", id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      router.push("/farms");
    } catch (error) {
      console.error(error);

      updateFarmCache(id, payload);
      updateRelatedFarmCache(id, payload.name);

      queueFarmUpdate(id, payload);

      alert("تعذر الاتصال، تم حفظ التعديلات محليًا وسيتم رفعها عند عودة الاتصال");
      router.push("/farms");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل مزرعة">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات المزرعة..."
            subtitle="يتم تجهيز بيانات التعديل"
          />
        ) : (
          <form onSubmit={submit} className="page-card max-w-3xl p-5 space-y-4">
            {offlineNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {offlineNotice}
              </div>
            )}

            <input
              className="form-input"
              placeholder="اسم المزرعة"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
            />

            <input
              className="form-input"
              placeholder="مسئول المزرعة / المشرف الداخلي"
              value={form.managerName}
              onChange={(e) =>
                setForm({
                  ...form,
                  managerName: e.target.value,
                })
              }
            />

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                المهندسون المسئولون
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                {engineers.map((engineer) => (
                  <label
                    key={engineer.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold ${
                      form.engineerIds.includes(engineer.id)
                        ? "border-green-600 bg-green-50 text-green-800"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.engineerIds.includes(engineer.id)}
                      onChange={() => toggle(engineer.id)}
                    />

                    {engineer.name}
                  </label>
                ))}
              </div>
            </div>

            <textarea
              className="form-input h-28"
              placeholder="ملاحظات"
              value={form.notes}
              onChange={(e) =>
                setForm({
                  ...form,
                  notes: e.target.value,
                })
              }
            />

            <button disabled={saving} className="btn-primary">
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

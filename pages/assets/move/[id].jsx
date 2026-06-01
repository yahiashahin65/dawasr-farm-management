import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { createSystemEvent } from "../../../lib/systemEvents";
import { addOfflineOperation, isOnline } from "../../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../../lib/realtimeCache";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const cleanList = (items = []) =>
  items.filter((item) => item.name && item.name.trim() !== "");

const getAssetFromCache = (assetId) => {
  const cached = getCachedCollection("cache:assets");
  return cached.find((item) => item.id === assetId) || null;
};

const updateAssetCache = (assetId, payload) => {
  const cached = getCachedCollection("cache:assets");
  const exists = cached.some((item) => item.id === assetId);

  const updatedItem = {
    id: assetId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === assetId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:assets", next);
};

const addMovementToCache = (movement) => {
  const cached = getCachedCollection("cache:assetMovements");
  setCachedCollection("cache:assetMovements", [movement, ...cached]);
};

export default function MoveAsset() {
  const router = useRouter();
  const { id } = router.query;

  const [asset, setAsset] = useState(null);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  const [form, setForm] = useState({
    placeType: "farm",
    placeId: "",
    externalWorkshopName: "",
    reason: "",
  });

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const cachedAsset = getAssetFromCache(id);

        if (cachedAsset) {
          setAsset(cachedAsset);

          setFarms(cleanList(getCachedCollection("cache:farms")));
          setKubras(cleanList(getCachedCollection("cache:kubras")));

          setForm((prev) => ({
            ...prev,
            placeType: cachedAsset.placeType || "farm",
            placeId:
              cachedAsset.placeId ||
              cachedAsset.farmId ||
              cachedAsset.kubraId ||
              "",
            externalWorkshopName: cachedAsset.externalWorkshopName || "",
          }));

          if (!isOnline()) {
            setOfflineNotice("يتم النقل من بيانات الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [farmsSnap, kubrasSnap, assetSnap] = await Promise.all([
          getDocs(collection(db, "farms")),
          getDocs(collection(db, "kubras")),
          getDoc(doc(db, "assets", id)),
        ]);

        const cleanSnap = (snap) =>
          snap.docs
            .map((d) => ({
              id: d.id,
              ...d.data(),
            }))
            .filter((item) => item.name && item.name.trim() !== "");

        setFarms(cleanSnap(farmsSnap));
        setKubras(cleanSnap(kubrasSnap));

        if (assetSnap.exists()) {
          const data = {
            id: assetSnap.id,
            ...assetSnap.data(),
          };

          setAsset(data);

          setForm((prev) => ({
            ...prev,
            placeType: data.placeType || "farm",
            placeId: data.placeId || data.farmId || data.kubraId || "",
            externalWorkshopName: data.externalWorkshopName || "",
          }));
        } else if (!cachedAsset) {
          alert("الأصل غير موجود");
          router.push("/assets");
        }
      } catch (error) {
        console.error(error);

        const cachedAsset = getAssetFromCache(id);

        if (cachedAsset) {
          setAsset(cachedAsset);
          setFarms(cleanList(getCachedCollection("cache:farms")));
          setKubras(cleanList(getCachedCollection("cache:kubras")));

          setForm((prev) => ({
            ...prev,
            placeType: cachedAsset.placeType || "farm",
            placeId:
              cachedAsset.placeId ||
              cachedAsset.farmId ||
              cachedAsset.kubraId ||
              "",
            externalWorkshopName: cachedAsset.externalWorkshopName || "",
          }));

          setOfflineNotice("تعذر الاتصال، يتم النقل من آخر نسخة محفوظة");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات الأصل");
          router.push("/assets");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  const places = useMemo(() => {
    if (form.placeType === "farm") return farms;
    if (form.placeType === "kubra") return kubras;
    return [];
  }, [form.placeType, farms, kubras]);

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const isExternalWorkshop = form.placeType === "external_workshop";

    if (!isExternalWorkshop && !form.placeId) {
      alert("اختر المكان الجديد");
      return;
    }

    if (isExternalWorkshop && !form.externalWorkshopName.trim()) {
      alert("اسم الورشة الخارجية مطلوب");
      return;
    }

    setLoading(true);

    try {
      const place = isExternalWorkshop
        ? null
        : places.find((item) => item.id === form.placeId);

      const placeId = isExternalWorkshop ? "" : form.placeId;

      const placeName = isExternalWorkshop
        ? form.externalWorkshopName.trim()
        : place?.name || "";

      const fromPlaceName =
        asset?.placeName ||
        asset?.farmName ||
        asset?.kubraName ||
        asset?.externalWorkshopName ||
        "";

      const newStatus = isExternalWorkshop
        ? "في الورشة"
        : asset?.status === "في الورشة"
        ? "صالح"
        : asset?.status;

      const movementId = createLocalId();

      const assetPayload = {
        placeType: form.placeType,
        placeId,
        placeName,

        currentPlace: {
          type: form.placeType,
          id: placeId,
          name: placeName,
        },

        farmId: form.placeType === "farm" ? form.placeId : "",
        farmName: form.placeType === "farm" ? placeName : "",

        kubraId: form.placeType === "kubra" ? form.placeId : "",
        kubraName: form.placeType === "kubra" ? placeName : "",

        externalWorkshopName:
          form.placeType === "external_workshop" ? placeName : "",

        status: newStatus,
      };

      const movementPayload = {
        assetId: id,
        assetName: asset?.name || "",

        movementType: isExternalWorkshop ? "maintenance" : "transfer",

        fromPlaceType: asset?.placeType || "",
        fromPlaceId: asset?.placeId || "",
        fromPlaceName,

        toPlaceType: form.placeType,
        toPlaceId: placeId,
        toPlaceName: placeName,

        status: newStatus,
        category: asset?.category || "asset",

        reason:
          form.reason ||
          (isExternalWorkshop ? "إرسال للورشة" : "نقل أصل"),
      };

      const systemEvent = {
        type: "move",
        module: "assets",
        title: isExternalWorkshop ? "تم إرسال أصل إلى الورشة" : "تم نقل أصل",
        description: `${asset?.name || "أصل"} من ${
          fromPlaceName || "مكان غير محدد"
        } إلى ${placeName || "مكان غير محدد"}`,
        itemId: id,
        itemPath: `/assets/${id}`,
        notify: true,
      };

      updateAssetCache(id, assetPayload);

      addMovementToCache({
        id: movementId,
        ...movementPayload,
        isOffline: true,
        syncStatus: "pending",
        movedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      if (!isOnline()) {
        addOfflineOperation({
          collectionName: "assets",
          operation: "move",
          documentId: id,
          payload: {
            ...assetPayload,
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "نقل أصل",
            name: asset?.name || "",
            systemEvent,
          },
        });

        addOfflineOperation({
          collectionName: "assetMovements",
          operation: "create",
          documentId: movementId,
          payload: {
            ...movementPayload,
            movedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          meta: {
            label: "تسجيل حركة أصل",
            name: asset?.name || "",
          },
        });

        alert("تم حفظ حركة النقل محليًا وسيتم رفعها عند عودة الاتصال");
        router.push(`/assets/${id}`);
        return;
      }

      await updateDoc(doc(db, "assets", id), {
        ...assetPayload,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "assetMovements"), {
        ...movementPayload,
        movedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await createSystemEvent(systemEvent);

      router.push(`/assets/${id}`);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء النقل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="نقل الأصل">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات الأصل..."
            subtitle="يتم تجهيز بيانات النقل"
          />
        ) : (
          <form
            onSubmit={submit}
            className="page-card max-w-3xl space-y-4 p-5"
          >
            {offlineNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {offlineNotice}
              </div>
            )}

            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <b>{asset?.name || "-"}</b>
              <br />
              المكان الحالي:{" "}
              {asset?.placeName ||
                asset?.farmName ||
                asset?.kubraName ||
                asset?.externalWorkshopName ||
                "-"}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="form-input"
                value={form.placeType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    placeType: e.target.value,
                    placeId: "",
                    externalWorkshopName: "",
                  })
                }
              >
                <option value="farm">نقل إلى مزرعة</option>
                <option value="kubra">نقل إلى الكِبرة</option>
                <option value="external_workshop">إرسال إلى ورشة</option>
              </select>

              {form.placeType === "external_workshop" ? (
                <input
                  className="form-input"
                  placeholder="اسم الورشة الخارجية"
                  value={form.externalWorkshopName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      externalWorkshopName: e.target.value,
                    })
                  }
                />
              ) : (
                <select
                  className="form-input"
                  value={form.placeId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      placeId: e.target.value,
                    })
                  }
                >
                  <option value="">اختر المكان الجديد</option>

                  {places.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <textarea
              className="form-input h-28"
              placeholder="سبب النقل أو ملاحظات الحركة"
              value={form.reason}
              onChange={(e) =>
                setForm({
                  ...form,
                  reason: e.target.value,
                })
              }
            />

            <button disabled={loading} className="btn-primary">
              {loading ? "جاري النقل..." : "حفظ الحركة"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
        }

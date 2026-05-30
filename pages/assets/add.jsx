import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { fileToFirestoreImage } from "../../lib/imageToFirestore";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../lib/realtimeCache";
import {
  loadMultipleSettingOptions,
  DEFAULT_SYSTEM_SETTINGS,
} from "../../lib/systemSettings";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const categories = [
  { value: "asset", label: "معدة" },
  { value: "spare_part", label: "قطعة غيار" },
  { value: "tool", label: "أداة" },
];

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const cleanList = (items = []) =>
  items.filter((item) => item.name && item.name.trim() !== "");

const addAssetToCache = (asset) => {
  const cached = getCachedCollection("cache:assets");
  setCachedCollection("cache:assets", [asset, ...cached]);
};

const addMovementToCache = (movement) => {
  const cached = getCachedCollection("cache:assetMovements");
  setCachedCollection("cache:assetMovements", [movement, ...cached]);
};

export default function AddAsset() {
  const router = useRouter();

  const [workers, setWorkers] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [types, setTypes] = useState([]);

  const [statusOptions, setStatusOptions] = useState(
    DEFAULT_SYSTEM_SETTINGS.assetStatus
  );
  const [workshopOptions, setWorkshopOptions] = useState([]);

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    category: "asset",
    assetTypeId: "",
    status: "صالح",
    placeType: "farm",
    placeId: "",
    externalWorkshopName: "",
    workerIds: [],
    notes: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [workersSnap, farmsSnap, kubrasSnap, typesSnap, settings] =
          await Promise.all([
            getDocs(collection(db, "workers")),
            getDocs(collection(db, "farms")),
            getDocs(collection(db, "kubras")),
            getDocs(collection(db, "assetTypes")),
            loadMultipleSettingOptions(["assetStatus", "externalWorkshop"]),
          ]);

        const clean = (snap) =>
          snap.docs
            .map((d) => ({
              id: d.id,
              ...d.data(),
            }))
            .filter((item) => item.name && item.name.trim() !== "");

        setWorkers(clean(workersSnap));
        setFarms(clean(farmsSnap));
        setKubras(clean(kubrasSnap));
        setTypes(clean(typesSnap));

        setStatusOptions(
          settings.assetStatus?.length
            ? settings.assetStatus
            : DEFAULT_SYSTEM_SETTINGS.assetStatus
        );

        setWorkshopOptions(settings.externalWorkshop || []);
      } catch {
        setWorkers(cleanList(getCachedCollection("cache:workers")));
        setFarms(cleanList(getCachedCollection("cache:farms")));
        setKubras(cleanList(getCachedCollection("cache:kubras")));
        setTypes(cleanList(getCachedCollection("cache:assetTypes")));

        setStatusOptions(DEFAULT_SYSTEM_SETTINGS.assetStatus);
        setWorkshopOptions([]);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(image);
    setImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);

  const isExternalWorkshop =
    form.placeType === "external_workshop" || form.status === "في الورشة";

  const places = useMemo(() => {
    if (form.placeType === "farm") return farms;
    if (form.placeType === "kubra") return kubras;
    return [];
  }, [form.placeType, farms, kubras]);

  const toggleWorker = (id) => {
    setForm((prev) => ({
      ...prev,
      workerIds: prev.workerIds.includes(id)
        ? prev.workerIds.filter((x) => x !== id)
        : [...prev.workerIds, id],
    }));
  };

  const uploadImage = async () => {
    if (!image) return "";
    return fileToFirestoreImage(image);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.name.trim() || !form.assetTypeId) {
      alert("اسم الأصل ونوع الأصل مطلوبين");
      return;
    }

    if (!isExternalWorkshop && !form.placeId) {
      alert("مكان الأصل مطلوب");
      return;
    }

    if (isExternalWorkshop && !form.externalWorkshopName.trim()) {
      alert("اختر الورشة الخارجية");
      return;
    }

    if (!isOnline() && image) {
      alert("لا يمكن رفع صورة أثناء عدم الاتصال");
      return;
    }

    setLoading(true);

    try {
      const place = isExternalWorkshop
        ? null
        : places.find((item) => item.id === form.placeId);

      const placeId = isExternalWorkshop ? "" : form.placeId;

      const placeType = isExternalWorkshop
        ? "external_workshop"
        : form.placeType;

      const placeName = isExternalWorkshop
        ? form.externalWorkshopName.trim()
        : place?.name || "";

      const type = types.find((item) => item.id === form.assetTypeId);

      const selectedWorkers = workers.filter((worker) =>
        form.workerIds.includes(worker.id)
      );

      const assetId = createLocalId();
      const movementId = createLocalId();

      const imageUrl = isOnline() ? await uploadImage() : "";

      const assetPayload = {
        name: form.name.trim(),
        code: form.code.trim(),

        category: form.category,

        assetTypeId: form.assetTypeId,
        assetTypeName: type?.name || "",

        status: isExternalWorkshop ? "في الورشة" : form.status,

        placeType,
        placeId,
        placeName,

        currentPlace: {
          type: placeType,
          id: placeId,
          name: placeName,
        },

        farmId: placeType === "farm" ? form.placeId : "",
        farmName: placeType === "farm" ? placeName : "",

        kubraId: placeType === "kubra" ? form.placeId : "",
        kubraName: placeType === "kubra" ? placeName : "",

        externalWorkshopName:
          placeType === "external_workshop" ? placeName : "",

        workerIds: form.workerIds,

        workers: selectedWorkers.map((worker) => ({
          id: worker.id,
          name: worker.name,
          phone: worker.phone || "",
        })),

        workerNames: selectedWorkers.map((worker) => worker.name).join("، "),

        imageUrl,
        notes: form.notes.trim(),
      };

      const movementPayload = {
        assetId,
        assetName: form.name.trim(),

        movementType: "created",

        fromPlaceType: "",
        fromPlaceName: "",

        toPlaceType: placeType,
        toPlaceId: placeId,
        toPlaceName: placeName,

        status: assetPayload.status,
        category: form.category,

        reason: "تسجيل أول مكان للأصل",
        notes: form.notes.trim(),
      };

      if (!isOnline()) {
        addAssetToCache({
          id: assetId,
          ...assetPayload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addMovementToCache({
          id: movementId,
          ...movementPayload,
          isOffline: true,
          syncStatus: "pending",
          movedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "assets",
          operation: "create",
          documentId: assetId,
          payload: {
            ...assetPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة أصل",
            name: assetPayload.name,
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
            label: "تسجيل أول حركة للأصل",
            name: assetPayload.name,
          },
        });

        alert("تم حفظ الأصل محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/assets");
        return;
      }

      const assetRef = doc(collection(db, "assets"));
      const movementRef = doc(collection(db, "assetMovements"));

      const batch = writeBatch(db);

      batch.set(assetRef, {
        ...assetPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(movementRef, {
        ...movementPayload,
        assetId: assetRef.id,
        movedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      router.push("/assets");
    } catch (error) {
      console.error(error);

      const place = isExternalWorkshop
        ? null
        : places.find((item) => item.id === form.placeId);

      const placeId = isExternalWorkshop ? "" : form.placeId;

      const placeType = isExternalWorkshop
        ? "external_workshop"
        : form.placeType;

      const placeName = isExternalWorkshop
        ? form.externalWorkshopName.trim()
        : place?.name || "";

      const type = types.find((item) => item.id === form.assetTypeId);

      const selectedWorkers = workers.filter((worker) =>
        form.workerIds.includes(worker.id)
      );

      const assetId = createLocalId();
      const movementId = createLocalId();

      const fallbackAssetPayload = {
        name: form.name.trim(),
        code: form.code.trim(),
        category: form.category,
        assetTypeId: form.assetTypeId,
        assetTypeName: type?.name || "",
        status: isExternalWorkshop ? "في الورشة" : form.status,
        placeType,
        placeId,
        placeName,
        currentPlace: {
          type: placeType,
          id: placeId,
          name: placeName,
        },
        farmId: placeType === "farm" ? form.placeId : "",
        farmName: placeType === "farm" ? placeName : "",
        kubraId: placeType === "kubra" ? form.placeId : "",
        kubraName: placeType === "kubra" ? placeName : "",
        externalWorkshopName:
          placeType === "external_workshop" ? placeName : "",
        workerIds: form.workerIds,
        workers: selectedWorkers.map((worker) => ({
          id: worker.id,
          name: worker.name,
          phone: worker.phone || "",
        })),
        workerNames: selectedWorkers.map((worker) => worker.name).join("، "),
        imageUrl: "",
        notes: form.notes.trim(),
      };

      const fallbackMovementPayload = {
        assetId,
        assetName: form.name.trim(),
        movementType: "created",
        fromPlaceType: "",
        fromPlaceName: "",
        toPlaceType: placeType,
        toPlaceId: placeId,
        toPlaceName: placeName,
        status: fallbackAssetPayload.status,
        category: form.category,
        reason: "تسجيل أول مكان للأصل",
        notes: form.notes.trim(),
      };

      addAssetToCache({
        id: assetId,
        ...fallbackAssetPayload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addMovementToCache({
        id: movementId,
        ...fallbackMovementPayload,
        isOffline: true,
        syncStatus: "pending",
        movedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "assets",
        operation: "create",
        documentId: assetId,
        payload: {
          ...fallbackAssetPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة أصل",
          name: fallbackAssetPayload.name,
        },
      });

      addOfflineOperation({
        collectionName: "assetMovements",
        operation: "create",
        documentId: movementId,
        payload: {
          ...fallbackMovementPayload,
          movedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        meta: {
          label: "تسجيل أول حركة للأصل",
          name: fallbackAssetPayload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ الأصل محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/assets");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة أصل">
        <form onSubmit={submit} className="page-card max-w-5xl p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <select
              className="form-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              value={form.assetTypeId}
              onChange={(e) =>
                setForm({ ...form, assetTypeId: e.target.value })
              }
            >
              <option value="">اختر النوع</option>

              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="اسم الأصل، مثال: مكينة 605 أو دينمو"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="form-input"
              placeholder="كود أو رقم اختياري"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <select
              className="form-input"
              value={form.placeType}
              onChange={(e) => {
                const nextPlaceType = e.target.value;

                setForm({
                  ...form,
                  placeType: nextPlaceType,
                  placeId: "",
                  externalWorkshopName: "",
                  status:
                    nextPlaceType === "external_workshop"
                      ? "في الورشة"
                      : form.status === "في الورشة"
                      ? "صالح"
                      : form.status,
                });
              }}
            >
              <option value="farm">داخل مزرعة</option>
              <option value="kubra">داخل الكِبرة</option>
              <option value="external_workshop">ورشة خارجية</option>
            </select>

            {isExternalWorkshop ? (
              <select
                className="form-input"
                value={form.externalWorkshopName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    externalWorkshopName: e.target.value,
                    placeType: "external_workshop",
                    placeId: "",
                    status: "في الورشة",
                  })
                }
              >
                <option value="">اختر الورشة الخارجية</option>

                {workshopOptions.map((workshop) => (
                  <option key={workshop} value={workshop}>
                    {workshop}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="form-input"
                value={form.placeId}
                onChange={(e) => setForm({ ...form, placeId: e.target.value })}
              >
                <option value="">
                  اختر {form.placeType === "farm" ? "المزرعة" : "الكِبرة"}
                </option>

                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="form-input"
              value={form.status}
              disabled={isExternalWorkshop}
              onChange={(e) => {
                const nextStatus = e.target.value;

                setForm({
                  ...form,
                  status: nextStatus,
                  placeType:
                    nextStatus === "في الورشة"
                      ? "external_workshop"
                      : form.placeType === "external_workshop"
                      ? "farm"
                      : form.placeType,
                  placeId: nextStatus === "في الورشة" ? "" : form.placeId,
                  externalWorkshopName:
                    nextStatus === "في الورشة"
                      ? form.externalWorkshopName
                      : "",
                });
              }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {isExternalWorkshop && workshopOptions.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
              لا توجد ورش خارجية في الإعدادات. أضف الورش من صفحة إعدادات النظام أولًا.
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              العمال المستلمون، يمكن اختيار أكثر من عامل
            </label>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {workers.map((worker) => (
                <label
                  key={worker.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold ${
                    form.workerIds.includes(worker.id)
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.workerIds.includes(worker.id)}
                    onChange={() => toggleWorker(worker.id)}
                  />

                  {worker.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                تصوير بالكاميرا

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </label>

              <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                رفع من الجهاز

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {imagePreview && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={imagePreview}
                  alt="معاينة الصورة"
                  className="max-h-72 w-full rounded-2xl object-contain"
                />

                {!isOnline() && (
                  <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
                    لا يمكن رفع صورة أثناء عدم الاتصال.
                  </p>
                )}

                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => setImage(null)}
                >
                  حذف الصورة المختارة
                </button>
              </div>
            )}
          </div>

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ الأصل"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

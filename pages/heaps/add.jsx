import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
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

const DEFAULT_HEAP_CROP_TYPES = ["برسيم", "رودس", "تبن", "غير معلوم"];

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const addToHeapsCache = (heap) => {
  const cached = getCachedCollection("cache:heaps");
  setCachedCollection("cache:heaps", [heap, ...cached]);
};

export default function AddHeapPage() {
  const router = useRouter();

  const [farms, setFarms] = useState([]);
  const [cropOptions, setCropOptions] = useState(DEFAULT_HEAP_CROP_TYPES);

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    pileName: "",
    farmId: "",
    cropType: "غير معلوم",
    sprinklerName: "",
    bricksCount: "",
    notes: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [farmsSnap, settings] = await Promise.all([
          getDocs(collection(db, "farms")),
          loadMultipleSettingOptions(["cropType"]),
        ]);

        const cleanFarms = farmsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((item) => item.name && item.name.trim() !== "");

        setFarms(cleanFarms);

        const settingsCropTypes = settings.cropType || [];

        setCropOptions(
          settingsCropTypes.length
            ? Array.from(new Set([...settingsCropTypes, "تبن", "غير معلوم"]))
            : DEFAULT_HEAP_CROP_TYPES
        );
      } catch {
        const cachedFarms = getCachedCollection("cache:farms");
        setFarms(cachedFarms);

        setCropOptions(DEFAULT_HEAP_CROP_TYPES);
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

  const finalCropOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...(cropOptions.length ? cropOptions : DEFAULT_SYSTEM_SETTINGS.cropType),
        form.cropType,
      ].filter(Boolean))
    );
  }, [cropOptions, form.cropType]);

  const uploadImage = async () => {
    if (!image) return "";

    if (!isOnline()) {
      return "";
    }

    return fileToFirestoreImage(image);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.pileName.trim()) {
      alert("اسم الكوم مطلوب");
      return;
    }

    if (!form.farmId) {
      alert("المزرعة مطلوبة");
      return;
    }

    if (!form.sprinklerName.trim()) {
      alert("مكان أو رقم الرشاش مطلوب");
      return;
    }

    setLoading(true);

    try {
      const selectedFarm = farms.find((farm) => farm.id === form.farmId);
      const localId = createLocalId();

      const basePayload = {
        pileName: form.pileName.trim(),

        farmId: form.farmId,
        farmName: selectedFarm?.name || "",

        cropType: form.cropType || "غير معلوم",

        sprinklerName: form.sprinklerName.trim(),

        bricksCount: form.bricksCount ? Number(form.bricksCount) : null,

        notes: form.notes.trim(),
      };

      if (!isOnline()) {
        const localHeap = {
          id: localId,
          ...basePayload,
          imageUrl: "",
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        addToHeapsCache(localHeap);

        addOfflineOperation({
          collectionName: "heaps",
          operation: "create",
          documentId: localId,
          payload: {
            ...basePayload,
            imageUrl: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة كوم",
            name: basePayload.pileName,
          },
        });

        alert("تم حفظ الكوم محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/heaps");
        return;
      }

      const imageUrl = await uploadImage();

      await addDoc(collection(db, "heaps"), {
        ...basePayload,
        imageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/heaps");
    } catch (error) {
      console.error(error);

      const selectedFarm = farms.find((farm) => farm.id === form.farmId);
      const localId = createLocalId();

      const fallbackPayload = {
        pileName: form.pileName.trim(),
        farmId: form.farmId,
        farmName: selectedFarm?.name || "",
        cropType: form.cropType || "غير معلوم",
        sprinklerName: form.sprinklerName.trim(),
        bricksCount: form.bricksCount ? Number(form.bricksCount) : null,
        imageUrl: "",
        notes: form.notes.trim(),
      };

      addToHeapsCache({
        id: localId,
        ...fallbackPayload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "heaps",
        operation: "create",
        documentId: localId,
        payload: {
          ...fallbackPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة كوم",
          name: fallbackPayload.pileName,
        },
      });

      alert("تعذر الاتصال، تم حفظ الكوم محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/heaps");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="إضافة كوم">
        <form onSubmit={submit} className="page-card max-w-5xl p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="form-input"
              placeholder="اسم الكوم، مثال: كوم 1"
              value={form.pileName}
              onChange={(e) => setForm({ ...form, pileName: e.target.value })}
            />

            <select
              className="form-input"
              value={form.farmId}
              onChange={(e) => setForm({ ...form, farmId: e.target.value })}
            >
              <option value="">اختر المزرعة</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              value={form.cropType}
              onChange={(e) => setForm({ ...form, cropType: e.target.value })}
            >
              <option value="">اختر نوع المحصول</option>
              {finalCropOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="مكان/رقم الرشاش، مثال: رشاش 18"
              value={form.sprinklerName}
              onChange={(e) =>
                setForm({ ...form, sprinklerName: e.target.value })
              }
            />

            <input
              className="form-input"
              type="number"
              placeholder="عدد اللبن اختياري، مثال: 2000"
              value={form.bricksCount}
              onChange={(e) =>
                setForm({ ...form, bricksCount: e.target.value })
              }
            />
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
                  alt="معاينة صورة الكوم"
                  className="max-h-72 w-full rounded-2xl object-contain"
                />

                {!isOnline() && (
                  <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
                    الصورة لن تُرفع أثناء عدم الاتصال. يمكن رفعها لاحقًا بعد
                    المزامنة.
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
            {loading ? "جاري الحفظ..." : "حفظ الكوم"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

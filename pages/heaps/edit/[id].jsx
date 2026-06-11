import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { fileToFirestoreImage } from "../../../lib/imageToFirestore";
import { addOfflineOperation, isOnline } from "../../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../../lib/realtimeCache";
import {
  loadMultipleSettingOptions,
  DEFAULT_SYSTEM_SETTINGS,
} from "../../../lib/systemSettings";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";
import useUserRole from "../../../hooks/useUserRole";

const DEFAULT_HEAP_CROP_TYPES = ["برسيم", "رودس", "تبن", "غير معلوم"];

const cleanList = (items = []) =>
  items.filter((item) => item.name && item.name.trim() !== "");

const getHeapFromCache = (heapId) => {
  const cached = getCachedCollection("cache:heaps");
  return cached.find((item) => item.id === heapId) || null;
};

const updateHeapCache = (heapId, payload) => {
  const cached = getCachedCollection("cache:heaps");
  const exists = cached.some((item) => item.id === heapId);

  const updatedItem = {
    id: heapId,
    ...payload,
    isOffline: true,
    syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  const next = exists
    ? cached.map((item) =>
        item.id === heapId ? { ...item, ...updatedItem } : item
      )
    : [updatedItem, ...cached];

  setCachedCollection("cache:heaps", next);
};

export default function EditHeapPage() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage, loadingRole } = useUserRole();

  const [farms, setFarms] = useState([]);
  const [cropOptions, setCropOptions] = useState(DEFAULT_HEAP_CROP_TYPES);

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [form, setForm] = useState({
    pileName: "",
    farmId: "",
    farmName: "",
    cropType: "غير معلوم",
    sprinklerName: "",
    bricksCount: "",
    imageUrl: "",
    notes: "",
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");

  useEffect(() => {
    if (!loadingRole && !canManage) {
      router.replace("/heaps");
    }
  }, [loadingRole, canManage, router]);

  useEffect(() => {
    if (!id || loadingRole || !canManage) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const cachedHeap = getHeapFromCache(id);
        const cachedFarms = cleanList(getCachedCollection("cache:farms"));

        if (cachedHeap) {
          setForm({
            pileName: cachedHeap.pileName || "",
            farmId: cachedHeap.farmId || "",
            farmName: cachedHeap.farmName || "",
            cropType: cachedHeap.cropType || "غير معلوم",
            sprinklerName: cachedHeap.sprinklerName || "",
            bricksCount:
              cachedHeap.bricksCount === null ||
              cachedHeap.bricksCount === undefined
                ? ""
                : cachedHeap.bricksCount,
            imageUrl: cachedHeap.imageUrl || "",
            notes: cachedHeap.notes || "",
          });

          setFarms(cachedFarms);

          if (!isOnline()) {
            setCropOptions(DEFAULT_HEAP_CROP_TYPES);
            setOfflineNotice("يتم تعديل البيانات من الكاش لأن الجهاز غير متصل");
            setInitialLoading(false);
            return;
          }
        }

        const [farmsSnap, settings, heapSnap] = await Promise.all([
          getDocs(collection(db, "farms")),
          loadMultipleSettingOptions(["cropType"]),
          getDoc(doc(db, "heaps", id)),
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

        if (heapSnap.exists()) {
          const data = heapSnap.data();

          setForm({
            pileName: data.pileName || "",
            farmId: data.farmId || "",
            farmName: data.farmName || "",
            cropType: data.cropType || "غير معلوم",
            sprinklerName: data.sprinklerName || "",
            bricksCount:
              data.bricksCount === null || data.bricksCount === undefined
                ? ""
                : data.bricksCount,
            imageUrl: data.imageUrl || "",
            notes: data.notes || "",
          });
        } else if (!cachedHeap) {
          alert("الكوم غير موجود");
          router.push("/heaps");
        }
      } catch (error) {
        console.error(error);

        const cachedHeap = getHeapFromCache(id);

        if (cachedHeap) {
          setForm({
            pileName: cachedHeap.pileName || "",
            farmId: cachedHeap.farmId || "",
            farmName: cachedHeap.farmName || "",
            cropType: cachedHeap.cropType || "غير معلوم",
            sprinklerName: cachedHeap.sprinklerName || "",
            bricksCount:
              cachedHeap.bricksCount === null ||
              cachedHeap.bricksCount === undefined
                ? ""
                : cachedHeap.bricksCount,
            imageUrl: cachedHeap.imageUrl || "",
            notes: cachedHeap.notes || "",
          });

          setFarms(cleanList(getCachedCollection("cache:farms")));
          setCropOptions(DEFAULT_HEAP_CROP_TYPES);
          setOfflineNotice("تعذر الاتصال، يتم تعديل آخر نسخة محفوظة من الكاش");
        } else {
          alert("حدث خطأ أثناء تحميل بيانات الكوم");
          router.push("/heaps");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [id, router, loadingRole, canManage]);

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
    if (!image) return form.imageUrl || "";
    return fileToFirestoreImage(image);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canManage) return;
    if (saving) return;

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

    if (!isOnline() && image) {
      alert("لا يمكن رفع صورة جديدة أثناء عدم الاتصال");
      return;
    }

    setSaving(true);

    const selectedFarm = farms.find((farm) => farm.id === form.farmId);

    const basePayload = {
      pileName: form.pileName.trim(),
      farmId: form.farmId,
      farmName: selectedFarm?.name || form.farmName || "",
      cropType: form.cropType || "غير معلوم",
      sprinklerName: form.sprinklerName.trim(),
      bricksCount: form.bricksCount ? Number(form.bricksCount) : null,
      notes: form.notes.trim(),
    };

    try {
      if (!isOnline()) {
        const offlinePayload = {
          ...basePayload,
          imageUrl: form.imageUrl || "",
        };

        updateHeapCache(id, offlinePayload);

        addOfflineOperation({
          collectionName: "heaps",
          operation: "update",
          documentId: id,
          payload: {
            ...offlinePayload,
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "تعديل كوم",
            name: offlinePayload.pileName,
          },
        });

        alert("تم حفظ التعديل محليًا وسيتم رفعه عند عودة الاتصال");
        router.push("/heaps");
        return;
      }

      const imageUrl = await uploadImage();

      const onlinePayload = {
        ...basePayload,
        imageUrl,
      };

      await updateDoc(doc(db, "heaps", id), {
        ...onlinePayload,
        updatedAt: serverTimestamp(),
      });

      updateHeapCache(id, {
        ...onlinePayload,
        isOffline: false,
        syncStatus: "synced",
      });

      router.push("/heaps");
    } catch (error) {
      console.error(error);

      const fallbackPayload = {
        ...basePayload,
        imageUrl: form.imageUrl || "",
      };

      updateHeapCache(id, fallbackPayload);

      addOfflineOperation({
        collectionName: "heaps",
        operation: "update",
        documentId: id,
        payload: {
          ...fallbackPayload,
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "تعديل كوم",
          name: fallbackPayload.pileName,
        },
      });

      alert("تعذر الاتصال، تم حفظ التعديل محليًا وسيتم رفعه عند عودة الاتصال");
      router.push("/heaps");
    } finally {
      setSaving(false);
    }
  };

  if (loadingRole || !canManage) {
    return (
      <ProtectedRoute>
        <Layout title="تعديل الكوم">
          <AppLoader
            variant="compact"
            title="جاري التحقق من الصلاحيات..."
            subtitle="يتم التأكد من صلاحية تعديل الكوم"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="تعديل الكوم">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات الكوم..."
            subtitle="يتم تجهيز بيانات التعديل"
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="page-card max-w-5xl p-5 space-y-4"
          >
            {offlineNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {offlineNotice}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="form-input"
                placeholder="اسم الكوم"
                value={form.pileName}
                onChange={(e) =>
                  setForm({ ...form, pileName: e.target.value })
                }
              />

              <select
                className="form-input"
                value={form.farmId}
                onChange={(e) =>
                  setForm({ ...form, farmId: e.target.value })
                }
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
                onChange={(e) =>
                  setForm({ ...form, cropType: e.target.value })
                }
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
                placeholder="عدد اللبن اختياري"
                value={form.bricksCount}
                onChange={(e) =>
                  setForm({ ...form, bricksCount: e.target.value })
                }
              />
            </div>

            <div className="space-y-3">
              {form.imageUrl && !imagePreview && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                  <img
                    src={form.imageUrl}
                    alt="صورة الكوم الحالية"
                    className="max-h-72 w-full rounded-2xl object-contain"
                  />
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                  تصوير صورة جديدة

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setImage(e.target.files?.[0] || null)}
                  />
                </label>

                <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                  رفع صورة جديدة من الجهاز

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
                    alt="معاينة الصورة الجديدة"
                    className="max-h-72 w-full rounded-2xl object-contain"
                  />

                  {!isOnline() && (
                    <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
                      لا يمكن رفع صورة جديدة أثناء عدم الاتصال.
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

            <button disabled={saving} className="btn-primary">
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

import { useEffect, useMemo, useState } from "react";
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
import { fileToFirestoreImage } from "../../../lib/imageToFirestore";
import {
  loadMultipleSettingOptions,
  DEFAULT_SYSTEM_SETTINGS,
} from "../../../lib/systemSettings";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";

const categories = [
  { value: "asset", label: "معدة" },
  { value: "spare_part", label: "قطعة غيار" },
  { value: "tool", label: "أداة" },
];

const mergeCurrentValue = (options, value) => {
  if (!value) return options;
  return options.includes(value) ? options : [value, ...options];
};

export default function EditAsset() {
  const router = useRouter();
  const { id } = router.query;

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
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    category: "asset",
    assetTypeId: "",
    assetTypeName: "",
    status: "صالح",
    placeType: "farm",
    placeId: "",
    externalWorkshopName: "",
    workerIds: [],
    notes: "",
    imageUrl: "",
  });

  useEffect(() => {
    const loadLists = async () => {
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
    };

    loadLists();
  }, []);

  useEffect(() => {
    if (!id) return;

    getDoc(doc(db, "assets", id)).then((snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      setForm((prev) => ({
        ...prev,
        ...data,

        category:
          data.category === "material" ? "asset" : data.category || "asset",

        assetTypeName: data.assetTypeName || "مكينة",

        placeType: data.placeType || data.currentPlace?.type || "farm",

        placeId:
          data.placeId ||
          data.currentPlace?.id ||
          data.farmId ||
          data.kubraId ||
          "",

        externalWorkshopName:
          data.externalWorkshopName ||
          (data.placeType === "external_workshop" ? data.placeName || "" : ""),

        workerIds: data.workerIds || [],

        status: data.status || "صالح",

        imageUrl: data.imageUrl || "",
      }));
    });
  }, [id]);

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

  const finalStatusOptions = useMemo(() => {
    return mergeCurrentValue(
      statusOptions.length ? statusOptions : DEFAULT_SYSTEM_SETTINGS.assetStatus,
      form.status
    );
  }, [statusOptions, form.status]);

  const finalWorkshopOptions = useMemo(() => {
    return mergeCurrentValue(workshopOptions, form.externalWorkshopName);
  }, [workshopOptions, form.externalWorkshopName]);

  const toggleWorker = (workerId) => {
    setForm((prev) => ({
      ...prev,

      workerIds: prev.workerIds.includes(workerId)
        ? prev.workerIds.filter((x) => x !== workerId)
        : [...prev.workerIds, workerId],
    }));
  };

  const upload = async () => {
    if (removeImage && !image) return "";

    if (!image) return form.imageUrl || "";

    return fileToFirestoreImage(image);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.name.trim()) {
      alert("اسم الأصل مطلوب");
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

      const type = types.find((t) => t.id === form.assetTypeId);

      const selectedWorkers = workers.filter((w) =>
        form.workerIds.includes(w.id)
      );

      const imageUrl = await upload();

      await updateDoc(doc(db, "assets", id), {
        name: form.name.trim(),

        code: form.code || "",

        category: form.category || "asset",

        assetTypeId: form.assetTypeId || "",

        assetTypeName: type?.name || form.assetTypeName || "مكينة",

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

        workers: selectedWorkers.map((w) => ({
          id: w.id,
          name: w.name,
          phone: w.phone || "",
        })),

        workerNames: selectedWorkers.map((w) => w.name).join("، "),

        imageUrl,

        notes: form.notes || "",

        updatedAt: serverTimestamp(),
      });

      router.push("/assets");
    } catch (error) {
      console.error(error);
      alert(error.message || "حدث خطأ أثناء التحديث");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل أصل">
        <form onSubmit={submit} className="page-card max-w-5xl p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <select
              className="form-input"
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value,
                })
              }
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              value={form.assetTypeId || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  assetTypeId: e.target.value,
                })
              }
            >
              <option value="">{form.assetTypeName || "اختر النوع"}</option>

              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="اسم الأصل"
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
              placeholder="كود أو رقم"
              value={form.code || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  code: e.target.value,
                })
              }
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
                value={form.externalWorkshopName || ""}
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

                {finalWorkshopOptions.map((workshop) => (
                  <option key={workshop} value={workshop}>
                    {workshop}
                  </option>
                ))}
              </select>
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
              {finalStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {isExternalWorkshop && finalWorkshopOptions.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
              لا توجد ورش خارجية في الإعدادات. أضف الورش من صفحة إعدادات النظام أولًا.
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              العمال المستلمون
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
            {form.imageUrl && !removeImage && !imagePreview && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={form.imageUrl}
                  className="max-h-72 w-full rounded-2xl object-contain"
                  alt="asset"
                />

                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => {
                    setRemoveImage(true);
                    setImage(null);
                  }}
                >
                  حذف الصورة الحالية
                </button>
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
                  onChange={(e) => {
                    setImage(e.target.files?.[0] || null);
                    setRemoveImage(false);
                  }}
                />
              </label>

              <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-center font-bold hover:bg-slate-50">
                رفع صورة من الجهاز

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setImage(e.target.files?.[0] || null);
                    setRemoveImage(false);
                  }}
                />
              </label>
            </div>

            {imagePreview && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="max-h-72 w-full rounded-2xl object-contain"
                />

                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => setImage(null)}
                >
                  حذف الصورة المختارة
                </button>
              </div>
            )}

            {removeImage && (
              <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                سيتم حذف الصورة الحالية عند حفظ التعديل
              </div>
            )}
          </div>

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes || ""}
            onChange={(e) =>
              setForm({
                ...form,
                notes: e.target.value,
              })
            }
          />

          <div className="flex flex-wrap gap-2">
            <button disabled={loading} className="btn-primary">
              {loading ? "جاري التحديث..." : "تحديث الأصل"}
            </button>

            <a href={`/assets/move/${id}`} className="btn-secondary">
              نقل الأصل
            </a>
          </div>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

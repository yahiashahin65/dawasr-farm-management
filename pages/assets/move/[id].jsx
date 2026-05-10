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

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";

const statuses = ["صالح", "عاطل", "في الورشة"];

export default function MoveAsset() {
  const router = useRouter();
  const { id } = router.query;

  const [asset, setAsset] = useState(null);

  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    placeType: "farm",
    placeId: "",
    externalWorkshopName: "",
    status: "صالح",
    reason: "",
  });

  useEffect(() => {
    const loadLists = async () => {
      const [farmsSnap, kubrasSnap] = await Promise.all([
        getDocs(collection(db, "farms")),
        getDocs(collection(db, "kubras")),
      ]);

      const clean = (snap) =>
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((item) => item.name && item.name.trim() !== "");

      setFarms(clean(farmsSnap));
      setKubras(clean(kubrasSnap));
    };

    loadLists();
  }, []);

  useEffect(() => {
    if (!id) return;

    getDoc(doc(db, "assets", id)).then((snap) => {
      if (!snap.exists()) return;

      const data = { id: snap.id, ...snap.data() };

      setAsset(data);

      setForm((prev) => ({
        ...prev,
        placeType: data.placeType || "farm",
        placeId:
          data.placeId ||
          data.farmId ||
          data.kubraId ||
          "",
        externalWorkshopName:
          data.externalWorkshopName || "",
        status: data.status || "صالح",
      }));
    });
  }, [id]);

  const places = useMemo(() => {
    if (form.placeType === "farm") return farms;
    if (form.placeType === "kubra") return kubras;
    return [];
  }, [form.placeType, farms, kubras]);

  const submit = async (e) => {
    e.preventDefault();

    const isExternalWorkshop =
      form.placeType === "external_workshop";

    if (!isExternalWorkshop && !form.placeId) {
      alert("اختر المكان الجديد");
      return;
    }

    if (
      isExternalWorkshop &&
      !form.externalWorkshopName.trim()
    ) {
      alert("اسم الورشة الخارجية مطلوب");
      return;
    }

    setLoading(true);

    try {
      const place = isExternalWorkshop
        ? null
        : places.find((x) => x.id === form.placeId);

      const placeId = isExternalWorkshop
        ? ""
        : form.placeId;

      const placeName = isExternalWorkshop
        ? form.externalWorkshopName.trim()
        : place?.name || "";

      const finalStatus = isExternalWorkshop
        ? "في الورشة"
        : form.status;

      await updateDoc(doc(db, "assets", id), {
        placeType: form.placeType,
        placeId,
        placeName,

        status: finalStatus,

        currentPlace: {
          type: form.placeType,
          id: placeId,
          name: placeName,
        },

        farmId:
          form.placeType === "farm"
            ? form.placeId
            : "",

        farmName:
          form.placeType === "farm"
            ? placeName
            : "",

        kubraId:
          form.placeType === "kubra"
            ? form.placeId
            : "",

        kubraName:
          form.placeType === "kubra"
            ? placeName
            : "",

        externalWorkshopName:
          form.placeType === "external_workshop"
            ? placeName
            : "",

        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "assetMovements"), {
        assetId: id,
        assetName: asset?.name || "",

        movementType: "moved",

        fromPlaceType: asset?.placeType || "",
        fromPlaceId: asset?.placeId || "",

        fromPlaceName:
          asset?.placeName ||
          asset?.farmName ||
          asset?.kubraName ||
          asset?.externalWorkshopName ||
          "",

        toPlaceType: form.placeType,
        toPlaceId: placeId,
        toPlaceName: placeName,

        status: finalStatus,

        reason: form.reason || "نقل الأصل",

        movedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      router.push(`/assets/${id}`);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء النقل");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="نقل الأصل">
        <form
          onSubmit={submit}
          className="page-card max-w-3xl space-y-4 p-5"
        >
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <b>{asset?.name}</b>

            <br />

            المكان الحالي:
            {" "}
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
                  status:
                    e.target.value ===
                    "external_workshop"
                      ? "في الورشة"
                      : form.status === "في الورشة"
                      ? "صالح"
                      : form.status,
                })
              }
            >
              <option value="farm">
                نقل إلى مزرعة
              </option>

              <option value="kubra">
                نقل إلى الكِبرة
              </option>

              <option value="external_workshop">
                نقل إلى ورشة خارجية
              </option>
            </select>

            {form.placeType ===
            "external_workshop" ? (
              <input
                className="form-input"
                placeholder="اسم الورشة الخارجية"
                value={form.externalWorkshopName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    externalWorkshopName:
                      e.target.value,
                    status: "في الورشة",
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
                <option value="">
                  اختر المكان الجديد
                </option>

                {places.map((place) => (
                  <option
                    key={place.id}
                    value={place.id}
                  >
                    {place.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <select
            className="form-input"
            value={form.status}
            disabled={
              form.placeType ===
              "external_workshop"
            }
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value,
              })
            }
          >
            {statuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ))}
          </select>

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

          <button
            disabled={loading}
            className="btn-primary"
          >
            {loading
              ? "جاري النقل..."
              : "حفظ حركة النقل"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

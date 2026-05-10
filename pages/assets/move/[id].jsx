import { useEffect, useState } from "react";

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

export default function MoveAsset() {
  const router = useRouter();

  const { id } = router.query;

  const [asset, setAsset] =
    useState(null);

  const [farms, setFarms] =
    useState([]);

  const [kubras, setKubras] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [form, setForm] =
    useState({
      placeType: "farm",

      placeId: "",

      externalWorkshopName:
        "",

      reason: "",
    });

  useEffect(() => {
    getDocs(collection(db, "farms")).then(
      (s) =>
        setFarms(
          s.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        )
    );

    getDocs(
      collection(db, "kubras")
    ).then((s) =>
      setKubras(
        s.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      )
    );
  }, []);

  useEffect(() => {
    if (!id) return;

    getDoc(doc(db, "assets", id)).then(
      (s) => {
        if (!s.exists()) return;

        const d = {
          id: s.id,
          ...s.data(),
        };

        setAsset(d);

        setForm((p) => ({
          ...p,

          placeType:
            d.placeType || "farm",

          placeId:
            d.placeId ||
            d.farmId ||
            d.kubraId ||
            "",

          externalWorkshopName:
            d.externalWorkshopName ||
            "",
        }));
      }
    );
  }, [id]);

  const places =
    form.placeType === "farm"
      ? farms
      : kubras;

  const submit = async (e) => {
    e.preventDefault();

    const isExternalWorkshop =
      form.placeType ===
      "external_workshop";

    if (
      !isExternalWorkshop &&
      !form.placeId
    ) {
      return alert(
        "اختر المكان الجديد"
      );
    }

    if (
      isExternalWorkshop &&
      !form.externalWorkshopName.trim()
    ) {
      return alert(
        "اسم الورشة الخارجية مطلوب"
      );
    }

    setLoading(true);

    try {
      const place = isExternalWorkshop
        ? null
        : places.find(
            (x) =>
              x.id === form.placeId
          );

      const placeId =
        isExternalWorkshop
          ? ""
          : form.placeId;

      const placeName =
        isExternalWorkshop
          ? form.externalWorkshopName.trim()
          : place?.name || "";

      const newStatus =
        isExternalWorkshop
          ? "في الورشة"
          : asset?.status ===
            "في الورشة"
          ? "صالح"
          : asset?.status;

      await updateDoc(
        doc(db, "assets", id),
        {
          placeType:
            form.placeType,

          placeId,

          placeName,

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
            form.placeType ===
            "external_workshop"
              ? placeName
              : "",

          status: newStatus,

          updatedAt:
            serverTimestamp(),
        }
      );

      await addDoc(
        collection(
          db,
          "assetMovements"
        ),
        {
          assetId: id,

          assetName:
            asset?.name || "",

          movementType:
            isExternalWorkshop
              ? "maintenance"
              : "transfer",

          fromPlaceType:
            asset?.placeType || "",

          fromPlaceId:
            asset?.placeId || "",

          fromPlaceName:
            asset?.placeName ||
            asset?.farmName ||
            asset?.kubraName ||
            asset?.externalWorkshopName ||
            "",

          toPlaceType:
            form.placeType,

          toPlaceId: placeId,

          toPlaceName:
            placeName,

          status: newStatus,

          category:
            asset?.category ||
            "asset",

          reason:
            form.reason ||
            (isExternalWorkshop
              ? "إرسال للورشة"
              : "نقل أصل"),

          movedAt:
            serverTimestamp(),

          createdAt:
            serverTimestamp(),
        }
      );

      router.push(
        `/assets/${id}`
      );
    } catch (e) {
      console.error(e);

      alert(
        "حدث خطأ أثناء النقل"
      );

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

                  placeType:
                    e.target.value,

                  placeId: "",

                  externalWorkshopName:
                    "",
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
                إرسال إلى ورشة
              </option>
            </select>

            {form.placeType ===
            "external_workshop" ? (
              <input
                className="form-input"
                placeholder="اسم الورشة الخارجية"
                value={
                  form.externalWorkshopName
                }
                onChange={(e) =>
                  setForm({
                    ...form,

                    externalWorkshopName:
                      e.target.value,
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
                    placeId:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  اختر المكان الجديد
                </option>

                {places.map((x) => (
                  <option
                    key={x.id}
                    value={x.id}
                  >
                    {x.name}
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
                reason:
                  e.target.value,
              })
            }
          />

          <button
            disabled={loading}
            className="btn-primary"
          >
            {loading
              ? "جاري النقل..."
              : "حفظ الحركة"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

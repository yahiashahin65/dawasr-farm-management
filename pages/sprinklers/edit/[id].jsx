import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { sprinklersSeed } from "../../../lib/sprinklersSeed";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";
import useUserRole from "../../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";

const initialForm = {
  name: "",
  machine: "",
  towersCount: "",
  gear: "",
  sequence: "",
  farmName: "",
  movement: "",
  cropType: "",
  hectareNumber: "",
  workerId: "",
  workerName: "",
  workerPhone: "",
  imageUrl: "",
};

const uniqueOptions = (items, key) => {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function EditSprinkler() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage } = useUserRole();

  const [form, setForm] = useState(initialForm);
  const [sprinklers, setSprinklers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setInitialLoading(true);

      try {
        const [sprinklerSnap, sprinklersSnap, workersSnap] = await Promise.all([
          getDoc(doc(db, "sprinklers", id)),
          getDocs(collection(db, "sprinklers")),
          getDocs(collection(db, "workers")),
        ]);

        if (sprinklerSnap.exists()) {
          setForm({
            ...initialForm,
            ...sprinklerSnap.data(),
            imageUrl: sprinklerSnap.data().imageUrl || "",
          });
        } else {
          alert("الرشاش غير موجود");
          router.push("/sprinklers");
        }

        setSprinklers(
          sprinklersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setWorkers(
          workersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء تحميل بيانات الرشاش");
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  const optionsSource = useMemo(() => {
    return [...sprinklersSeed, ...sprinklers, form];
  }, [sprinklers, form]);

  const farmOptions = uniqueOptions(optionsSource, "farmName");
  const machineOptions = uniqueOptions(optionsSource, "machine");
  const gearOptions = uniqueOptions(optionsSource, "gear");
  const movementOptions = uniqueOptions(optionsSource, "movement");
  const cropOptions = uniqueOptions(optionsSource, "cropType");

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };


  const updateWorker = (workerId) => {
    const selectedWorker = workers.find((worker) => worker.id === workerId);

    setForm((prev) => ({
      ...prev,
      workerId,
      workerName: selectedWorker?.name || "",
      workerPhone: selectedWorker?.phone || "",
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!canManage || !id) return;

    setSaving(true);

    try {
      await updateDoc(doc(db, "sprinklers", id), {
        ...form,
        imageUrl: form.imageUrl || "",
        updatedAt: serverTimestamp(),
      });

      alert("تم تعديل الرشاش بنجاح");
      router.push(`/sprinklers/${id}`);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء تعديل الرشاش");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تعديل الرشاش">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات الرشاش..."
            subtitle="يتم تجهيز نموذج التعديل"
          />
        ) : !canManage ? (
          <div className="page-card p-5 text-center font-bold text-slate-500">
            لا تملك صلاحية تعديل الرشاشات
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/sprinklers/${id}`} className="btn-secondary">
                <FontAwesomeIcon icon={faArrowRight} />
                رجوع للتفاصيل
              </Link>
            </div>

            <form onSubmit={submit} className="page-card p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="اسم الرشاش">
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                  />
                </Field>

                <Field label="المكينة">
                  <select
                    className="form-input"
                    value={form.machine}
                    onChange={(e) => updateField("machine", e.target.value)}
                  >
                    <option value="">اختر المكينة</option>
                    {machineOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                <Field label="عدد الأبراج">
                  <input
                    className="form-input"
                    value={form.towersCount}
                    onChange={(e) => updateField("towersCount", e.target.value)}
                  />
                </Field>

                <Field label="الجير">
                  <select
                    className="form-input"
                    value={form.gear}
                    onChange={(e) => updateField("gear", e.target.value)}
                  >
                    <option value="">اختر الجير</option>
                    {gearOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                <Field label="التسلسل">
                  <input
                    className="form-input"
                    value={form.sequence}
                    onChange={(e) => updateField("sequence", e.target.value)}
                  />
                </Field>

                <Field label="المزرعة">
                  <select
                    className="form-input"
                    value={form.farmName}
                    onChange={(e) => updateField("farmName", e.target.value)}
                  >
                    <option value="">اختر المزرعة</option>
                    {farmOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                <Field label="حركة الرشاش">
                  <select
                    className="form-input"
                    value={form.movement}
                    onChange={(e) => updateField("movement", e.target.value)}
                  >
                    <option value="">اختر حركة الرشاش</option>
                    {movementOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                <Field label="نوع المحصول">
                  <select
                    className="form-input"
                    value={form.cropType}
                    onChange={(e) => updateField("cropType", e.target.value)}
                  >
                    <option value="">اختر نوع المحصول</option>
                    {cropOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                <Field label="رقم هكتار">
                  <input
                    className="form-input"
                    value={form.hectareNumber}
                    onChange={(e) => updateField("hectareNumber", e.target.value)}
                  />
                </Field>

                <Field label="العامل">
                  <select
                    className="form-input"
                    value={form.workerId}
                    onChange={(e) => updateWorker(e.target.value)}
                  >
                    <option value="">اختر العامل من صفحة العمال</option>
                    {workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="جوال العامل">
                  <input
                    className="form-input"
                    value={form.workerPhone}
                    readOnly
                  />
                </Field>

                <Field label="رابط الصورة">
                  <input
                    className="form-input"
                    placeholder="اتركه فارغًا لو مفيش صورة"
                    value={form.imageUrl}
                    onChange={(e) => updateField("imageUrl", e.target.value)}
                  />
                </Field>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Link href={`/sprinklers/${id}`} className="btn-secondary">
                  إلغاء
                </Link>

                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                  <FontAwesomeIcon icon={faFloppyDisk} />
                  {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

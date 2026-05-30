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

export default function EditFarm() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      try {
        const cachedFarms = getCachedCollection("cache:farms");
        const cachedFarm = cachedFarms.find((x) => x.id === id);

        if (cachedFarm) {
          setForm({
            name: cachedFarm.name || "",
            managerName: cachedFarm.managerName || "",
            notes: cachedFarm.notes || "",
            engineerIds: cachedFarm.engineerIds || [],
          });

          if (!isOnline()) {
            setLoading(false);
          }
        }

        const [engineersSnap, farmSnap] = await Promise.all([
          getDocs(collection(db, "engineers")),
          getDoc(doc(db, "farms", id)),
        ]);

        setEngineers(
          engineersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        if (farmSnap.exists()) {
          const data = farmSnap.data();

          setForm({
            name: data.name || "",
            managerName: data.managerName || "",
            notes: data.notes || "",
            engineerIds: data.engineerIds || [],
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const toggle = (engineerId) => {
    setForm((prev) => ({
      ...prev,
      engineerIds: prev.engineerIds.includes(engineerId)
        ? prev.engineerIds.filter((x) => x !== engineerId)
        : [...prev.engineerIds, engineerId],
    }));
  };

  const updateFarmCache = (farmId, payload) => {
    const cached = getCachedCollection("cache:farms");

    const updated = cached.map((item) =>
      item.id === farmId
        ? {
            ...item,
            ...payload,
            syncStatus: "pending",
          }
        : item
    );

    setCachedCollection("cache:farms", updated);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("اسم المزرعة مطلوب");
      return;
    }

    setSaving(true);

    try {
      const selectedEngineers = engineers.filter((x) =>
        form.engineerIds.includes(x.id)
      );

      const payload = {
        name: form.name.trim(),
        managerName: form.managerName.trim(),
        notes: form.notes.trim(),

        engineerIds: form.engineerIds,

        engineers: selectedEngineers.map((x) => ({
          id: x.id,
          name: x.name,
          phone: x.phone || "",
        })),

        engineerNames: selectedEngineers
          .map((x) => x.name)
          .join("، "),
      };

      if (!isOnline()) {
        updateFarmCache(id, payload);

        addOfflineOperation({
          collectionName: "farms",
          operation: "update",
          documentId: id,
          payload: {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "تعديل مزرعة",
            name: payload.name,
          },
        });

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
      alert("حدث خطأ أثناء حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="تعديل مزرعة">
          <AppLoader
            variant="compact"
            title="جاري تحميل بيانات المزرعة..."
            subtitle="يتم تجهيز بيانات التعديل"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="تعديل مزرعة">
        <form
          onSubmit={submit}
          className="page-card max-w-3xl p-5 space-y-4"
        >
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

          <button
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

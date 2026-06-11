import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
} from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const addFarmToCache = (farm) => {
  const cached = getCachedCollection("cache:farms");
  setCachedCollection("cache:farms", [farm, ...cached]);
};

export default function AddFarm() {
  const router = useRouter();
  const { canManage, loadingRole } = useUserRole();

  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    managerName: "",
    notes: "",
    engineerIds: [],
  });

  useEffect(() => {
    if (!loadingRole && !canManage) {
      router.replace("/farms");
    }
  }, [loadingRole, canManage, router]);

  useEffect(() => {
    if (loadingRole || !canManage) return;

    const loadEngineers = async () => {
      try {
        const snap = await getDocs(collection(db, "engineers"));
        setEngineers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setEngineers(getCachedCollection("cache:engineers"));
      }
    };

    loadEngineers();
  }, [loadingRole, canManage]);

  const toggle = (id) => {
    setForm((prev) => ({
      ...prev,
      engineerIds: prev.engineerIds.includes(id)
        ? prev.engineerIds.filter((x) => x !== id)
        : [...prev.engineerIds, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!canManage) return;
    if (loading) return;

    if (!form.name.trim()) {
      alert("اسم المزرعة مطلوب");
      return;
    }

    setLoading(true);

    const selected = engineers.filter((item) =>
      form.engineerIds.includes(item.id)
    );

    const localId = createLocalId();

    const payload = {
      name: form.name.trim(),
      managerName: form.managerName.trim(),
      notes: form.notes.trim(),
      engineerIds: form.engineerIds,
      engineers: selected.map((item) => ({
        id: item.id,
        name: item.name,
        phone: item.phone || "",
      })),
      engineerNames: selected.map((item) => item.name).join("، "),
    };

    try {
      if (!isOnline()) {
        addFarmToCache({
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "farms",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة مزرعة",
            name: payload.name,
          },
        });

        alert("تم حفظ المزرعة محليًا وسيتم رفعها عند عودة الاتصال");
        router.push("/farms");
        return;
      }

      await addDoc(collection(db, "farms"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/farms");
    } catch (error) {
      console.error(error);

      addFarmToCache({
        id: localId,
        ...payload,
        isOffline: true,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      addOfflineOperation({
        collectionName: "farms",
        operation: "create",
        documentId: localId,
        payload: {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        meta: {
          label: "إضافة مزرعة",
          name: payload.name,
        },
      });

      alert("تعذر الاتصال، تم حفظ المزرعة محليًا وسيتم رفعها عند عودة الاتصال");
      router.push("/farms");
    } finally {
      setLoading(false);
    }
  };

  if (loadingRole || !canManage) {
    return (
      <ProtectedRoute>
        <Layout title="إضافة مزرعة">
          <AppLoader
            variant="compact"
            title="جاري التحقق من الصلاحيات..."
            subtitle="يتم التأكد من صلاحية إضافة مزرعة"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="إضافة مزرعة">
        <form onSubmit={submit} className="page-card max-w-3xl p-5 space-y-4">
          <input
            className="form-input"
            placeholder="اسم المزرعة"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            className="form-input"
            placeholder="مسئول المزرعة / المشرف الداخلي"
            value={form.managerName}
            onChange={(e) =>
              setForm({ ...form, managerName: e.target.value })
            }
          />

          <div>
            <label className="mb-2 block text-sm font-black text-slate-700">
              المهندسون المسئولون
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {engineers.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold ${
                    form.engineerIds.includes(item.id)
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.engineerIds.includes(item.id)}
                    onChange={() => toggle(item.id)}
                  />

                  {item.name}
                </label>
              ))}
            </div>
          </div>

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";
import {
  getCachedCollection,
  setCachedCollection,
  subscribeCachedCollection,
} from "../../lib/realtimeCache";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

const createLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const addVehicleToCache = (vehicle) =>
  setCachedCollection("cache:vehicles", [
    vehicle,
    ...getCachedCollection("cache:vehicles"),
  ]);

export default function AddVehicle() {
  const router = useRouter();
  const { canManage, loadingRole } = useUserRole();

  const [workers, setWorkers] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [accountants, setAccountants] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    plateLetters: "",
    plateNumbers: "",
    assignedToType: "",
    assignedToId: "",
    farmId: "",
    status: "صالح",
    notes: "",
  });

  useEffect(() => {
    if (!loadingRole && !canManage) {
      router.replace("/vehicles");
    }
  }, [loadingRole, canManage, router]);

  useEffect(() => {
    if (loadingRole || !canManage) return;

    const unsubs = [
      subscribeCachedCollection({
        db,
        collectionName: "workers",
        cacheKey: "cache:workers",
        orderField: "createdAt",
        orderDirection: "desc",
        onData: setWorkers,
      }),
      subscribeCachedCollection({
        db,
        collectionName: "engineers",
        cacheKey: "cache:engineers",
        orderField: "createdAt",
        orderDirection: "desc",
        onData: setEngineers,
      }),
      subscribeCachedCollection({
        db,
        collectionName: "accountants",
        cacheKey: "cache:accountants",
        orderField: "createdAt",
        orderDirection: "desc",
        onData: setAccountants,
      }),
      subscribeCachedCollection({
        db,
        collectionName: "farms",
        cacheKey: "cache:farms",
        orderField: "createdAt",
        orderDirection: "desc",
        onData: setFarms,
      }),
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe?.());
  }, [loadingRole, canManage]);

  const assignees = useMemo(() => {
    if (form.assignedToType === "worker") return workers;
    if (form.assignedToType === "engineer") return engineers;
    if (form.assignedToType === "accountant") return accountants;
    return [];
  }, [form.assignedToType, workers, engineers, accountants]);

  const submit = async (e) => {
    e.preventDefault();

    if (!canManage) return;
    if (loading) return;

    if (!form.name.trim()) {
      alert("اسم السيارة مطلوب");
      return;
    }

    setLoading(true);

    const assignee = assignees.find((item) => item.id === form.assignedToId);
    const farm = farms.find((item) => item.id === form.farmId);

    const payload = {
      name: form.name.trim(),
      plateLetters: form.plateLetters.trim(),
      plateNumbers: form.plateNumbers.trim(),

      assignedToType: form.assignedToType || "",
      assignedToId: form.assignedToId || "",
      assignedToName: assignee?.name || "",

      farmId: form.farmId || "",
      farmName: farm?.name || "",

      placeType: farm?.id ? "farm" : "",
      placeId: farm?.id || "",
      placeName: farm?.name || "",

      status: form.status || "صالح",

      workshopEntryId: "",
      inWorkshop: false,
      workshopName: "",
      lastMaintenanceCost: 0,
      unpaidMaintenanceCost: 0,

      notes: form.notes.trim(),
    };

    const localId = createLocalId();

    try {
      if (!isOnline()) {
        addVehicleToCache({
          id: localId,
          ...payload,
          isOffline: true,
          syncStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addOfflineOperation({
          collectionName: "vehicles",
          operation: "create",
          documentId: localId,
          payload: {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          meta: {
            label: "إضافة سيارة",
            name: payload.name,
          },
        });

        alert("تم حفظ السيارة محليًا وسيتم رفعها عند عودة الاتصال");
        router.push("/vehicles");
        return;
      }

      await addDoc(collection(db, "vehicles"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/vehicles");
    } catch (error) {
      console.error(error);
      alert("تعذر حفظ السيارة");
    } finally {
      setLoading(false);
    }
  };

  if (loadingRole || !canManage) {
    return (
      <ProtectedRoute>
        <Layout title="إضافة سيارة">
          <AppLoader
            variant="compact"
            title="جاري التحقق من الصلاحيات..."
            subtitle="يتم التأكد من صلاحية إضافة السيارة"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="إضافة سيارة">
        <form onSubmit={submit} className="page-card max-w-4xl space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="form-input"
              placeholder="اسم السيارة مثال: Toyota Hilux"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <select
              className="form-input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="صالح">صالح</option>
              <option value="عاطل">عاطل</option>
            </select>

            <input
              className="form-input"
              placeholder="حروف اللوحة مثال: ا ب ح"
              value={form.plateLetters}
              onChange={(e) =>
                setForm({ ...form, plateLetters: e.target.value })
              }
            />

            <input
              className="form-input"
              placeholder="أرقام اللوحة مثال: 8765"
              value={form.plateNumbers}
              onChange={(e) =>
                setForm({ ...form, plateNumbers: e.target.value })
              }
            />

            <select
              className="form-input"
              value={form.farmId}
              onChange={(e) => setForm({ ...form, farmId: e.target.value })}
            >
              <option value="">مكان السيارة / المزرعة اختياري</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              value={form.assignedToType}
              onChange={(e) =>
                setForm({
                  ...form,
                  assignedToType: e.target.value,
                  assignedToId: "",
                })
              }
            >
              <option value="">الراكب / المسؤول اختياري</option>
              <option value="worker">عامل</option>
              <option value="engineer">مهندس</option>
              <option value="accountant">محاسب</option>
            </select>

            <select
              className="form-input"
              value={form.assignedToId}
              disabled={!form.assignedToType}
              onChange={(e) =>
                setForm({ ...form, assignedToId: e.target.value })
              }
            >
              <option value="">اختر الشخص اختياري</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <textarea
            className="form-input h-28"
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button disabled={loading} className="btn-primary">
            {loading ? "جاري الحفظ..." : "حفظ السيارة"}
          </button>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}

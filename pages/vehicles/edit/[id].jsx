import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { subscribeCachedCollection } from "../../../lib/realtimeCache";
import ProtectedRoute from "../../../components/ProtectedRoute";
import Layout from "../../../components/Layout";
import AppLoader from "../../../components/AppLoader";
import useUserRole from "../../../hooks/useUserRole";

export default function EditVehicle() {
  const router = useRouter();
  const { id } = router.query;
  const { canManage, loadingRole } = useUserRole();

  const [workers, setWorkers] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [accountants, setAccountants] = useState([]);
  const [farms, setFarms] = useState([]);

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!id || loadingRole || !canManage) return;

    (async () => {
      const snap = await getDoc(doc(db, "vehicles", id));

      if (snap.exists()) {
        const data = snap.data();

        setForm({
          name: data.name || "",
          plateLetters: data.plateLetters || "",
          plateNumbers: data.plateNumbers || "",
          assignedToType: data.assignedToType || "",
          assignedToId: data.assignedToId || "",
          farmId: data.farmId || "",
          status: data.status || "صالح",
          notes: data.notes || "",
        });
      }

      setLoading(false);
    })();
  }, [id, loadingRole, canManage]);

  const assignees = useMemo(() => {
    if (form.assignedToType === "worker") return workers;
    if (form.assignedToType === "engineer") return engineers;
    if (form.assignedToType === "accountant") return accountants;
    return [];
  }, [form.assignedToType, workers, engineers, accountants]);

  const submit = async (e) => {
    e.preventDefault();

    if (!canManage) return;

    if (!form.name.trim()) {
      alert("اسم السيارة مطلوب");
      return;
    }

    setSaving(true);

    const assignee = assignees.find((item) => item.id === form.assignedToId);
    const farm = farms.find((item) => item.id === form.farmId);

    try {
      await updateDoc(doc(db, "vehicles", id), {
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
        notes: form.notes.trim(),

        updatedAt: serverTimestamp(),
      });

      router.push("/vehicles");
    } catch (error) {
      console.error(error);
      alert("تعذر حفظ التعديل");
    } finally {
      setSaving(false);
    }
  };

  if (loadingRole || !canManage) {
    return (
      <ProtectedRoute>
        <Layout title="تعديل سيارة">
          <AppLoader
            variant="compact"
            title="جاري التحقق من الصلاحيات..."
            subtitle="يتم التأكد من صلاحية تعديل السيارة"
          />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout title="تعديل سيارة">
        {loading ? (
          <AppLoader variant="compact" title="جاري تحميل السيارة..." />
        ) : (
          <form onSubmit={submit} className="page-card max-w-4xl space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="form-input"
                placeholder="اسم السيارة"
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
                placeholder="حروف اللوحة"
                value={form.plateLetters}
                onChange={(e) =>
                  setForm({ ...form, plateLetters: e.target.value })
                }
              />

              <input
                className="form-input"
                placeholder="أرقام اللوحة"
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

            <button disabled={saving} className="btn-primary">
              {saving ? "جاري الحفظ..." : "حفظ التعديل"}
            </button>
          </form>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

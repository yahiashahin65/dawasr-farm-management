import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import useUserRole from "../../hooks/useUserRole";

export default function Farms() {
  const { canManage } = useUserRole();
  const [items, setItems] = useState([]);

  const load = async () => {
    const s = await getDocs(
      query(collection(db, "farms"), orderBy("createdAt", "desc"))
    );

    setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("حذف المزرعة؟")) {
      await deleteDoc(doc(db, "farms", id));
      load();
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="المزارع">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div />

          {canManage && (
            <Link href="/farms/add" className="btn-primary">
              إضافة مزرعة
            </Link>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((x) => (
            <div key={x.id} className="page-card p-5">
              <h3 className="text-lg font-black">{x.name}</h3>

              <p className="mt-2 text-sm text-slate-500">
                مسئول المزرعة: {x.managerName || "-"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                المهندسون: {x.engineerNames || "-"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn-secondary" href={`/farms/${x.id}`}>
                  عرض
                </Link>

                {canManage && (
                  <>
                    <Link className="btn-secondary" href={`/farms/edit/${x.id}`}>
                      تعديل
                    </Link>

                    <button className="btn-danger" onClick={() => remove(x.id)}>
                      حذف
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

import { useEffect, useMemo, useState } from "react";
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
import AppLoader from "../../components/AppLoader";
import useUserRole from "../../hooks/useUserRole";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faPlus,
  faPen,
  faTrash,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";

import { normalizeList } from "../../lib/inventory";

const PAGE_SIZE = 10;

export default function AssetTypes() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const loadAssets = async () => {
    const assetsSnap = await getDocs(collection(db, "assets"));

    setAssets(
      assetsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  const loadTypes = async () => {
    const snap = await getDocs(
      query(collection(db, "assetTypes"), orderBy("createdAt", "desc"))
    );

    setItems(normalizeList(snap.docs));
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        await Promise.all([loadAssets(), loadTypes()]);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const count = (type) =>
    assets.filter((asset) => asset.assetTypeId === type.id).length;

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((type) => {
      const haystack = `${type.name || ""} ${type.notes || ""}`.toLowerCase();

      return haystack.includes(keyword);
    });
  }, [items, search]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filteredItems, currentPage]);

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف نوع المعدة؟")) {
      await deleteDoc(doc(db, "assetTypes", id));

      await Promise.all([loadTypes(), loadAssets()]);

      if (paginatedItems.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      }
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="أنواع المعدات">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل أنواع المعدات..."
            subtitle="يتم تجهيز الأنواع وربطها بالأصول"
          />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <Link href="/asset-types/add" className="btn-primary">
                    <FontAwesomeIcon icon={faPlus} />
                    إضافة نوع
                  </Link>
                )}
              </div>

              <Link href="/assets" className="btn-secondary">
                إجمالي المعدات: {assets.length}
              </Link>
            </div>

            <div className="page-card mb-4 flex items-center gap-2 p-3">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="text-slate-400"
              />

              <input
                className="w-full bg-transparent p-2 outline-none"
                placeholder="بحث باسم النوع أو الملاحظات..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filteredItems.length}
            </div>

            <div className="page-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">نوع المعدة</th>
                    <th className="table-th">عدد المعدات</th>
                    <th className="table-th">ملاحظات</th>
                    <th className="table-th">إجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((type) => (
                    <tr
                      key={type.id}
                      className="clickable-row border-t border-slate-100"
                    >
                      <td className="table-td font-black">
                        <Link
                          href={`/assets?assetTypeId=${type.id}`}
                          className="text-green-700 hover:underline"
                        >
                          {type.name}
                        </Link>
                      </td>

                      <td className="table-td">
                        <Link
                          href={`/assets?assetTypeId=${type.id}`}
                          className="badge bg-green-50 text-green-700"
                        >
                          {count(type)}
                        </Link>
                      </td>

                      <td className="table-td">{type.notes || "-"}</td>

                      <td className="table-td">
                        <div className="flex gap-2">
                          {canManage && (
                            <>
                              <Link
                                href={`/asset-types/edit/${type.id}`}
                                className="btn-secondary !p-2"
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </Link>

                              <button
                                type="button"
                                onClick={() => remove(type.id)}
                                className="btn-danger !p-2"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td className="table-td text-center" colSpan="4">
                        لا توجد أنواع معدات مطابقة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="btn-secondary disabled:opacity-50"
              >
                السابق
              </button>

              <span className="font-bold text-slate-700">
                صفحة {currentPage} من {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="btn-secondary disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

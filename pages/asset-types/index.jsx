import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
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
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageCursors, setPageCursors] = useState({ 1: null });

  const loadAssets = async () => {
    const assetsSnap = await getDocs(collection(db, "assets"));
    setAssets(assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const loadTypesPage = async (pageNumber = 1, cursor = null) => {
    setLoading(true);

    try {
      const constraints = [orderBy("createdAt", "desc")];

      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      constraints.push(limit(PAGE_SIZE + 1));

      const snap = await getDocs(
        query(collection(db, "assetTypes"), ...constraints)
      );

      const docs = snap.docs;
      const visibleDocs = docs.slice(0, PAGE_SIZE);

      setItems(normalizeList(visibleDocs));
      setHasNextPage(docs.length > PAGE_SIZE);

      setPageCursors((prev) => ({
        ...prev,
        [pageNumber + 1]: visibleDocs[visibleDocs.length - 1] || null,
      }));

      setCurrentPage(pageNumber);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
    loadTypesPage(1, null);
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

  const remove = async (id) => {
    if (!canManage) return;

    if (confirm("هل تريد حذف نوع المعدة؟")) {
      await deleteDoc(doc(db, "assetTypes", id));
      await loadTypesPage(currentPage, pageCursors[currentPage] || null);
      await loadAssets();
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="أنواع المعدات">
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
          <FontAwesomeIcon icon={faMagnifyingGlass} className="text-slate-400" />

          <input
            className="w-full bg-transparent p-2 outline-none"
            placeholder="بحث باسم النوع أو الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && (
          <div className="page-card mb-4 p-4 text-center font-bold text-slate-500">
            جاري تحميل البيانات...
          </div>
        )}

        <div className="mb-3 text-sm font-bold text-slate-500">
          المعروض في هذه الصفحة: {filteredItems.length}
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
              {filteredItems.map((type) => (
                <tr
                  key={type.id}
                  className="clickable-row border-t border-slate-100"
                >
                  <td className="table-td font-black">{type.name}</td>

                  <td className="table-td">
                    <span className="badge bg-green-50 text-green-700">
                      {count(type)}
                    </span>
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
            disabled={currentPage === 1 || loading}
            onClick={() =>
              loadTypesPage(currentPage - 1, pageCursors[currentPage - 1] || null)
            }
            className="btn-secondary disabled:opacity-50"
          >
            السابق
          </button>

          <span className="font-bold text-slate-700">صفحة {currentPage}</span>

          <button
            disabled={!hasNextPage || loading}
            onClick={() =>
              loadTypesPage(currentPage + 1, pageCursors[currentPage + 1])
            }
            className="btn-secondary disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

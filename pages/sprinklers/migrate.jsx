import { useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import * as XLSX from "xlsx";

import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import useUserRole from "../../hooks/useUserRole";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizeMovement = (value) => {
  const text = String(value || "").trim();

  if (text.includes("ثلاث") || text.includes("3") || text.includes("تلات")) {
    return "ثلاث أرباع دائري";
  }

  if (text.includes("نصين") || text.includes("نصفين")) return "نصين";
  if (text.includes("نصف") || text.includes("نص")) return "نصف دائري";
  if (text.includes("دائري") || text.includes("دايري") || text.includes("داىري")) {
    return "دائري";
  }

  return text || "";
};

const toNumber = (value) => {
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
};

const getCell = (row, index) => String(row[index] || "").trim();

const buildKey = (name, farmName) =>
  `${normalizeText(name)}__${normalizeText(farmName)}`;

const parseExcelRows = (rows) => {
  const result = [];

  rows.forEach((row, index) => {
    const name = getCell(row, 0);

    const isSprinklerRow =
      name &&
      name.includes("رشاش") &&
      !name.includes("رشاشات ومكاين") &&
      !name.includes("اسم المعدة");

    if (!isSprinklerRow) return;

    const farmName = getCell(row, 5);
    const towersCount = toNumber(row[2]);
    const movementType = normalizeMovement(row[6]);

    if (!name || !farmName) return;

    result.push({
      name,
      farmName,
      towersCount,
      movementType,
      excelRowNumber: index + 1,
    });
  });

  return result;
};

export default function MigrateSprinklers() {
  const { canManage } = useUserRole();

  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState(null);

  const preview = useMemo(() => rows.slice(0, 20), [rows]);

  const handleFile = async (file) => {
    if (!file) return;

    setLoading(true);
    setRows([]);
    setResult(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      });

      setRows(parseExcelRows(sheetRows));
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء قراءة ملف الإكسل");
    } finally {
      setLoading(false);
    }
  };

  const updateOldSprinklers = async () => {
    if (!canManage || !rows.length) return;

    setUpdating(true);
    setResult(null);

    try {
      const snap = await getDocs(collection(db, "sprinklers"));

      const sprinklers = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const firebaseMap = new Map();

      sprinklers.forEach((item) => {
        const name = item.name || item.sprinklerName || "";
        const farmName = item.farmName || "";
        const key = buildKey(name, farmName);

        if (!firebaseMap.has(key)) {
          firebaseMap.set(key, item);
        }
      });

      let updated = 0;
      let notFound = 0;
      let skipped = 0;

      for (const row of rows) {
        const key = buildKey(row.name, row.farmName);
        const target = firebaseMap.get(key);

        if (!target) {
          notFound += 1;
          continue;
        }

        if (!row.towersCount && !row.movementType) {
          skipped += 1;
          continue;
        }

        await updateDoc(doc(db, "sprinklers", target.id), {
          towersCount: row.towersCount,
          movementType: row.movementType,
          updatedAt: serverTimestamp(),
        });

        updated += 1;
      }

      setResult({
        updated,
        notFound,
        skipped,
      });
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء تحديث بيانات الرشاشات");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="تحديث بيانات الرشاشات القديمة">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="page-card p-5">
            <h3 className="text-lg font-black text-slate-900">
              تحديث عدد الأبراج وحركة الرشاش
            </h3>

            <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
              هذه الصفحة لا تضيف رشاشات جديدة. هي فقط تبحث عن الرشاش الموجود
              وتحدث له عدد الأبراج وحركة الرشاش من ملف Excel.
            </p>

            <input
              type="file"
              accept=".xlsx,.xls"
              className="form-input mt-5"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {fileName && (
              <p className="mt-3 text-xs font-bold text-slate-500">
                الملف: {fileName}
              </p>
            )}

            <button
              type="button"
              disabled={!rows.length || loading || updating || !canManage}
              onClick={updateOldSprinklers}
              className="btn-primary mt-5 w-full disabled:opacity-50"
            >
              {updating ? "جاري تحديث البيانات..." : "تحديث الرشاشات القديمة"}
            </button>

            <Link href="/sprinklers" className="btn-secondary mt-3 w-full">
              رجوع للرشاشات
            </Link>

            {result && (
              <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm font-bold leading-7 text-green-700">
                <p>تم تحديث: {result.updated}</p>
                <p>غير موجود في النظام: {result.notFound}</p>
                <p>تم تخطيه لعدم وجود قيم: {result.skipped}</p>
              </div>
            )}
          </div>

          <div className="page-card overflow-x-auto p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-900">
                معاينة القيم المقروءة
              </h3>

              <span className="badge bg-blue-50 text-blue-700">
                {rows.length} صف
              </span>
            </div>

            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">الرشاش</th>
                  <th className="table-th">المزرعة</th>
                  <th className="table-th">عدد الأبراج</th>
                  <th className="table-th">حركة الرشاش</th>
                </tr>
              </thead>

              <tbody>
                {preview.map((item, index) => (
                  <tr key={`${item.name}-${index}`} className="border-t">
                    <td className="table-td font-bold">{item.name}</td>
                    <td className="table-td">{item.farmName || "-"}</td>
                    <td className="table-td">{item.towersCount || "-"}</td>
                    <td className="table-td">{item.movementType || "-"}</td>
                  </tr>
                ))}

                {!preview.length && (
                  <tr>
                    <td className="table-td text-center" colSpan="4">
                      اختر ملف Excel أولًا
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {rows.length > preview.length && (
              <p className="mt-4 text-sm font-bold text-slate-500">
                يتم عرض أول {preview.length} صف فقط من إجمالي {rows.length}
              </p>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";

const accountantNames = ["احمد", "أحمد", "بكري", "عبدالعزيز", "عبد العزيز"];

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();

const cleanPersonName = (name) =>
  normalizeText(name)
    .replace("م/", "")
    .replace("م /", "")
    .replace(/^م\s/, "")
    .replace("المهندس", "")
    .replace("مهندس", "")
    .trim();

const detectPersonType = (name) => {
  const cleanName = normalizeText(name);

  if (!cleanName) return "";

  if (
    cleanName.includes("م/") ||
    cleanName.includes("م /") ||
    cleanName.startsWith("م ") ||
    cleanName.includes("مهندس")
  ) {
    return "engineer";
  }

  const personName = cleanPersonName(cleanName);

  const isAccountant = accountantNames.some(
    (item) => normalizeText(item) === normalizeText(personName)
  );

  if (isAccountant) return "accountant";

  return "worker";
};

const splitPlate = (plate) => {
  const text = normalizeText(plate);

  const plateNumbers = text.match(/[0-9٠-٩]+/g)?.join(" ") || "";

  const plateLetters = text
    .replace(/[0-9٠-٩]/g, "")
    .replace(/[^\u0600-\u06FF\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    plateLetters,
    plateNumbers,
  };
};

const findPerson = (name, type, lists) => {
  const cleanName = cleanPersonName(name);

  if (!cleanName || !type) return null;

  const list =
    type === "worker"
      ? lists.workers
      : type === "engineer"
      ? lists.engineers
      : lists.accountants;

  return (
    list.find((item) => normalizeText(item.name) === normalizeText(cleanName)) ||
    null
  );
};

const findFarm = (farmName, farms) => {
  const cleanFarmName = normalizeText(farmName);

  if (!cleanFarmName) return null;

  return farms.find((farm) => normalizeText(farm.name) === cleanFarmName) || null;
};

const getPersonTypeLabel = (type) => {
  if (type === "worker") return "عامل";
  if (type === "engineer") return "مهندس";
  if (type === "accountant") return "محاسب";
  return "-";
};

export default function ImportVehiclesPage() {
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const validRows = useMemo(
    () => rows.filter((row) => row.name || row.plateLetters || row.plateNumbers),
    [rows]
  );

  const loadRelatedData = async () => {
    const [workersSnap, engineersSnap, accountantsSnap, farmsSnap] =
      await Promise.all([
        getDocs(collection(db, "workers")),
        getDocs(collection(db, "engineers")),
        getDocs(collection(db, "accountants")),
        getDocs(collection(db, "farms")),
      ]);

    return {
      workers: workersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      engineers: engineersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      accountants: accountantsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      farms: farmsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setMessage("جاري قراءة ملف Excel...");
      setRows([]);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      const headerIndex = data.findIndex((row) => {
        const values = row.map((value) => normalizeText(value));

        return (
          values.includes("اسم المعده") &&
          values.includes("نمر السياره") &&
          values.includes("مكان المعده") &&
          values.includes("اسم العامل")
        );
      });

      if (headerIndex === -1) {
        setMessage(
          "لم يتم العثور على جدول السيارات. تأكد أن الهيدر يحتوي على: اسم المعدة، نمر السيارة، مكان المعدة، اسم العامل"
        );
        return;
      }

      const headerRow = data[headerIndex].map((value) => normalizeText(value));

      const getIndex = (label) =>
        headerRow.findIndex((item) => item === normalizeText(label));

      const nameIndex = getIndex("اسم المعدة");
      const plateIndex = getIndex("نمر السيارة");
      const farmIndex = getIndex("مكان المعدة");
      const riderIndex = getIndex("اسم العامل");
      const nationalityIndex = getIndex("الجنسية");
      const phoneIndex = getIndex("رقم الجوال");
      const technicalStatusIndex = getIndex("الحالة الفنية");
      const serialIndex = getIndex("تسلسل");

      const bodyRows = data.slice(headerIndex + 1);

      const mappedRows = bodyRows
        .map((row) => {
          const name = normalizeText(row[nameIndex]);
          const plate = normalizeText(row[plateIndex]);
          const farmName = normalizeText(row[farmIndex]);
          const riderName = normalizeText(row[riderIndex]);
          const nationality = normalizeText(row[nationalityIndex]);
          const phone = normalizeText(row[phoneIndex]);
          const technicalStatus = normalizeText(row[technicalStatusIndex]);
          const serial = normalizeText(row[serialIndex]);

          const { plateLetters, plateNumbers } = splitPlate(plate);
          const assignedToType = detectPersonType(riderName);

          return {
            name,
            plateLetters,
            plateNumbers,
            farmName,
            assignedToName: cleanPersonName(riderName),
            assignedToType,
            nationality,
            phone,
            technicalStatus,
            serial,
            status: "صالح",
          };
        })
        .filter((row) => row.name || row.plateLetters || row.plateNumbers);

      setRows(mappedRows);
      setMessage(`تم قراءة ${mappedRows.length} سيارة من الشيت`);
    } catch (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء قراءة ملف Excel");
    }
  };

  const importVehicles = async () => {
    if (!validRows.length) return;

    setImporting(true);
    setMessage("");

    try {
      const lists = await loadRelatedData();

      let imported = 0;

      for (const row of validRows) {
        const person = findPerson(row.assignedToName, row.assignedToType, lists);
        const farm = findFarm(row.farmName, lists.farms);

        await addDoc(collection(db, "vehicles"), {
          name: row.name || "",

          plateLetters: row.plateLetters || "",
          plateNumbers: row.plateNumbers || "",

          farmId: farm?.id || "",
          farmName: row.farmName || "",

          placeType: farm?.id ? "farm" : "",
          placeId: farm?.id || "",
          placeName: row.farmName || "",

          assignedToType: row.assignedToType || "",
          assignedToId: person?.id || "",
          assignedToName: row.assignedToName || "",
          assignedToFound: Boolean(person?.id),

          nationality: row.nationality || "",
          phone: row.phone || "",
          technicalStatus: row.technicalStatus || "",
          serial: row.serial || "",

          status: "صالح",

          inWorkshop: false,
          workshopName: "",
          lastMaintenanceCost: 0,
          unpaidMaintenanceCost: 0,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        imported += 1;
      }

      setMessage(`تم استيراد ${imported} سيارة بنجاح`);
      setRows([]);
    } catch (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء استيراد السيارات");
    } finally {
      setImporting(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="استيراد السيارات من Excel">
        <div className="page-card p-4 sm:p-5">
          <h2 className="mb-2 text-xl font-black">استيراد بيانات السيارات</h2>

          <p className="mb-4 text-sm font-bold leading-7 text-slate-500">
            ارفع ملف Excel وسيتم قراءة السيارات وربط الراكب لو موجود في العمال
            أو المهندسين أو المحاسبين.
          </p>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="form-input"
          />

          {message && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-700">
              {message}
            </div>
          )}

          {validRows.length > 0 && (
            <>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-black">معاينة البيانات</h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    عدد السيارات الجاهزة للاستيراد: {validRows.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={importVehicles}
                  disabled={importing}
                  className="btn-primary w-full sm:w-auto"
                >
                  {importing ? "جاري الاستيراد..." : "استيراد السيارات"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:hidden">
                {validRows.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-black text-slate-900">
                          {row.name || "سيارة بدون اسم"}
                        </h4>

                        <p className="mt-1 text-xs font-bold text-slate-400">
                          تسلسل: {row.serial || index + 1}
                        </p>
                      </div>

                      <span className="badge bg-green-50 text-green-700">
                        صالح
                      </span>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <span className="font-bold text-slate-500">اللوحة</span>
                        <span className="font-black text-slate-800">
                          {row.plateLetters || "-"} /{" "}
                          {row.plateNumbers || "-"}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <span className="font-bold text-slate-500">المكان</span>
                        <span className="font-black text-slate-800">
                          {row.farmName || "-"}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <span className="font-bold text-slate-500">الراكب</span>
                        <span className="font-black text-slate-800">
                          {row.assignedToName || "بدون راكب"}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <span className="font-bold text-slate-500">النوع</span>
                        <span className="font-black text-slate-800">
                          {getPersonTypeLabel(row.assignedToType)}
                        </span>
                      </div>

                      {row.nationality && (
                        <div className="flex justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                          <span className="font-bold text-slate-500">
                            الجنسية
                          </span>
                          <span className="font-black text-slate-800">
                            {row.nationality}
                          </span>
                        </div>
                      )}

                      {row.phone && (
                        <div className="flex justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                          <span className="font-bold text-slate-500">
                            الجوال
                          </span>
                          <span className="font-black text-slate-800">
                            {row.phone}
                          </span>
                        </div>
                      )}

                      {row.technicalStatus && (
                        <div className="rounded-2xl bg-amber-50 p-3">
                          <span className="mb-1 block font-bold text-amber-700">
                            الحالة الفنية
                          </span>
                          <p className="font-bold text-amber-800">
                            {row.technicalStatus}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-th">السيارة</th>
                      <th className="table-th">اللوحة</th>
                      <th className="table-th">المكان</th>
                      <th className="table-th">الراكب</th>
                      <th className="table-th">النوع</th>
                      <th className="table-th">الجنسية</th>
                      <th className="table-th">الجوال</th>
                      <th className="table-th">الحالة الفنية</th>
                      <th className="table-th">الحالة</th>
                    </tr>
                  </thead>

                  <tbody>
                    {validRows.map((row, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="table-td font-bold">
                          {row.name || "-"}
                        </td>

                        <td className="table-td">
                          <span className="badge bg-slate-100 text-slate-700">
                            {row.plateLetters || "-"} /{" "}
                            {row.plateNumbers || "-"}
                          </span>
                        </td>

                        <td className="table-td">{row.farmName || "-"}</td>
                        <td className="table-td">
                          {row.assignedToName || "-"}
                        </td>
                        <td className="table-td">
                          {getPersonTypeLabel(row.assignedToType)}
                        </td>
                        <td className="table-td">{row.nationality || "-"}</td>
                        <td className="table-td">{row.phone || "-"}</td>
                        <td className="table-td">
                          {row.technicalStatus || "-"}
                        </td>

                        <td className="table-td">
                          <span className="badge bg-green-50 text-green-700">
                            صالح
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

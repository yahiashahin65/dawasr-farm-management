import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import {
  getCachedCollection,
  setCachedCollection,
  subscribeCachedCollection,
} from "../../lib/realtimeCache";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";

import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import AppLoader from "../../components/AppLoader";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPen,
  faTrash,
  faMagnifyingGlass,
  faBroom,
  faPlus,
  faFilePdf,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

import useUserRole from "../../hooks/useUserRole";

const PAGE_SIZE = 10;

const removeFromHeapsCache = (heapId) => {
  const cached = getCachedCollection("cache:heaps");

  setCachedCollection(
    "cache:heaps",
    cached.filter((item) => item.id !== heapId)
  );
};

const normalizeText = (value, fallback = "غير محدد") => {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
};

const getValidBricksCount = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "غير محدد"
  ) {
    return null;
  }

  const normalizedValue =
    typeof value === "string"
      ? value.replace(/,/g, "").replace(/[^\d.-]/g, "")
      : value;

  const number = Number(normalizedValue);

  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("ar-EG");
};

const groupHeapsForReport = (heaps) => {
  const farmsMap = new Map();

  heaps.forEach((heap) => {
    const farmName = normalizeText(heap.farmName, "مزرعة غير محددة");
    const farmKey = heap.farmId || farmName;

    const sprinklerName = normalizeText(
      heap.sprinklerName,
      "رشاش غير محدد"
    );

    const sprinklerKey = heap.sprinklerId || sprinklerName;

    if (!farmsMap.has(farmKey)) {
      farmsMap.set(farmKey, {
        farmName,
        sprinklers: new Map(),
      });
    }

    const farm = farmsMap.get(farmKey);

    if (!farm.sprinklers.has(sprinklerKey)) {
      farm.sprinklers.set(sprinklerKey, {
        sprinklerName,
        heaps: [],
      });
    }

    farm.sprinklers.get(sprinklerKey).heaps.push(heap);
  });

  return Array.from(farmsMap.values())
    .map((farm) => ({
      ...farm,
      sprinklers: Array.from(farm.sprinklers.values()).sort((a, b) =>
        a.sprinklerName.localeCompare(b.sprinklerName, "ar", {
          numeric: true,
        })
      ),
    }))
    .sort((a, b) =>
      a.farmName.localeCompare(b.farmName, "ar", {
        numeric: true,
      })
    );
};

export default function HeapsPage() {
  const { canManage } = useUserRole();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeCachedCollection({
      db,
      collectionName: "heaps",
      cacheKey: "cache:heaps",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الأكوام لحظيًا");
      },
    });

    return () => unsubscribe?.();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((item) => {
      const haystack = `
        ${item.pileName || ""}
        ${item.farmName || ""}
        ${item.sprinklerName || ""}
        ${item.cropType || ""}
        ${item.bricksCount || ""}
        ${item.notes || ""}
      `.toLowerCase();

      return haystack.includes(keyword);
    });
  }, [items, search]);

  const totalBricks = useMemo(() => {
    return filteredItems.reduce((sum, item) => {
      const bricksCount = getValidBricksCount(item.bricksCount);

      return sum + (bricksCount ?? 0);
    }, 0);
  }, [filteredItems]);

  const totalFarms = useMemo(() => {
    return new Set(
      filteredItems
        .map((item) => item.farmId || item.farmName)
        .filter(Boolean)
    ).size;
  }, [filteredItems]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filteredItems, currentPage]);

  const clearFilters = () => {
    setSearch("");
    setCurrentPage(1);
  };

  const exportAllHeapsToPdf = async () => {
    if (isExportingPdf) return;

    if (!items.length) {
      alert("لا توجد أكوام لتصديرها");
      return;
    }

    setIsExportingPdf(true);

    let reportElement = null;

    try {
      const [{ default: jsPDF }, { default: html2canvas }] =
        await Promise.all([import("jspdf"), import("html2canvas")]);

      const groupedFarms = groupHeapsForReport(items);

      const totalReportBricks = items.reduce((sum, item) => {
        const bricksCount = getValidBricksCount(item.bricksCount);

        return sum + (bricksCount ?? 0);
      }, 0);

      const undefinedBricksCount = items.filter(
        (item) => getValidBricksCount(item.bricksCount) === null
      ).length;

      const totalSprinklers = groupedFarms.reduce(
        (sum, farm) => sum + farm.sprinklers.length,
        0
      );

      const generatedAt = new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date());

      reportElement = document.createElement("div");

      reportElement.setAttribute("dir", "rtl");

      reportElement.style.cssText = `
        position: fixed;
        top: 0;
        right: -100000px;
        width: 1120px;
        min-height: 100vh;
        padding: 46px;
        box-sizing: border-box;
        direction: rtl;
        background: #ffffff;
        color: #0f172a;
        font-family: Tahoma, Arial, sans-serif;
        line-height: 1.7;
      `;

      const farmsHtml = groupedFarms
        .map((farm, farmIndex) => {
          const farmHeaps = farm.sprinklers.flatMap(
            (sprinkler) => sprinkler.heaps
          );

          const farmBricks = farmHeaps.reduce((sum, heap) => {
            const bricksCount = getValidBricksCount(heap.bricksCount);

            return sum + (bricksCount ?? 0);
          }, 0);

          const farmUndefinedBricks = farmHeaps.filter(
            (heap) => getValidBricksCount(heap.bricksCount) === null
          ).length;

          const sprinklersHtml = farm.sprinklers
            .map((sprinkler) => {
              const sprinklerBricks = sprinkler.heaps.reduce(
                (sum, heap) => {
                  const bricksCount = getValidBricksCount(heap.bricksCount);

                  return sum + (bricksCount ?? 0);
                },
                0
              );

              const sprinklerUndefinedBricks = sprinkler.heaps.filter(
                (heap) =>
                  getValidBricksCount(heap.bricksCount) === null
              ).length;

              const rowsHtml = sprinkler.heaps
                .slice()
                .sort((a, b) =>
                  normalizeText(a.pileName, "").localeCompare(
                    normalizeText(b.pileName, ""),
                    "ar",
                    {
                      numeric: true,
                    }
                  )
                )
                .map((heap, heapIndex) => {
                  const bricksCount = getValidBricksCount(
                    heap.bricksCount
                  );

                  return `
                    <tr>
                      <td>${heapIndex + 1}</td>

                      <td style="font-weight: 700;">
                        ${normalizeText(heap.pileName, "-")}
                      </td>

                      <td>
                        ${normalizeText(heap.cropType, "غير معلوم")}
                      </td>

                      <td style="font-weight: 700;">
                        ${
                          bricksCount === null
                            ? "غير محدد"
                            : formatNumber(bricksCount)
                        }
                      </td>

                      <td>
                        ${normalizeText(heap.notes, "-")}
                      </td>
                    </tr>
                  `;
                })
                .join("");

              return `
                <section
                  style="
                    margin-top: 22px;
                    border: 1px solid #dbe7df;
                    border-radius: 14px;
                    overflow: hidden;
                    break-inside: avoid;
                  "
                >
                  <div
                    style="
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      gap: 15px;
                      padding: 15px 18px;
                      background: #eaf8ef;
                      border-bottom: 1px solid #d7eadc;
                    "
                  >
                    <div>
                      <div
                        style="
                          color: #15803d;
                          font-size: 13px;
                          font-weight: 700;
                        "
                      >
                        الرشاش
                      </div>

                      <div
                        style="
                          margin-top: 3px;
                          font-size: 21px;
                          font-weight: 900;
                        "
                      >
                        ${sprinkler.sprinklerName}
                      </div>
                    </div>

                    <div
                      style="
                        min-width: 115px;
                        padding: 8px 12px;
                        border-radius: 10px;
                        background: #ffffff;
                        text-align: center;
                      "
                    >
                      <div
                        style="
                          color: #64748b;
                          font-size: 12px;
                          font-weight: 700;
                        "
                      >
                        عدد الأكوام
                      </div>

                      <div
                        style="
                          margin-top: 2px;
                          color: #166534;
                          font-size: 20px;
                          font-weight: 900;
                        "
                      >
                        ${sprinkler.heaps.length}
                      </div>
                    </div>
                  </div>

                  <table
                    style="
                      width: 100%;
                      border-collapse: collapse;
                      table-layout: fixed;
                    "
                  >
                    <thead>
                      <tr style="background: #f8fafc;">
                        <th style="width: 7%;">م</th>
                        <th style="width: 24%;">اسم الكوم</th>
                        <th style="width: 18%;">النوع</th>
                        <th style="width: 18%;">عدد اللبن</th>
                        <th style="width: 33%;">الملاحظات</th>
                      </tr>
                    </thead>

                    <tbody>
                      ${rowsHtml}
                    </tbody>
                  </table>

                  <div
                    style="
                      display: grid;
                      grid-template-columns: repeat(3, 1fr);
                      gap: 10px;
                      padding: 14px;
                      background: #f8fafc;
                      border-top: 1px solid #e2e8f0;
                    "
                  >
                    <div style="padding: 10px; background: #fff; border-radius: 9px;">
                      <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                        إجمالي أكوام الرشاش
                      </div>

                      <div style="font-size: 18px; font-weight: 900;">
                        ${sprinkler.heaps.length}
                      </div>
                    </div>

                    <div style="padding: 10px; background: #fff; border-radius: 9px;">
                      <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                        إجمالي اللبن
                      </div>

                      <div style="font-size: 18px; font-weight: 900;">
                        ${formatNumber(sprinklerBricks)}
                      </div>
                    </div>

                    <div style="padding: 10px; background: #fff; border-radius: 9px;">
                      <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                        أكوام بدون عدد محدد
                      </div>

                      <div style="font-size: 18px; font-weight: 900;">
                        ${sprinklerUndefinedBricks}
                      </div>
                    </div>
                  </div>
                </section>
              `;
            })
            .join("");

          return `
            <section
              style="
                margin-top: ${farmIndex === 0 ? "24px" : "42px"};
                break-before: ${farmIndex === 0 ? "auto" : "page"};
              "
            >
              <div
                style="
                  padding: 18px 20px;
                  color: #ffffff;
                  background: #15803d;
                  border-radius: 14px;
                "
              >
                <div
                  style="
                    font-size: 13px;
                    font-weight: 700;
                    opacity: 0.9;
                  "
                >
                  المزرعة
                </div>

                <div
                  style="
                    margin-top: 4px;
                    font-size: 27px;
                    font-weight: 900;
                  "
                >
                  ${farm.farmName}
                </div>
              </div>

              ${sprinklersHtml}

              <div
                style="
                  margin-top: 20px;
                  padding: 18px;
                  border: 2px solid #bbf7d0;
                  border-radius: 14px;
                  background: #f0fdf4;
                  break-inside: avoid;
                "
              >
                <div
                  style="
                    margin-bottom: 12px;
                    color: #166534;
                    font-size: 18px;
                    font-weight: 900;
                  "
                >
                  ملخص مزرعة ${farm.farmName}
                </div>

                <div
                  style="
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                  "
                >
                  <div style="padding: 12px; background: #fff; border-radius: 10px;">
                    <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                      عدد الرشاشات
                    </div>

                    <div style="font-size: 20px; font-weight: 900;">
                      ${farm.sprinklers.length}
                    </div>
                  </div>

                  <div style="padding: 12px; background: #fff; border-radius: 10px;">
                    <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                      إجمالي الأكوام
                    </div>

                    <div style="font-size: 20px; font-weight: 900;">
                      ${farmHeaps.length}
                    </div>
                  </div>

                  <div style="padding: 12px; background: #fff; border-radius: 10px;">
                    <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                      إجمالي اللبن
                    </div>

                    <div style="font-size: 20px; font-weight: 900;">
                      ${formatNumber(farmBricks)}
                    </div>
                  </div>

                  <div style="padding: 12px; background: #fff; border-radius: 10px;">
                    <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                      بدون عدد محدد
                    </div>

                    <div style="font-size: 20px; font-weight: 900;">
                      ${farmUndefinedBricks}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          `;
        })
        .join("");

      reportElement.innerHTML = `
        <header
          style="
            padding-bottom: 24px;
            border-bottom: 3px solid #15803d;
          "
        >
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 25px;
            "
          >
            <div>
              <div
                style="
                  color: #15803d;
                  font-size: 14px;
                  font-weight: 800;
                "
              >
                إدارة المزرعة
              </div>

              <h1
                style="
                  margin: 4px 0 0;
                  font-size: 34px;
                  font-weight: 900;
                "
              >
                تقرير توزيع الأكوام على الرشاشات
              </h1>

              <p
                style="
                  margin: 7px 0 0;
                  color: #64748b;
                  font-size: 14px;
                  font-weight: 700;
                "
              >
                جميع الأكوام المسجلة مجمعة حسب المزرعة ثم الرشاش
              </p>
            </div>

            <div
              style="
                padding: 12px 15px;
                border: 1px solid #dbe7df;
                border-radius: 12px;
                background: #f8fafc;
                text-align: right;
              "
            >
              <div
                style="
                  color: #64748b;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
                تاريخ إصدار التقرير
              </div>

              <div
                style="
                  margin-top: 4px;
                  font-size: 14px;
                  font-weight: 900;
                "
              >
                ${generatedAt}
              </div>
            </div>
          </div>
        </header>

        ${farmsHtml}

        <section
          style="
            margin-top: 42px;
            padding: 24px;
            border-radius: 16px;
            color: #ffffff;
            background: #14532d;
            break-inside: avoid;
          "
        >
          <div
            style="
              margin-bottom: 16px;
              font-size: 24px;
              font-weight: 900;
            "
          >
            الملخص العام للتقرير
          </div>

          <div
            style="
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
            "
          >
            <div style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,.12);">
              <div style="font-size: 12px; font-weight: 700; opacity: .85;">
                إجمالي المزارع
              </div>

              <div style="margin-top: 4px; font-size: 23px; font-weight: 900;">
                ${groupedFarms.length}
              </div>
            </div>

            <div style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,.12);">
              <div style="font-size: 12px; font-weight: 700; opacity: .85;">
                إجمالي الرشاشات
              </div>

              <div style="margin-top: 4px; font-size: 23px; font-weight: 900;">
                ${totalSprinklers}
              </div>
            </div>

            <div style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,.12);">
              <div style="font-size: 12px; font-weight: 700; opacity: .85;">
                إجمالي الأكوام
              </div>

              <div style="margin-top: 4px; font-size: 23px; font-weight: 900;">
                ${items.length}
              </div>
            </div>

            <div style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,.12);">
              <div style="font-size: 12px; font-weight: 700; opacity: .85;">
                إجمالي اللبن
              </div>

              <div style="margin-top: 4px; font-size: 23px; font-weight: 900;">
                ${formatNumber(totalReportBricks)}
              </div>
            </div>

            <div style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,.12);">
              <div style="font-size: 12px; font-weight: 700; opacity: .85;">
                بدون عدد محدد
              </div>

              <div style="margin-top: 4px; font-size: 23px; font-weight: 900;">
                ${undefinedBricksCount}
              </div>
            </div>
          </div>
        </section>

        <footer
          style="
            margin-top: 24px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            text-align: center;
          "
        >
          تم إنشاء هذا التقرير تلقائيًا من نظام إدارة المزرعة
        </footer>
      `;

      reportElement.querySelectorAll("th, td").forEach((cell) => {
        cell.style.padding = "11px 10px";
        cell.style.border = "1px solid #e2e8f0";
        cell.style.textAlign = "right";
        cell.style.fontSize = "13px";
        cell.style.wordBreak = "break-word";
      });

      reportElement.querySelectorAll("th").forEach((cell) => {
        cell.style.fontWeight = "900";
        cell.style.color = "#334155";
      });

      document.body.appendChild(reportElement);

      await document.fonts?.ready;

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 1220,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      const imageWidth = printableWidth;
      const fullImageHeight = (canvas.height * imageWidth) / canvas.width;

      const pageCanvasHeight = Math.floor(
        (printableHeight * canvas.width) / imageWidth
      );

      let sourceY = 0;
      let pageNumber = 0;

      while (sourceY < canvas.height) {
        const currentSliceHeight = Math.min(
          pageCanvasHeight,
          canvas.height - sourceY
        );

        const pageCanvas = document.createElement("canvas");

        pageCanvas.width = canvas.width;
        pageCanvas.height = currentSliceHeight;

        const context = pageCanvas.getContext("2d");

        if (!context) {
          throw new Error("تعذر تجهيز صفحات التقرير");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        context.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          currentSliceHeight,
          0,
          0,
          canvas.width,
          currentSliceHeight
        );

        const pageImageData = pageCanvas.toDataURL("image/jpeg", 0.95);

        const pageImageHeight =
          (currentSliceHeight * imageWidth) / canvas.width;

        if (pageNumber > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          pageImageData,
          "JPEG",
          margin,
          margin,
          imageWidth,
          pageImageHeight,
          undefined,
          "FAST"
        );

        pdf.setFontSize(9);
        pdf.setTextColor(100);

        pdf.text(
          `صفحة ${pageNumber + 1}`,
          pageWidth / 2,
          pageHeight - 3,
          {
            align: "center",
          }
        );

        sourceY += currentSliceHeight;
        pageNumber += 1;
      }

      const date = new Date().toISOString().slice(0, 10);

      pdf.save(`heaps-report-${date}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);

      alert("حدث خطأ أثناء إنشاء تقرير PDF");
    } finally {
      reportElement?.remove();
      setIsExportingPdf(false);
    }
  };

  const remove = async (id) => {
    if (!canManage) return;

    if (!confirm("هل تريد حذف الكوم؟")) return;

    const target = items.find((item) => item.id === id);

    removeFromHeapsCache(id);

    if (paginatedItems.length === 1 && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "heaps",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف كوم",
          name: target?.pileName || "",
        },
      });

      alert("تم حذف الكوم محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "heaps", id));
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "heaps",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف كوم",
          name: target?.pileName || "",
        },
      });

      alert(
        "تعذر الاتصال، تم حفظ عملية الحذف وسيتم تنفيذها عند عودة الاتصال"
      );
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="الأكوام">
        {initialLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الأكوام..."
            subtitle="يتم تجهيز بيانات الأكوام"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي الأكوام
                </p>

                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {filteredItems.length}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  إجمالي اللبن
                </p>

                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {formatNumber(totalBricks)}
                </h3>
              </div>

              <div className="page-card p-5">
                <p className="text-sm font-bold text-slate-500">
                  عدد المزارع
                </p>

                <h3 className="mt-2 text-4xl font-black text-slate-900">
                  {totalFarms}
                </h3>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="page-card flex flex-1 items-center gap-2 p-3">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-slate-400"
                />

                <input
                  type="text"
                  placeholder="بحث باسم الكوم أو المزرعة أو الرشاش أو النوع..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-transparent p-2 outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-secondary"
                >
                  <FontAwesomeIcon icon={faBroom} />
                  مسح البحث
                </button>

                <button
                  type="button"
                  onClick={exportAllHeapsToPdf}
                  disabled={isExportingPdf || items.length === 0}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FontAwesomeIcon
                    icon={isExportingPdf ? faSpinner : faFilePdf}
                    className={isExportingPdf ? "animate-spin" : ""}
                  />

                  {isExportingPdf
                    ? "جاري إنشاء التقرير..."
                    : "تصدير كل الأكوام PDF"}
                </button>

                {canManage && (
                  <Link href="/heaps/add" className="btn-primary">
                    <FontAwesomeIcon icon={faPlus} />
                    إضافة كوم
                  </Link>
                )}
              </div>
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filteredItems.length}
            </div>

            <div className="page-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">اسم الكوم</th>
                    <th className="table-th">النوع</th>
                    <th className="table-th">المزرعة</th>
                    <th className="table-th">الرشاش</th>
                    <th className="table-th">عدد اللبن</th>
                    <th className="table-th">الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="table-td text-center">
                        لا توجد بيانات
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100"
                      >
                        <td className="table-td font-bold">
                          <div className="flex flex-col gap-1">
                            <span>{item.pileName || "-"}</span>

                            {item.syncStatus === "pending" && (
                              <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                                قيد المزامنة
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="table-td">
                          <span className="badge bg-green-50 text-green-700">
                            {item.cropType || "غير معلوم"}
                          </span>
                        </td>

                        <td className="table-td">
                          {item.farmName || "-"}
                        </td>

                        <td className="table-td">
                          {item.sprinklerName || "-"}
                        </td>

                        <td className="table-td">
                          {getValidBricksCount(item.bricksCount) === null
                            ? "غير محدد"
                            : formatNumber(
                                getValidBricksCount(item.bricksCount)
                              )}
                        </td>

                        <td className="table-td">
                          <div className="flex gap-2">
                            <Link
                              href={`/heaps/${item.id}`}
                              className="btn-secondary !p-2"
                              title="عرض"
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </Link>

                            {canManage && (
                              <>
                                <Link
                                  href={`/heaps/edit/${item.id}`}
                                  className="btn-secondary !p-2"
                                  title="تعديل"
                                >
                                  <FontAwesomeIcon icon={faPen} />
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => remove(item.id)}
                                  className="btn-danger !p-2"
                                  title="حذف"
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredItems.length > PAGE_SIZE && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className="btn-secondary disabled:opacity-50"
                >
                  السابق
                </button>

                <span className="font-bold text-slate-700">
                  صفحة {currentPage} من {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(prev + 1, totalPages)
                    )
                  }
                  className="btn-secondary disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

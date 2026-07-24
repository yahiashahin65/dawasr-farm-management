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

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

const getBricksTotalsByCropType = (heaps) => {
  const totalsMap = new Map();

  heaps.forEach((heap) => {
    const bricksCount = getValidBricksCount(heap.bricksCount);

    if (bricksCount === null) return;

    const cropType = normalizeText(heap.cropType, "غير معلوم");

    totalsMap.set(
      cropType,
      (totalsMap.get(cropType) || 0) + bricksCount
    );
  });

  return Array.from(totalsMap.entries())
    .map(([cropType, total]) => ({
      cropType,
      total,
    }))
    .sort((a, b) =>
      a.cropType.localeCompare(b.cropType, "ar", {
        numeric: true,
      })
    );
};

const renderCropTotalsHtml = (
  totals,
  {
    dark = false,
    emptyText = "لا توجد أعداد لبن مسجلة",
  } = {}
) => {
  if (!totals.length) {
    return `
      <div
        style="
          padding: 12px;
          border-radius: 10px;
          background: ${dark ? "rgba(255,255,255,.12)" : "#ffffff"};
          color: ${dark ? "#ffffff" : "#64748b"};
          font-size: 13px;
          font-weight: 800;
          text-align: center;
        "
      >
        ${emptyText}
      </div>
    `;
  }

  const columns = Math.min(totals.length, 3);

  return `
    <div
      style="
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        gap: 10px;
      "
    >
      ${totals
        .map(
          ({ cropType, total }) => `
            <div
              style="
                padding: 11px 12px;
                border-radius: 10px;
                background: ${
                  dark ? "rgba(255,255,255,.12)" : "#ffffff"
                };
              "
            >
              <div
                style="
                  color: ${
                    dark ? "rgba(255,255,255,.82)" : "#64748b"
                  };
                  font-size: 12px;
                  font-weight: 800;
                "
              >
                إجمالي ${escapeHtml(cropType)}
              </div>

              <div
                style="
                  margin-top: 3px;
                  color: ${dark ? "#ffffff" : "#0f172a"};
                  font-size: 19px;
                  font-weight: 900;
                "
              >
                ${formatNumber(total)}
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
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

    let reportContainer = null;

    try {
      const [{ default: jsPDF }, { default: html2canvas }] =
        await Promise.all([import("jspdf"), import("html2canvas")]);

      const groupedFarms = groupHeapsForReport(items);

      const undefinedBricksCount = items.filter(
        (item) => getValidBricksCount(item.bricksCount) === null
      ).length;

      const totalSprinklers = groupedFarms.reduce(
        (sum, farm) => sum + farm.sprinklers.length,
        0
      );

      const reportCropTotals = getBricksTotalsByCropType(items);

      const generatedAt = new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date());

      reportContainer = document.createElement("div");
      reportContainer.setAttribute("dir", "rtl");

      reportContainer.style.cssText = `
        position: fixed;
        top: 0;
        right: -100000px;
        width: 1120px;
        box-sizing: border-box;
        direction: rtl;
        background: #ffffff;
        color: #0f172a;
        font-family: Tahoma, Arial, sans-serif;
        line-height: 1.7;
      `;

      const createBlock = (html, extraStyles = "") => {
        const block = document.createElement("section");

        block.className = "pdf-report-block";

        block.style.cssText = `
          width: 1120px;
          padding: 0 46px;
          box-sizing: border-box;
          background: #ffffff;
          ${extraStyles}
        `;

        block.innerHTML = html;

        return block;
      };

      reportContainer.appendChild(
        createBlock(`
          <div
            style="
              padding-top: 46px;
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
                  ${escapeHtml(generatedAt)}
                </div>
              </div>
            </div>
          </div>
        `)
      );

      groupedFarms.forEach((farm) => {
        const farmHeaps = farm.sprinklers.flatMap(
          (sprinkler) => sprinkler.heaps
        );

        const farmUndefinedBricks = farmHeaps.filter(
          (heap) => getValidBricksCount(heap.bricksCount) === null
        ).length;

        const farmCropTotals = getBricksTotalsByCropType(farmHeaps);

        reportContainer.appendChild(
          createBlock(`
            <div
              style="
                margin-top: 30px;
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
                ${escapeHtml(farm.farmName)}
              </div>
            </div>
          `)
        );

        farm.sprinklers.forEach((sprinkler) => {
          const sprinklerUndefinedBricks = sprinkler.heaps.filter(
            (heap) => getValidBricksCount(heap.bricksCount) === null
          ).length;

          const sprinklerCropTotals =
            getBricksTotalsByCropType(sprinkler.heaps);

          const sortedHeaps = sprinkler.heaps
            .slice()
            .sort((a, b) =>
              normalizeText(a.pileName, "").localeCompare(
                normalizeText(b.pileName, ""),
                "ar",
                {
                  numeric: true,
                }
              )
            );

          const rowsHtml = sortedHeaps
            .map((heap, heapIndex) => {
              const bricksCount = getValidBricksCount(
                heap.bricksCount
              );

              return `
                <tr>
                  <td>${heapIndex + 1}</td>

                  <td style="font-weight: 800;">
                    ${escapeHtml(normalizeText(heap.pileName, "-"))}
                  </td>

                  <td>
                    ${escapeHtml(
                      normalizeText(heap.cropType, "غير معلوم")
                    )}
                  </td>

                  <td style="font-weight: 800;">
                    ${
                      bricksCount === null
                        ? "غير محدد"
                        : formatNumber(bricksCount)
                    }
                  </td>
                </tr>
              `;
            })
            .join("");

          reportContainer.appendChild(
            createBlock(`
              <div
                style="
                  margin-top: 20px;
                  border: 1px solid #dbe7df;
                  border-radius: 14px;
                  overflow: hidden;
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
                      ${escapeHtml(sprinkler.sprinklerName)}
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
                      <th style="width: 10%;">م</th>
                      <th style="width: 35%;">اسم الكوم</th>
                      <th style="width: 25%;">النوع</th>
                      <th style="width: 30%;">عدد اللبن</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>

                <div
                  style="
                    padding: 14px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                  "
                >
                  <div
                    style="
                      display: grid;
                      grid-template-columns: ${
                        sprinklerUndefinedBricks > 0
                          ? "repeat(2, 1fr)"
                          : "1fr"
                      };
                      gap: 10px;
                      margin-bottom: 10px;
                    "
                  >
                    <div
                      style="
                        padding: 10px;
                        background: #ffffff;
                        border-radius: 9px;
                      "
                    >
                      <div
                        style="
                          color: #64748b;
                          font-size: 12px;
                          font-weight: 700;
                        "
                      >
                        عدد الأكوام في الرشاش
                      </div>

                      <div
                        style="
                          font-size: 18px;
                          font-weight: 900;
                        "
                      >
                        ${sprinkler.heaps.length}
                      </div>
                    </div>

                    ${
                      sprinklerUndefinedBricks > 0
                        ? `
                          <div
                            style="
                              padding: 10px;
                              background: #ffffff;
                              border-radius: 9px;
                            "
                          >
                            <div
                              style="
                                color: #64748b;
                                font-size: 12px;
                                font-weight: 700;
                              "
                            >
                              أكوام بدون عدد لبن محدد
                            </div>

                            <div
                              style="
                                font-size: 18px;
                                font-weight: 900;
                              "
                            >
                              ${sprinklerUndefinedBricks}
                            </div>
                          </div>
                        `
                        : ""
                    }
                  </div>

                  <div
                    style="
                      margin-bottom: 8px;
                      color: #166534;
                      font-size: 14px;
                      font-weight: 900;
                    "
                  >
                    إجماليات اللبن حسب النوع
                  </div>

                  ${renderCropTotalsHtml(sprinklerCropTotals)}
                </div>
              </div>
            `)
          );
        });

        reportContainer.appendChild(
          createBlock(`
            <div
              style="
                margin-top: 20px;
                padding: 18px;
                border: 2px solid #bbf7d0;
                border-radius: 14px;
                background: #f0fdf4;
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
                ملخص مزرعة ${escapeHtml(farm.farmName)}
              </div>

              <div
                style="
                  display: grid;
                  grid-template-columns: ${
                    farmUndefinedBricks > 0
                      ? "repeat(3, 1fr)"
                      : "repeat(2, 1fr)"
                  };
                  gap: 10px;
                  margin-bottom: 12px;
                "
              >
                <div
                  style="
                    padding: 12px;
                    background: #ffffff;
                    border-radius: 10px;
                  "
                >
                  <div
                    style="
                      color: #64748b;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                    عدد الرشاشات المذكورة
                  </div>

                  <div
                    style="
                      font-size: 20px;
                      font-weight: 900;
                    "
                  >
                    ${farm.sprinklers.length}
                  </div>
                </div>

                <div
                  style="
                    padding: 12px;
                    background: #ffffff;
                    border-radius: 10px;
                  "
                >
                  <div
                    style="
                      color: #64748b;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                    إجمالي الأكوام المذكورة في المزرعة
                  </div>

                  <div
                    style="
                      font-size: 20px;
                      font-weight: 900;
                    "
                  >
                    ${farmHeaps.length}
                  </div>
                </div>

                ${
                  farmUndefinedBricks > 0
                    ? `
                      <div
                        style="
                          padding: 12px;
                          background: #ffffff;
                          border-radius: 10px;
                        "
                      >
                        <div
                          style="
                            color: #64748b;
                            font-size: 12px;
                            font-weight: 700;
                          "
                        >
                          أكوام بدون عدد لبن محدد
                        </div>

                        <div
                          style="
                            font-size: 20px;
                            font-weight: 900;
                          "
                        >
                          ${farmUndefinedBricks}
                        </div>
                      </div>
                    `
                    : ""
                }
              </div>

              <div
                style="
                  margin-bottom: 8px;
                  color: #166534;
                  font-size: 14px;
                  font-weight: 900;
                "
              >
                إجماليات اللبن في المزرعة حسب النوع
              </div>

              ${renderCropTotalsHtml(farmCropTotals)}
            </div>
          `)
        );
      });

      reportContainer.appendChild(
        createBlock(`
          <div
            style="
              margin-top: 34px;
              margin-bottom: 46px;
              padding: 24px;
              border-radius: 16px;
              color: #ffffff;
              background: #14532d;
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
                grid-template-columns: ${
                  undefinedBricksCount > 0
                    ? "repeat(4, 1fr)"
                    : "repeat(3, 1fr)"
                };
                gap: 10px;
                margin-bottom: 14px;
              "
            >
              <div
                style="
                  padding: 14px;
                  border-radius: 10px;
                  background: rgba(255,255,255,.12);
                "
              >
                <div
                  style="
                    font-size: 12px;
                    font-weight: 700;
                    opacity: .85;
                  "
                >
                  إجمالي المزارع
                </div>

                <div
                  style="
                    margin-top: 4px;
                    font-size: 23px;
                    font-weight: 900;
                  "
                >
                  ${groupedFarms.length}
                </div>
              </div>

              <div
                style="
                  padding: 14px;
                  border-radius: 10px;
                  background: rgba(255,255,255,.12);
                "
              >
                <div
                  style="
                    font-size: 12px;
                    font-weight: 700;
                    opacity: .85;
                  "
                >
                  إجمالي الرشاشات المذكورة
                </div>

                <div
                  style="
                    margin-top: 4px;
                    font-size: 23px;
                    font-weight: 900;
                  "
                >
                  ${totalSprinklers}
                </div>
              </div>

              <div
                style="
                  padding: 14px;
                  border-radius: 10px;
                  background: rgba(255,255,255,.12);
                "
              >
                <div
                  style="
                    font-size: 12px;
                    font-weight: 700;
                    opacity: .85;
                  "
                >
                  إجمالي الأكوام المذكورة
                </div>

                <div
                  style="
                    margin-top: 4px;
                    font-size: 23px;
                    font-weight: 900;
                  "
                >
                  ${items.length}
                </div>
              </div>

              ${
                undefinedBricksCount > 0
                  ? `
                    <div
                      style="
                        padding: 14px;
                        border-radius: 10px;
                        background: rgba(255,255,255,.12);
                      "
                    >
                      <div
                        style="
                          font-size: 12px;
                          font-weight: 700;
                          opacity: .85;
                        "
                      >
                        أكوام بدون عدد لبن محدد
                      </div>

                      <div
                        style="
                          margin-top: 4px;
                          font-size: 23px;
                          font-weight: 900;
                        "
                      >
                        ${undefinedBricksCount}
                      </div>
                    </div>
                  `
                  : ""
              }
            </div>

            <div
              style="
                margin-bottom: 8px;
                font-size: 14px;
                font-weight: 900;
              "
            >
              إجماليات اللبن العامة حسب النوع
            </div>

            ${renderCropTotalsHtml(reportCropTotals, {
              dark: true,
            })}

            <div
              style="
                margin-top: 18px;
                padding-top: 14px;
                border-top: 1px solid rgba(255,255,255,.2);
                color: rgba(255,255,255,.8);
                font-size: 12px;
                font-weight: 700;
                text-align: center;
              "
            >
              تم إنشاء هذا التقرير تلقائيًا من نظام إدارة المزرعة
            </div>
          </div>
        `)
      );

      reportContainer.querySelectorAll("th, td").forEach((cell) => {
        cell.style.padding = "11px 10px";
        cell.style.border = "1px solid #e2e8f0";
        cell.style.textAlign = "right";
        cell.style.fontSize = "13px";
        cell.style.wordBreak = "break-word";
      });

      reportContainer.querySelectorAll("th").forEach((cell) => {
        cell.style.fontWeight = "900";
        cell.style.color = "#334155";
      });

      document.body.appendChild(reportContainer);

      await document.fonts?.ready;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const marginX = 8;
      const marginTop = 8;
      const marginBottom = 12;
      const blocksGap = 4;

      const printableWidth = pageWidth - marginX * 2;
      const printableHeight =
        pageHeight - marginTop - marginBottom;

      let currentY = marginTop;
      let isFirstBlock = true;

      const reportBlocks = Array.from(
        reportContainer.querySelectorAll(".pdf-report-block")
      );

      for (const block of reportBlocks) {
        const canvas = await html2canvas(block, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 1220,
        });

        let imageWidth = printableWidth;
        let imageHeight =
          (canvas.height * imageWidth) / canvas.width;

        if (imageHeight > printableHeight) {
          const scaleFactor = printableHeight / imageHeight;

          imageWidth *= scaleFactor;
          imageHeight *= scaleFactor;
        }

        const remainingHeight =
          pageHeight - marginBottom - currentY;

        if (!isFirstBlock && imageHeight > remainingHeight) {
          pdf.addPage();
          currentY = marginTop;
        }

        const imageX =
          marginX + (printableWidth - imageWidth) / 2;

        const imageData = canvas.toDataURL("image/jpeg", 0.96);

        pdf.addImage(
          imageData,
          "JPEG",
          imageX,
          currentY,
          imageWidth,
          imageHeight,
          undefined,
          "FAST"
        );

        currentY += imageHeight + blocksGap;
        isFirstBlock = false;
      }

      const totalPdfPages = pdf.getNumberOfPages();

      for (
        let pageIndex = 1;
        pageIndex <= totalPdfPages;
        pageIndex += 1
      ) {
        pdf.setPage(pageIndex);
        pdf.setFontSize(8);
        pdf.setTextColor(100);

        pdf.text(
          `${pageIndex} / ${totalPdfPages}`,
          pageWidth / 2,
          pageHeight - 4,
          {
            align: "center",
          }
        );
      }

      const date = new Date().toISOString().slice(0, 10);

      pdf.save(`heaps-report-${date}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);

      alert("حدث خطأ أثناء إنشاء تقرير PDF");
    } finally {
      reportContainer?.remove();
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
                    paginatedItems.map((item) => {
                      const bricksCount = getValidBricksCount(
                        item.bricksCount
                      );

                      return (
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
                            {bricksCount === null
                              ? "غير محدد"
                              : formatNumber(bricksCount)}
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
                      );
                    })
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

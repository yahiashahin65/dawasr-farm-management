import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import { createSystemEvent } from "../../lib/systemEvents";
import { calculateAssetsStats } from "../../lib/assetsStats";
import {
  getCachedCollection,
  setCachedCollection,
  subscribeCachedCollection,
} from "../../lib/realtimeCache";
import { addOfflineOperation, isOnline } from "../../lib/offlineQueue";

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
  faEye,
  faRightLeft,
  faTableCells,
  faTableList,
  faBroom,
  faFilePdf,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

import {
  badgeClass,
  getAssetTypeName,
  getPlaceName,
  getPlaceTypeLabel,
  normalizeList,
} from "../../lib/inventory";

const PAGE_SIZE = 10;

const removeAssetFromCache = (assetId) => {
  const cached = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cached.filter((item) => item.id !== assetId)
  );
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const normalizeReportText = (value) => {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[ـ]/g, "")
    .replace(/[-_/\\.,،()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/*
  مهم:
  الترتيب هنا هو نفس ترتيب الشيت القديم 1 -> 34.
  لكن كل "نوع أصل" حقيقي من assetTypes يظهر كقسم مستقل.
  التجميع لا يعتمد على اسم الأصل نهائيًا، بل على assetTypeId فقط.
*/
const ASSET_TYPE_REPORT_GROUPS = [
  {
    number: 1,
    title: "الحراثات",
    typeNames: ["حراثات 8 كفر", "حراثات 6 كفر", "حراثات 4 كفر"],
  },
  {
    number: 2,
    title: "باكتات الحراثات",
    typeNames: ["باكيت"],
  },
  {
    number: 3,
    title: "المقطورات",
    typeNames: ["مقطوره 2 كفر", "مقطوره 4 كفر", "سطحه"],
  },
  {
    number: 4,
    title: "لبانة ولجر 630",
    typeNames: ["لبانه ولجر 630"],
  },
  {
    number: 5,
    title: "المرشات",
    typeNames: ["مرشه"],
  },
  {
    number: 6,
    title: "الدسك",
    typeNames: ["ديسك"],
  },
  {
    number: 7,
    title: "النثارات",
    typeNames: ["نثاره"],
  },
  {
    number: 8,
    title: "المشط",
    typeNames: ["مشط"],
  },
  {
    number: 9,
    title: "البذارات",
    typeNames: ["بذاره جندير"],
  },
  {
    number: 10,
    title: "اللمامات",
    typeNames: ["لمامه"],
  },
  {
    number: 11,
    title: "الدريل",
    typeNames: ["دريل"],
  },
  {
    number: 12,
    title: "المساح",
    typeNames: ["مساح"],
  },
  {
    number: 13,
    title: "الفجاج",
    typeNames: ["فجاج"],
  },
  {
    number: 14,
    title: "اللقطات",
    typeNames: ["لقطات"],
  },
  {
    number: 15,
    title: "الحصادات",
    typeNames: ["حصاده"],
  },
  {
    number: 16,
    title: "البابكت",
    typeNames: ["بوكت"],
  },
  {
    number: 17,
    title: "تريلات LB",
    typeNames: ["تريلات LB"],
  },
  {
    number: 18,
    title: "اللوبد",
    typeNames: ["لوبد"],
  },
  {
    number: 19,
    title: "القلابات",
    typeNames: ["قلاب عادي"],
  },
  {
    number: 20,
    title: "خزانات مياه للتريلات",
    typeNames: ["خزان مياه"],
  },
  {
    number: 21,
    title: "قلابات 6",
    typeNames: ["قلاب 6"],
  },
  {
    number: 22,
    title: "وايتات المزارع",
    typeNames: ["وايت مياه", "وايت ديزل"],
  },
  {
    number: 23,
    title: "الشيوال",
    typeNames: ["شوال"],
  },
  {
    number: 24,
    title: "الرصاصات",
    typeNames: ["رصاصات"],
  },
  {
    number: 25,
    title: "بوكلين هونداي",
    typeNames: ["بوكلين"],
  },
  {
    number: 26,
    title: "الرافعة",
    typeNames: ["رافعه"],
  },
  {
    number: 27,
    title: "الجريدر",
    typeNames: ["جريدر"],
  },
  {
    number: 28,
    title: "البلدوزر",
    typeNames: ["بلدوزر"],
  },
  {
    number: 29,
    title: "الجير",
    typeNames: ["جير"],
  },
  {
    number: 30,
    title: "مولدات الكهرباء والمياه",
    typeNames: ["مولد"],
  },
  {
    number: 31,
    title: "مكاين كاتربلر",
    typeNames: ["مكينه كاتر بلر"],
  },
  {
    number: 32,
    title: "مضخات المياه ومستلزمات مكاين البير",
    typeNames: [
      "دينامو مكينه",
      "سناده",
      "اله قص الاعشاب",
      "طابلون فالي",
      "دينامو بير",
      "دفريش",
      "جرم نحاس",
      "ريشه مكينه كبير",
      "ريشه مكينه صغير(نص)",
      "تروس",
      "جلبه نحاس",
      "كفرات",
      "دينامو شنو",
      "دينامو رشاش",
      "مضخه",
      "دباب جندير",
    ],
  },
  {
    number: 33,
    title: "الكمبروسر",
    typeNames: ["كومبروسر"],
  },
  {
    number: 34,
    title: "خزانات المياه",
    typeNames: ["خزان مياه عادي"],
  },
];

const sortAssetsInsideType = (assets) => {
  return assets.slice().sort((a, b) => {
    const codeA = String(a.code || "");
    const codeB = String(b.code || "");

    const codeCompare = codeA.localeCompare(codeB, "ar", {
      numeric: true,
      sensitivity: "base",
    });

    if (codeCompare !== 0) return codeCompare;

    return String(a.name || "").localeCompare(String(b.name || ""), "ar", {
      numeric: true,
      sensitivity: "base",
    });
  });
};

const buildAssetTypeReport = (assets, assetTypes) => {
  const allowedCategories = new Set(["asset", "spare_part", "tool"]);

  const reportAssets = assets.filter((asset) =>
    allowedCategories.has(asset.category || "asset")
  );

  const typeByNormalizedName = new Map(
    assetTypes.map((type) => [normalizeReportText(type.name), type])
  );

  const mappedTypeIds = new Set();
  const entries = [];

  ASSET_TYPE_REPORT_GROUPS.forEach((group) => {
    group.typeNames.forEach((configuredTypeName, typeOrder) => {
      const actualType = typeByNormalizedName.get(
        normalizeReportText(configuredTypeName)
      );

      if (!actualType) return;

      mappedTypeIds.add(actualType.id);

      const typeAssets = reportAssets.filter(
        (asset) => asset.assetTypeId === actualType.id
      );

      entries.push({
        groupNumber: group.number,
        groupTitle: group.title,
        typeOrder,
        type: actualType,
        assets: sortAssetsInsideType(typeAssets),
      });
    });
  });

  /*
    لو تمت إضافة Asset Type جديد في المستقبل ولم يكن موجودًا
    في القائمة أعلاه، يظهر قبل البند 34 حتى لا تضيع أي بيانات.
  */
  const unmatchedTypes = assetTypes
    .filter((type) => !mappedTypeIds.has(type.id))
    .filter((type) =>
      reportAssets.some((asset) => asset.assetTypeId === type.id)
    )
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "ar", {
        numeric: true,
        sensitivity: "base",
      })
    )
    .map((type, index) => ({
      groupNumber: 33.5,
      groupTitle: "أنواع إضافية غير موجودة في ترتيب الشيت القديم",
      typeOrder: index,
      type,
      assets: sortAssetsInsideType(
        reportAssets.filter((asset) => asset.assetTypeId === type.id)
      ),
      unmatched: true,
    }));

  const beforeLast = entries.filter((entry) => entry.groupNumber !== 34);
  const lastGroup = entries.filter((entry) => entry.groupNumber === 34);

  return {
    entries: [...beforeLast, ...unmatchedTypes, ...lastGroup],
    reportAssets,
  };
};

export default function Assets() {
  const router = useRouter();
  const { canManage } = useUserRole();

  const [allItems, setAllItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [farms, setFarms] = useState([]);
  const [kubras, setKubras] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    status: "",
    assetTypeId: "",
    placeType: "",
    farmId: "",
    kubraId: "",
    workerId: "",
    category: "",
  });

  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState("table");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const unsubscribeAssets = subscribeCachedCollection({
      db,
      collectionName: "assets",
      cacheKey: "cache:assets",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: setAllItems,
      onLoading: setInitialLoading,
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الأصول لحظيًا");
      },
    });

    const unsubscribeTypes = subscribeCachedCollection({
      db,
      collectionName: "assetTypes",
      cacheKey: "cache:assetTypes",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => setTypes(normalizeList(data)),
      onError: () => {
        setRealtimeError("تعذر تحديث أنواع الأصول لحظيًا");
      },
    });

    const unsubscribeFarms = subscribeCachedCollection({
      db,
      collectionName: "farms",
      cacheKey: "cache:farms",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => setFarms(normalizeList(data)),
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات المزارع لحظيًا");
      },
    });

    const unsubscribeKubras = subscribeCachedCollection({
      db,
      collectionName: "kubras",
      cacheKey: "cache:kubras",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => setKubras(normalizeList(data)),
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات الكِبر لحظيًا");
      },
    });

    const unsubscribeWorkers = subscribeCachedCollection({
      db,
      collectionName: "workers",
      cacheKey: "cache:workers",
      orderField: "createdAt",
      orderDirection: "desc",
      onData: (data) => {
        setWorkers(normalizeList(data));
        setMetaLoading(false);
      },
      onError: () => {
        setRealtimeError("تعذر تحديث بيانات العمال لحظيًا");
        setMetaLoading(false);
      },
    });

    return () => {
      unsubscribeAssets?.();
      unsubscribeTypes?.();
      unsubscribeFarms?.();
      unsubscribeKubras?.();
      unsubscribeWorkers?.();
    };
  }, []);

  const stats = useMemo(() => calculateAssetsStats(allItems), [allItems]);

  useEffect(() => {
    const q = router.query;

    setFilters({
      status: q.status ? String(q.status) : "",
      assetTypeId: q.assetTypeId ? String(q.assetTypeId) : "",
      placeType: q.placeType ? String(q.placeType) : "",
      farmId: q.farmId ? String(q.farmId) : "",
      kubraId: q.kubraId ? String(q.kubraId) : "",
      workerId: q.workerId ? String(q.workerId) : "",
      category: q.category ? String(q.category) : "",
    });

    setCurrentPage(1);
  }, [router.query]);

  const setFilter = (key, value) => {
    setCurrentPage(1);

    const next = {
      ...router.query,
      [key]: value,
    };

    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k];
    });

    router.push({
      pathname: "/assets",
      query: next,
    });
  };

  const clearFilters = () => {
    setSearch("");
    setCurrentPage(1);
    router.push("/assets");
  };

  const filtered = useMemo(
    () =>
      allItems.filter((asset) => {
        const haystack = `
          ${asset.name || ""}
          ${getAssetTypeName(asset)}
          ${getPlaceName(asset)}
          ${asset.workerNames || ""}
          ${asset.code || ""}
          ${asset.status || ""}
          ${asset.category || ""}
        `.toLowerCase();

        return (
          (!filters.category ||
            (asset.category || "asset") === filters.category) &&
          (!filters.status || asset.status === filters.status) &&
          (!filters.assetTypeId || asset.assetTypeId === filters.assetTypeId) &&
          (!filters.placeType || asset.placeType === filters.placeType) &&
          (!filters.farmId ||
            asset.farmId === filters.farmId ||
            asset.placeId === filters.farmId) &&
          (!filters.kubraId ||
            asset.kubraId === filters.kubraId ||
            asset.placeId === filters.kubraId) &&
          (!filters.workerId ||
            (asset.workerIds || []).includes(filters.workerId)) &&
          (!search || haystack.includes(search.toLowerCase()))
        );
      }),
    [allItems, filters, search]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    return filtered.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [filtered, currentPage]);

  const remove = async (id) => {
    if (!canManage) return;

    if (!confirm("هل تريد حذف الأصل؟")) return;

    const target = allItems.find((item) => item.id === id);
    const assetName = target?.name || target?.assetName || target?.code || "أصل";

    const systemEvent = {
      type: "delete",
      module: "assets",
      title: "تم حذف أصل",
      description: assetName,
      itemId: id,
      itemPath: "/assets",
      notify: true,
    };

    removeAssetFromCache(id);
    setAllItems((prev) => prev.filter((item) => item.id !== id));

    if (paginatedItems.length === 1 && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }

    if (!isOnline()) {
      addOfflineOperation({
        collectionName: "assets",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف أصل",
          name: assetName,
          systemEvent,
        },
      });

      alert("تم حذف الأصل محليًا وسيتم تنفيذ الحذف عند عودة الاتصال");
      return;
    }

    try {
      await deleteDoc(doc(db, "assets", id));
      await createSystemEvent(systemEvent);

      alert("تم حذف الأصل بنجاح");
    } catch (error) {
      console.error(error);

      addOfflineOperation({
        collectionName: "assets",
        operation: "delete",
        documentId: id,
        payload: {},
        meta: {
          label: "حذف أصل",
          name: assetName,
          systemEvent,
        },
      });

      alert(
        "تعذر الاتصال، تم حفظ عملية الحذف وسيتم تنفيذها عند عودة الاتصال"
      );
    }
  };

  const categoryLabel = (category) => {
    if (category === "spare_part") return "قطعة غيار";
    if (category === "tool") return "أداة";
    if (category === "material") return "مواد";
    return "معدة";
  };

  const exportAllAssetsToPdf = async () => {
    if (isExportingPdf) return;

    if (!allItems.length) {
      alert("لا توجد أصول لتصديرها");
      return;
    }

    if (!types.length) {
      alert("لم يتم تحميل أنواع الأصول بعد");
      return;
    }

    const { entries, reportAssets } = buildAssetTypeReport(allItems, types);

    if (!reportAssets.length) {
      alert("لا توجد معدات أو قطع غيار أو أدوات لتصديرها");
      return;
    }

    setIsExportingPdf(true);

    try {
      const [{ default: jsPDF }, { default: html2canvas }] =
        await Promise.all([import("jspdf"), import("html2canvas")]);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const PAGE_WIDTH = 1120;
      const PAGE_HEIGHT = 790;
      const ROWS_PER_PAGE = 9;

      const generatedAt = new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date());

      const equipmentCount = reportAssets.filter(
        (asset) => (asset.category || "asset") === "asset"
      ).length;

      const sparePartsCount = reportAssets.filter(
        (asset) => asset.category === "spare_part"
      ).length;

      const toolsCount = reportAssets.filter(
        (asset) => asset.category === "tool"
      ).length;

      const goodCount = reportAssets.filter(
        (asset) => asset.status === "صالح"
      ).length;

      const brokenCount = reportAssets.filter(
        (asset) => asset.status === "عاطل"
      ).length;

      const workshopCount = reportAssets.filter(
        (asset) => asset.status === "في الورشة"
      ).length;

      const createPdfPage = () => {
        const page = document.createElement("div");

        page.setAttribute("dir", "rtl");

        page.style.cssText = `
          position: fixed;
          top: 0;
          right: -100000px;
          width: ${PAGE_WIDTH}px;
          height: ${PAGE_HEIGHT}px;
          padding: 36px 40px;
          box-sizing: border-box;
          direction: rtl;
          overflow: hidden;
          background: #ffffff;
          color: #0f172a;
          font-family: Tahoma, Arial, sans-serif;
          line-height: 1.55;
        `;

        document.body.appendChild(page);

        return page;
      };

      const addPageElementToPdf = async (pageElement, first = false) => {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }

        await new Promise((resolve) => setTimeout(resolve, 60));

        const canvas = await html2canvas(pageElement, {
          scale: 1.6,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: PAGE_WIDTH,
          windowHeight: PAGE_HEIGHT,
        });

        if (!first) {
          pdf.addPage();
        }

        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.96),
          "JPEG",
          0,
          0,
          pdfWidth,
          pdfHeight,
          undefined,
          "FAST"
        );

        pageElement.remove();
      };

      const getStatusStyle = (status) => {
        if (status === "عاطل") {
          return {
            rowBackground: "#fee2e2",
            badge: `
              color: #991b1b;
              background: #fecaca;
              border: 1px solid #fca5a5;
            `,
          };
        }

        if (status === "في الورشة") {
          return {
            rowBackground: "#ffffff",
            badge: `
              color: #92400e;
              background: #fef3c7;
              border: 1px solid #fcd34d;
            `,
          };
        }

        if (status === "صالح") {
          return {
            rowBackground: "#ffffff",
            badge: `
              color: #166534;
              background: #dcfce7;
              border: 1px solid #86efac;
            `,
          };
        }

        return {
          rowBackground: "#ffffff",
          badge: `
            color: #334155;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
          `,
        };
      };

      const renderRows = (assets, startIndex) => {
        return assets
          .map((asset, index) => {
            const statusStyle = getStatusStyle(asset.status);

            return `
              <tr style="background: ${statusStyle.rowBackground};">
                <td>${startIndex + index + 1}</td>

                <td style="font-weight: 900;">
                  ${escapeHtml(asset.name || asset.assetName || "-")}
                </td>

                <td>
                  ${escapeHtml(categoryLabel(asset.category))}
                </td>

                <td style="font-weight: 800;">
                  ${escapeHtml(getAssetTypeName(asset) || "-")}
                </td>

                <td>
                  ${escapeHtml(asset.code || "-")}
                </td>

                <td>
                  <div style="font-weight: 800;">
                    ${escapeHtml(getPlaceName(asset) || "-")}
                  </div>

                  <div
                    style="
                      margin-top: 2px;
                      color: #64748b;
                      font-size: 10px;
                    "
                  >
                    ${escapeHtml(getPlaceTypeLabel(asset.placeType) || "")}
                  </div>
                </td>

                <td>
                  ${escapeHtml(asset.workerNames || "-")}
                </td>

                <td>
                  <span
                    style="
                      display: inline-block;
                      min-width: 68px;
                      padding: 5px 8px;
                      border-radius: 8px;
                      font-weight: 900;
                      ${statusStyle.badge}
                    "
                  >
                    ${escapeHtml(asset.status || "-")}
                  </span>
                </td>
              </tr>
            `;
          })
          .join("");
      };

      const renderTable = (assets, startIndex) => {
        return `
          <table
            style="
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 11px;
            "
          >
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="width: 4%;">م</th>
                <th style="width: 17%;">اسم الأصل</th>
                <th style="width: 10%;">التصنيف</th>
                <th style="width: 16%;">نوع الأصل</th>
                <th style="width: 9%;">الكود</th>
                <th style="width: 18%;">المكان الحالي</th>
                <th style="width: 16%;">العمال</th>
                <th style="width: 10%;">الحالة</th>
              </tr>
            </thead>

            <tbody>
              ${renderRows(assets, startIndex)}
            </tbody>
          </table>
        `;
      };

      const applyTableStyles = (page) => {
        page.querySelectorAll("th").forEach((th) => {
          th.style.cssText += `
            padding: 9px 5px;
            border: 1px solid #cbd5e1;
            color: #334155;
            font-weight: 900;
            text-align: center;
            vertical-align: middle;
          `;
        });

        page.querySelectorAll("td").forEach((td) => {
          td.style.cssText += `
            padding: 8px 5px;
            border: 1px solid #dbe3ea;
            color: #0f172a;
            text-align: center;
            vertical-align: middle;
            word-break: break-word;
          `;
        });
      };

      /*
        الصفحة الأولى: الإحصائيات العامة.
      */
      const summaryPage = createPdfPage();

      summaryPage.innerHTML = `
        <div
          style="
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 22px;
            border-bottom: 3px solid #15803d;
          "
        >
          <div>
            <div
              style="
                color: #15803d;
                font-size: 14px;
                font-weight: 900;
              "
            >
              إدارة المزرعة
            </div>

            <h1
              style="
                margin: 5px 0 0;
                color: #0f172a;
                font-size: 33px;
                font-weight: 900;
              "
            >
              تقرير المعدات والأدوات وقطع الغيار
            </h1>

            <p
              style="
                margin: 7px 0 0;
                color: #64748b;
                font-size: 14px;
                font-weight: 700;
              "
            >
              كل نوع أصل مستقل، والبيانات مأخوذة مباشرة من النظام الحالي
            </p>
          </div>

          <div
            style="
              min-width: 230px;
              padding: 13px 15px;
              border: 1px solid #dbe7df;
              border-radius: 12px;
              background: #f8fafc;
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

        <div
          style="
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-top: 24px;
          "
        >
          <div
            style="
              padding: 17px;
              border-radius: 13px;
              background: #15803d;
              color: #ffffff;
            "
          >
            <div style="font-size: 12px; font-weight: 800; opacity: .9;">
              إجمالي التقرير
            </div>
            <div style="margin-top: 4px; font-size: 29px; font-weight: 900;">
              ${reportAssets.length}
            </div>
          </div>

          <div
            style="
              padding: 17px;
              border: 1px solid #86efac;
              border-radius: 13px;
              background: #dcfce7;
            "
          >
            <div style="color: #166534; font-size: 12px; font-weight: 900;">
              صالح
            </div>
            <div style="margin-top: 4px; color: #166534; font-size: 29px; font-weight: 900;">
              ${goodCount}
            </div>
          </div>

          <div
            style="
              padding: 17px;
              border: 1px solid #fca5a5;
              border-radius: 13px;
              background: #fee2e2;
            "
          >
            <div style="color: #991b1b; font-size: 12px; font-weight: 900;">
              عاطل
            </div>
            <div style="margin-top: 4px; color: #991b1b; font-size: 29px; font-weight: 900;">
              ${brokenCount}
            </div>
          </div>

          <div
            style="
              padding: 17px;
              border: 1px solid #fcd34d;
              border-radius: 13px;
              background: #fef3c7;
            "
          >
            <div style="color: #92400e; font-size: 12px; font-weight: 900;">
              في الورشة
            </div>
            <div style="margin-top: 4px; color: #92400e; font-size: 29px; font-weight: 900;">
              ${workshopCount}
            </div>
          </div>
        </div>

        <div
          style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 16px;
          "
        >
          <div
            style="
              padding: 16px;
              border: 1px solid #e2e8f0;
              border-radius: 13px;
              background: #f8fafc;
            "
          >
            <div style="color: #64748b; font-size: 12px; font-weight: 800;">
              معدات
            </div>
            <div style="margin-top: 4px; font-size: 25px; font-weight: 900;">
              ${equipmentCount}
            </div>
          </div>

          <div
            style="
              padding: 16px;
              border: 1px solid #e2e8f0;
              border-radius: 13px;
              background: #f8fafc;
            "
          >
            <div style="color: #64748b; font-size: 12px; font-weight: 800;">
              قطع غيار
            </div>
            <div style="margin-top: 4px; font-size: 25px; font-weight: 900;">
              ${sparePartsCount}
            </div>
          </div>

          <div
            style="
              padding: 16px;
              border: 1px solid #e2e8f0;
              border-radius: 13px;
              background: #f8fafc;
            "
          >
            <div style="color: #64748b; font-size: 12px; font-weight: 800;">
              أدوات
            </div>
            <div style="margin-top: 4px; font-size: 25px; font-weight: 900;">
              ${toolsCount}
            </div>
          </div>
        </div>

        <div
          style="
            margin-top: 22px;
            padding: 15px 17px;
            border-radius: 12px;
            background: #f8fafc;
            color: #64748b;
            font-size: 13px;
            font-weight: 800;
          "
        >
          كل Asset Type يبدأ في صفحة جديدة. العناصر العاطلة تظهر بخلفية حمراء.
        </div>
      `;

      await addPageElementToPdf(summaryPage, true);

      /*
        كل Asset Type حقيقي صفحة مستقلة.
        لو النوع كبير، يكمل في صفحات تالية بدون قص.
      */
      for (const entry of entries) {
        const typeAssets = entry.assets;
        const typeTotal = typeAssets.length;

        const typeGood = typeAssets.filter(
          (asset) => asset.status === "صالح"
        ).length;

        const typeBroken = typeAssets.filter(
          (asset) => asset.status === "عاطل"
        ).length;

        const typeWorkshop = typeAssets.filter(
          (asset) => asset.status === "في الورشة"
        ).length;

        const pagesCount = Math.max(
          1,
          Math.ceil(typeAssets.length / ROWS_PER_PAGE)
        );

        for (let pageIndex = 0; pageIndex < pagesCount; pageIndex++) {
          const start = pageIndex * ROWS_PER_PAGE;
          const currentAssets = typeAssets.slice(
            start,
            start + ROWS_PER_PAGE
          );

          const page = createPdfPage();

          page.innerHTML = `
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                padding: 14px 17px;
                border-radius: 14px;
                background: #eaf8ef;
                border: 1px solid #ccebd7;
              "
            >
              <div>
                <div
                  style="
                    color: #0f172a;
                    font-size: 23px;
                    font-weight: 900;
                  "
                >
                  ${escapeHtml(entry.type.name)}
                </div>
              </div>

              <div
                style="
                  display: flex;
                  gap: 7px;
                  color: #0f172a;
                "
              >
                <div
                  style="
                    min-width: 72px;
                    padding: 7px 9px;
                    background: #ffffff;
                    border-radius: 9px;
                    text-align: center;
                  "
                >
                  <div style="color: #64748b; font-size: 9px; font-weight: 800;">
                    الإجمالي
                  </div>
                  <b style="display: block; margin-top: 2px; font-size: 17px;">
                    ${typeTotal}
                  </b>
                </div>

                <div
                  style="
                    min-width: 67px;
                    padding: 7px 9px;
                    background: #dcfce7;
                    border-radius: 9px;
                    text-align: center;
                  "
                >
                  <div style="color: #166534; font-size: 9px; font-weight: 800;">
                    صالح
                  </div>
                  <b style="display: block; margin-top: 2px; color: #166534; font-size: 17px;">
                    ${typeGood}
                  </b>
                </div>

                <div
                  style="
                    min-width: 67px;
                    padding: 7px 9px;
                    background: #fee2e2;
                    border-radius: 9px;
                    text-align: center;
                  "
                >
                  <div style="color: #991b1b; font-size: 9px; font-weight: 800;">
                    عاطل
                  </div>
                  <b style="display: block; margin-top: 2px; color: #991b1b; font-size: 17px;">
                    ${typeBroken}
                  </b>
                </div>

                <div
                  style="
                    min-width: 74px;
                    padding: 7px 9px;
                    background: #fef3c7;
                    border-radius: 9px;
                    text-align: center;
                  "
                >
                  <div style="color: #92400e; font-size: 9px; font-weight: 800;">
                    في الورشة
                  </div>
                  <b style="display: block; margin-top: 2px; color: #92400e; font-size: 17px;">
                    ${typeWorkshop}
                  </b>
                </div>
              </div>
            </div>

            ${
              pagesCount > 1
                ? `
                  <div
                    style="
                      margin-top: 8px;
                      color: #64748b;
                      font-size: 11px;
                      font-weight: 800;
                    "
                  >
                    صفحة ${pageIndex + 1} من ${pagesCount} لهذا النوع
                  </div>
                `
                : ""
            }

            ${
              currentAssets.length
                ? `
                  <div
                    style="
                      margin-top: 12px;
                      overflow: hidden;
                      border: 1px solid #dbe3ea;
                      border-radius: 12px;
                    "
                  >
                    ${renderTable(currentAssets, start)}
                  </div>
                `
                : `
                  <div
                    style="
                      margin-top: 30px;
                      padding: 44px;
                      border: 1px dashed #cbd5e1;
                      border-radius: 14px;
                      background: #f8fafc;
                      color: #64748b;
                      text-align: center;
                      font-size: 17px;
                      font-weight: 900;
                    "
                  >
                    لا توجد أصول مسجلة حاليًا من هذا النوع
                  </div>
                `
            }
          `;

          applyTableStyles(page);

          await addPageElementToPdf(page);
        }
      }

      const fileDate = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "_");

      pdf.save(`assets_report_${fileDate}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("حدث خطأ أثناء إنشاء ملف PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const quick = [
    { label: "الكل", count: stats.total, key: "", value: "" },
    { label: "صالح", count: stats.good, key: "status", value: "صالح" },
    { label: "عاطل", count: stats.broken, key: "status", value: "عاطل" },
    {
      label: "في الورشة",
      count: stats.inWorkshop,
      key: "status",
      value: "في الورشة",
    },
    {
      label: "معدات",
      count: stats.equipment,
      key: "category",
      value: "asset",
    },
    {
      label: "قطع غيار",
      count: stats.spareParts,
      key: "category",
      value: "spare_part",
    },
    {
      label: "أدوات",
      count: stats.tools,
      key: "category",
      value: "tool",
    },
    {
      label: "مواد",
      count: stats.materials,
      key: "category",
      value: "material",
    },
    {
      label: "داخل المزارع",
      count: stats.inFarms,
      key: "placeType",
      value: "farm",
    },
    {
      label: "داخل الكِبر",
      count: stats.inKubras,
      key: "placeType",
      value: "kubra",
    },
    {
      label: "في الورش",
      count: stats.inExternalWorkshops,
      key: "placeType",
      value: "external_workshop",
    },
  ];

  const isQuickActive = (q) => {
    if (!q.key) return !Object.values(filters).some(Boolean);
    return filters[q.key] === q.value;
  };

  const isLoading = initialLoading || metaLoading;

  return (
    <ProtectedRoute>
      <Layout title="إدارة الأصول والعهد">
        {isLoading ? (
          <AppLoader
            variant="compact"
            title="جاري تحميل الأصول..."
            subtitle="يتم تجهيز بيانات الأصول والفلاتر"
          />
        ) : (
          <>
            {realtimeError && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                {realtimeError}
              </div>
            )}

            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {quick.map((q) => (
                  <button
                    key={q.label}
                    onClick={() =>
                      q.key ? setFilter(q.key, q.value) : clearFilters()
                    }
                    className={`btn-secondary ${
                      isQuickActive(q) ? "!bg-slate-900 !text-white" : ""
                    }`}
                  >
                    {q.label} {q.count}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportAllAssetsToPdf}
                  disabled={isExportingPdf}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FontAwesomeIcon
                    icon={isExportingPdf ? faSpinner : faFilePdf}
                    className={isExportingPdf ? "animate-spin" : ""}
                  />

                  {isExportingPdf ? "جاري إنشاء PDF..." : "تصدير PDF"}
                </button>

                <button onClick={clearFilters} className="btn-secondary">
                  <FontAwesomeIcon icon={faBroom} />
                  مسح الفلاتر
                </button>

                <button
                  onClick={() => setView(view === "table" ? "grid" : "table")}
                  className="btn-secondary"
                >
                  <FontAwesomeIcon
                    icon={view === "table" ? faTableCells : faTableList}
                  />
                  {view === "table" ? "عرض كروت" : "عرض جدول"}
                </button>

                {canManage && (
                  <Link href="/assets/add" className="btn-primary">
                    <FontAwesomeIcon icon={faPlus} />
                    إضافة أصل
                  </Link>
                )}
              </div>
            </div>

            <div className="page-card mb-4 grid gap-3 p-3 lg:grid-cols-7">
              <div className="flex items-center gap-2 lg:col-span-2">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-slate-400"
                />

                <input
                  className="w-full bg-transparent p-2 outline-none"
                  placeholder="بحث باسم الأصل أو النوع أو المكان أو العامل"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select
                className="form-input"
                value={filters.category}
                onChange={(e) => setFilter("category", e.target.value)}
              >
                <option value="">كل التصنيفات</option>
                <option value="asset">معدات</option>
                <option value="spare_part">قطع غيار</option>
                <option value="tool">أدوات</option>
                <option value="material">مواد</option>
              </select>

              <select
                className="form-input"
                value={filters.assetTypeId}
                onChange={(e) => setFilter("assetTypeId", e.target.value)}
              >
                <option value="">كل الأنواع</option>

                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.farmId}
                onChange={(e) => setFilter("farmId", e.target.value)}
              >
                <option value="">كل المزارع</option>

                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.kubraId}
                onChange={(e) => setFilter("kubraId", e.target.value)}
              >
                <option value="">كل الكِبر</option>

                {kubras.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.workerId}
                onChange={(e) => setFilter("workerId", e.target.value)}
              >
                <option value="">كل العمال</option>

                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3 text-sm font-bold text-slate-500">
              المعروض في هذه الصفحة: {paginatedItems.length} من إجمالي النتائج{" "}
              {filtered.length}
            </div>

            {view === "table" ? (
              <div className="page-card overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-th">الصورة</th>
                      <th className="table-th">الأصل</th>
                      <th className="table-th">التصنيف</th>
                      <th className="table-th">نوع الأصل</th>
                      <th className="table-th">المكان الحالي</th>
                      <th className="table-th">العمال</th>
                      <th className="table-th">الحالة</th>
                      <th className="table-th">إجراءات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedItems.map((asset) => (
                      <tr
                        className="clickable-row border-t border-slate-100"
                        key={asset.id}
                      >
                        <td className="table-td">
                          {asset.imageUrl ? (
                            <button onClick={() => setPreview(asset)}>
                              <img
                                src={asset.imageUrl}
                                alt={asset.name}
                                className="h-16 w-24 rounded-2xl object-cover ring-1 ring-slate-200"
                              />
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="table-td">
                          <Link href={`/assets/${asset.id}`}>
                            <b>{asset.name}</b>

                            {asset.syncStatus === "pending" && (
                              <span className="mr-2 rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                                قيد المزامنة
                              </span>
                            )}

                            <p className="text-xs text-slate-400">
                              {asset.code || ""}
                            </p>
                          </Link>
                        </td>

                        <td className="table-td">
                          <span className="badge bg-purple-50 text-purple-700">
                            {categoryLabel(asset.category)}
                          </span>
                        </td>

                        <td className="table-td">
                          {asset.assetTypeId ? (
                            <Link
                              href={`/assets?assetTypeId=${asset.assetTypeId}`}
                            >
                              {getAssetTypeName(asset)}
                            </Link>
                          ) : (
                            getAssetTypeName(asset)
                          )}
                        </td>

                        <td className="table-td">
                          <Link
                            href={
                              asset.placeType === "kubra"
                                ? `/assets?kubraId=${
                                    asset.kubraId || asset.placeId
                                  }`
                                : asset.placeType === "external_workshop"
                                ? `/assets?placeType=external_workshop`
                                : `/assets?farmId=${
                                    asset.farmId || asset.placeId
                                  }`
                            }
                          >
                            <b>{getPlaceName(asset)}</b>
                            <p className="text-xs text-slate-400">
                              {getPlaceTypeLabel(asset.placeType)}
                            </p>
                          </Link>
                        </td>

                        <td className="table-td max-w-xs overflow-hidden text-ellipsis">
                          {asset.workerNames || "-"}
                        </td>

                        <td className="table-td">
                          <Link
                            href={`/assets?status=${asset.status}`}
                            className={`badge ${badgeClass(asset.status)}`}
                          >
                            {asset.status}
                          </Link>
                        </td>

                        <td className="table-td">
                          <div className="flex gap-2">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="btn-secondary !p-2"
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </Link>

                            {canManage && (
                              <>
                                <Link
                                  href={`/assets/move/${asset.id}`}
                                  className="btn-secondary !p-2"
                                >
                                  <FontAwesomeIcon icon={faRightLeft} />
                                </Link>

                                <Link
                                  href={`/assets/edit/${asset.id}`}
                                  className="btn-secondary !p-2"
                                >
                                  <FontAwesomeIcon icon={faPen} />
                                </Link>

                                <button
                                  onClick={() => remove(asset.id)}
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

                    {filtered.length === 0 && (
                      <tr>
                        <td className="table-td text-center" colSpan="8">
                          لا توجد أصول مطابقة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedItems.map((asset) => (
                  <div key={asset.id} className="page-card overflow-hidden">
                    <button
                      onClick={() => asset.imageUrl && setPreview(asset)}
                      className="block h-44 w-full bg-slate-100"
                    >
                      {asset.imageUrl ? (
                        <img
                          src={asset.imageUrl}
                          className="h-full w-full object-cover"
                          alt={asset.name}
                        />
                      ) : null}
                    </button>

                    <div className="p-4">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="text-lg font-black"
                      >
                        {asset.name}
                      </Link>

                      {asset.syncStatus === "pending" && (
                        <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                          قيد المزامنة
                        </span>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge bg-purple-50 text-purple-700">
                          {categoryLabel(asset.category)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {getAssetTypeName(asset)} - {getPlaceName(asset)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`badge ${badgeClass(asset.status)}`}>
                          {asset.status}
                        </span>

                        <span className="badge bg-slate-100 text-slate-600">
                          {getPlaceTypeLabel(asset.placeType)}
                        </span>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="btn-secondary"
                        >
                          عرض
                        </Link>

                        {canManage && (
                          <Link
                            href={`/assets/move/${asset.id}`}
                            className="btn-secondary"
                          >
                            نقل
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filtered.length === 0 && (
                  <div className="page-card p-5 text-center font-bold text-slate-500 md:col-span-2 xl:col-span-3">
                    لا توجد أصول مطابقة
                  </div>
                )}
              </div>
            )}

            {filtered.length > PAGE_SIZE && (
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
            )}

            {preview && (
              <div
                onClick={() => setPreview(null)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-black">{preview.name}</h3>

                    <button
                      className="btn-secondary !py-2"
                      onClick={() => setPreview(null)}
                    >
                      إغلاق
                    </button>
                  </div>

                  <img
                    src={preview.imageUrl}
                    alt={preview.name}
                    className="max-h-[75vh] w-full rounded-2xl object-contain"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

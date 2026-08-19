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

const hasAnyReportKeyword = (text, keywords) => {
  const normalizedText = normalizeReportText(text);

  return keywords.some((keyword) =>
    normalizedText.includes(normalizeReportText(keyword))
  );
};

const getReportSearchText = (asset) => {
  return normalizeReportText(`
    ${asset.name || ""}
    ${asset.assetName || ""}
    ${getAssetTypeName(asset) || ""}
    ${asset.assetTypeName || ""}
    ${asset.typeName || ""}
    ${asset.code || ""}
  `);
};

const ASSETS_REPORT_ORDER = [
  {
    number: 1,
    title: "الحراثات",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "حراثة",
        "حراثات",
        "جندير",
        "جون دير",
        "نيو هولاند",
        "نيوهولاند",
        "فيات",
        "فنت",
        "كابوتا",
        "يانمار",
        "ينمر",
      ]),
  },
  {
    number: 2,
    title: "باكتات الحراثات",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "باكت",
        "باكتات",
        "بكت حراثة",
        "بكت حراثات",
        "عمدان باكت",
      ]),
  },
  {
    number: 3,
    title: "المقطورات",
    match: (text) =>
      hasAnyReportKeyword(text, ["مقطورة", "مقطورات", "مقطوره", "مقطورات"]),
  },
  {
    number: 4,
    title: "لبانة ولجر 630",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "لبانه",
        "لبانة",
        "لجر630",
        "لجر 630",
        "لجر",
      ]),
  },
  {
    number: 5,
    title: "المرشات",
    match: (text) =>
      hasAnyReportKeyword(text, ["مرشة", "مرشات", "مرشه", "مرش"]),
  },
  {
    number: 6,
    title: "الدسك",
    match: (text) =>
      hasAnyReportKeyword(text, ["دسك", "ديسك", "ديسكات"]),
  },
  {
    number: 7,
    title: "النثارات",
    match: (text) =>
      hasAnyReportKeyword(text, ["نثارة", "نثارات", "نثاره"]),
  },
  {
    number: 8,
    title: "المشط",
    match: (text) =>
      hasAnyReportKeyword(text, ["مشط", "امشاط", "أمشاط"]),
  },
  {
    number: 9,
    title: "البذارات",
    match: (text) =>
      hasAnyReportKeyword(text, ["بذارة", "بذارات", "بذاره"]),
  },
  {
    number: 10,
    title: "اللمامات",
    match: (text) =>
      hasAnyReportKeyword(text, ["لمامة", "لمامات", "لمامه"]),
  },
  {
    number: 11,
    title: "الدريل",
    match: (text) =>
      hasAnyReportKeyword(text, ["دريل", "دريلات"]),
  },
  {
    number: 12,
    title: "المساح",
    match: (text) =>
      hasAnyReportKeyword(text, ["مساح", "مساحات"]),
  },
  {
    number: 13,
    title: "الفجاج",
    match: (text) =>
      hasAnyReportKeyword(text, ["فجاج", "فجاجات"]),
  },
  {
    number: 14,
    title: "اللقطات",
    match: (text) =>
      hasAnyReportKeyword(text, ["لقاطة", "لقاطه", "لقطات", "لقاط"]),
  },
  {
    number: 15,
    title: "الحصادات",
    match: (text) =>
      hasAnyReportKeyword(text, ["حصادة", "حصادات", "حصاده"]),
  },
  {
    number: 16,
    title: "البابكت",
    match: (text) =>
      hasAnyReportKeyword(text, ["بابكت", "بوبكات", "بوب كات"]),
  },
  {
    number: 17,
    title: "تريلات LB",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "تريلا lb",
        "تريلات lb",
        "تريله lb",
        "lb تريلا",
        "lb",
      ]),
  },
  {
    number: 18,
    title: "اللوبد",
    match: (text) =>
      hasAnyReportKeyword(text, ["لوبد", "لوبدات", "لوبد"]),
  },
  {
    number: 19,
    title: "القلابات",
    match: (text) => {
      const normalized = normalizeReportText(text);

      return (
        hasAnyReportKeyword(normalized, ["قلاب", "قلابات"]) &&
        !hasAnyReportKeyword(normalized, [
          "قلاب 6",
          "قلابات 6",
          "قلاب ست",
          "قلاب سته",
        ])
      );
    },
  },
  {
    number: 20,
    title: "خزانات مياه للتريلات",
    match: (text) => {
      const normalized = normalizeReportText(text);

      return (
        hasAnyReportKeyword(normalized, ["خزان", "خزانات"]) &&
        hasAnyReportKeyword(normalized, [
          "تريلا",
          "تريلات",
          "تريلار",
          "تريلر",
        ])
      );
    },
  },
  {
    number: 21,
    title: "قلابات 6",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "قلاب 6",
        "قلابات 6",
        "قلاب ست",
        "قلاب سته",
      ]),
  },
  {
    number: 22,
    title: "وايتات المزارع",
    match: (text) =>
      hasAnyReportKeyword(text, ["وايت", "وايتات", "وايت ماء"]),
  },
  {
    number: 23,
    title: "الشيوال",
    match: (text) =>
      hasAnyReportKeyword(text, ["شيوال", "شيول", "شياول"]),
  },
  {
    number: 24,
    title: "الرصاصات",
    match: (text) =>
      hasAnyReportKeyword(text, ["رصاصة", "رصاصه", "رصاصات", "رولر"]),
  },
  {
    number: 25,
    title: "بوكلين هونداي",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "بوكلين",
        "بوكلين هونداي",
        "حفار هونداي",
        "حفار هيونداي",
      ]),
  },
  {
    number: 26,
    title: "الرافعة",
    match: (text) =>
      hasAnyReportKeyword(text, ["رافعة", "رافعه", "رافعات"]),
  },
  {
    number: 27,
    title: "الجريدر",
    match: (text) =>
      hasAnyReportKeyword(text, ["جريدر", "قريدر", "جريدرات"]),
  },
  {
    number: 28,
    title: "البلدوزر",
    match: (text) =>
      hasAnyReportKeyword(text, ["بلدوزر", "بلدوزرات"]),
  },
  {
    number: 29,
    title: "الجير",
    match: (text) =>
      hasAnyReportKeyword(text, ["جير", "الجير"]),
  },
  {
    number: 30,
    title: "مولدات الكهرباء والمياه",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "مولد",
        "مولدات",
        "مولد كهرباء",
        "مولد مياه",
      ]),
  },
  {
    number: 31,
    title: "مكاين كاتربلر",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "كاتربلر",
        "كاتر بلر",
        "كاتربيلر",
        "مكينة كاتربلر",
        "مكاين كاتربلر",
      ]),
  },
  {
    number: 32,
    title: "مضخات المياه ومستلزمات مكاين البير",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "مضخة",
        "مضخات",
        "مضخه",
        "طرمبة ماء",
        "طرمبه ماء",
        "مكينة بير",
        "مكينه بير",
        "مكاين البير",
        "مكاين بير",
        "قطع غيار مكاين البير",
        "قطع غيار مكينة بير",
        "صندوق عداد",
        "عداد بير",
      ]),
  },
  {
    number: 33,
    title: "الكمبروسر",
    match: (text) =>
      hasAnyReportKeyword(text, [
        "كمبروسر",
        "كمبروسور",
        "كمبرسر",
        "ضاغط هواء",
      ]),
  },
  {
    number: 34,
    title: "خزانات المياه",
    match: (text) => {
      const normalized = normalizeReportText(text);

      return (
        hasAnyReportKeyword(normalized, [
          "خزان مياه",
          "خزانات مياه",
          "خزان ماء",
          "خزانات ماء",
          "خزان",
        ]) &&
        !hasAnyReportKeyword(normalized, [
          "تريلا",
          "تريلات",
          "تريلار",
          "تريلر",
        ])
      );
    },
  },
];

const getTractorOrder = (asset) => {
  const text = getReportSearchText(asset);

  if (
    hasAnyReportKeyword(text, [
      "8 كفر",
      "8كفر",
      "ثمان كفر",
      "ثمانية كفر",
    ])
  ) {
    return 1;
  }

  if (
    hasAnyReportKeyword(text, [
      "6 كفر",
      "6كفر",
      "ست كفر",
      "سته كفر",
      "ستة كفر",
    ])
  ) {
    return 2;
  }

  if (
    hasAnyReportKeyword(text, [
      "4 كفر",
      "4كفر",
      "اربع كفر",
      "أربع كفر",
      "اربعة كفر",
    ])
  ) {
    return 3;
  }

  return 4;
};

const sortReportAssets = (assets, sectionNumber) => {
  return assets.slice().sort((a, b) => {
    if (sectionNumber === 1) {
      const tractorOrderA = getTractorOrder(a);
      const tractorOrderB = getTractorOrder(b);

      if (tractorOrderA !== tractorOrderB) {
        return tractorOrderA - tractorOrderB;
      }
    }

    const typeCompare = String(getAssetTypeName(a) || "").localeCompare(
      String(getAssetTypeName(b) || ""),
      "ar",
      {
        numeric: true,
        sensitivity: "base",
      }
    );

    if (typeCompare !== 0) return typeCompare;

    return String(a.name || "").localeCompare(String(b.name || ""), "ar", {
      numeric: true,
      sensitivity: "base",
    });
  });
};

const groupAssetsForReport = (assets) => {
  const allowedCategories = new Set(["asset", "spare_part", "tool"]);

  const reportAssets = assets.filter((asset) =>
    allowedCategories.has(asset.category || "asset")
  );

  const assignedIds = new Set();

  const sections = ASSETS_REPORT_ORDER.map((section) => {
    const sectionAssets = reportAssets.filter((asset) => {
      if (assignedIds.has(asset.id)) return false;

      const searchText = getReportSearchText(asset);

      if (!section.match(searchText)) return false;

      assignedIds.add(asset.id);
      return true;
    });

    return {
      ...section,
      assets: sortReportAssets(sectionAssets, section.number),
    };
  });

  const unmatchedAssets = reportAssets
    .filter((asset) => !assignedIds.has(asset.id))
    .sort((a, b) => {
      const typeCompare = String(getAssetTypeName(a) || "").localeCompare(
        String(getAssetTypeName(b) || ""),
        "ar",
        {
          numeric: true,
          sensitivity: "base",
        }
      );

      if (typeCompare !== 0) return typeCompare;

      return String(a.name || "").localeCompare(String(b.name || ""), "ar", {
        numeric: true,
        sensitivity: "base",
      });
    });

  return {
    sections,
    unmatchedAssets,
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

    const { sections, unmatchedAssets, reportAssets } =
      groupAssetsForReport(allItems);

    if (!reportAssets.length) {
      alert("لا توجد معدات أو قطع غيار أو أدوات لتصديرها");
      return;
    }

    setIsExportingPdf(true);

    let reportContainer = null;

    try {
      const [{ default: jsPDF }, { default: html2canvas }] =
        await Promise.all([import("jspdf"), import("html2canvas")]);

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
        line-height: 1.6;
      `;

      const createBlock = (html, extraStyles = "") => {
        const block = document.createElement("section");

        block.className = "pdf-report-block";

        block.style.cssText = `
          width: 1120px;
          padding: 0 38px;
          box-sizing: border-box;
          background: #ffffff;
          ${extraStyles}
        `;

        block.innerHTML = html;

        return block;
      };

      const renderAssetTable = (assets) => {
        if (!assets.length) {
          return `
            <div
              style="
                padding: 18px;
                text-align: center;
                color: #64748b;
                font-size: 14px;
                font-weight: 800;
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
              "
            >
              لا توجد بيانات مسجلة حاليًا تحت هذا البند
            </div>
          `;
        }

        const rows = assets
          .map(
            (asset, index) => `
              <tr>
                <td>${index + 1}</td>

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
                    ${escapeHtml(
                      getPlaceTypeLabel(asset.placeType) || ""
                    )}
                  </div>
                </td>

                <td>
                  ${escapeHtml(asset.workerNames || "-")}
                </td>

                <td style="font-weight: 800;">
                  ${escapeHtml(asset.status || "-")}
                </td>
              </tr>
            `
          )
          .join("");

        return `
          <div style="overflow: hidden;">
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
                  <th style="width: 16%;">اسم الأصل</th>
                  <th style="width: 10%;">التصنيف</th>
                  <th style="width: 16%;">نوع الأصل</th>
                  <th style="width: 10%;">الكود</th>
                  <th style="width: 17%;">المكان الحالي</th>
                  <th style="width: 17%;">العمال</th>
                  <th style="width: 10%;">الحالة</th>
                </tr>
              </thead>

              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      };

      reportContainer.appendChild(
        createBlock(`
          <div
            style="
              padding-top: 42px;
              padding-bottom: 24px;
              border-bottom: 3px solid #15803d;
            "
          >
            <div
              style="
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 24px;
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
                    font-size: 32px;
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
                  البيانات الحالية المسجلة في النظام مرتبة حسب شيت معدات مزارع السنبلة
                </p>
              </div>

              <div
                style="
                  padding: 12px 15px;
                  border: 1px solid #dbe7df;
                  border-radius: 12px;
                  background: #f8fafc;
                  min-width: 220px;
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
                  padding: 14px;
                  border-radius: 12px;
                  background: #15803d;
                  color: #ffffff;
                "
              >
                <div style="font-size: 12px; font-weight: 700; opacity: .85;">
                  إجمالي التقرير
                </div>

                <div style="margin-top: 3px; font-size: 25px; font-weight: 900;">
                  ${reportAssets.length}
                </div>
              </div>

              <div
                style="
                  padding: 14px;
                  border: 1px solid #dbe7df;
                  border-radius: 12px;
                  background: #f8fafc;
                "
              >
                <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                  معدات
                </div>

                <div style="margin-top: 3px; font-size: 25px; font-weight: 900;">
                  ${equipmentCount}
                </div>
              </div>

              <div
                style="
                  padding: 14px;
                  border: 1px solid #dbe7df;
                  border-radius: 12px;
                  background: #f8fafc;
                "
              >
                <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                  قطع غيار
                </div>

                <div style="margin-top: 3px; font-size: 25px; font-weight: 900;">
                  ${sparePartsCount}
                </div>
              </div>

              <div
                style="
                  padding: 14px;
                  border: 1px solid #dbe7df;
                  border-radius: 12px;
                  background: #f8fafc;
                "
              >
                <div style="color: #64748b; font-size: 12px; font-weight: 700;">
                  أدوات
                </div>

                <div style="margin-top: 3px; font-size: 25px; font-weight: 900;">
                  ${toolsCount}
                </div>
              </div>
            </div>
          </div>
        `)
      );

      const section34 = sections.find((section) => section.number === 34);

      sections
        .filter((section) => section.number !== 34)
        .forEach((section) => {
          reportContainer.appendChild(
            createBlock(`
              <div
                style="
                  margin-top: 22px;
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
                    gap: 16px;
                    padding: 14px 18px;
                    background: #eaf8ef;
                    border-bottom: 1px solid #d7eadc;
                  "
                >
                  <div
                    style="
                      display: flex;
                      align-items: center;
                      gap: 12px;
                    "
                  >
                    <div
                      style="
                        width: 42px;
                        height: 42px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 10px;
                        color: #ffffff;
                        background: #15803d;
                        font-size: 18px;
                        font-weight: 900;
                      "
                    >
                      ${section.number}
                    </div>

                    <div>
                      <div
                        style="
                          color: #15803d;
                          font-size: 11px;
                          font-weight: 800;
                        "
                      >
                        البند رقم ${section.number}
                      </div>

                      <div
                        style="
                          margin-top: 2px;
                          color: #0f172a;
                          font-size: 20px;
                          font-weight: 900;
                        "
                      >
                        ${escapeHtml(section.title)}
                      </div>
                    </div>
                  </div>

                  <div
                    style="
                      min-width: 105px;
                      padding: 8px 12px;
                      border-radius: 10px;
                      background: #ffffff;
                      text-align: center;
                    "
                  >
                    <div
                      style="
                        color: #64748b;
                        font-size: 10px;
                        font-weight: 700;
                      "
                    >
                      العدد الحالي
                    </div>

                    <div
                      style="
                        margin-top: 2px;
                        color: #0f172a;
                        font-size: 20px;
                        font-weight: 900;
                      "
                    >
                      ${section.assets.length}
                    </div>
                  </div>
                </div>

                ${renderAssetTable(section.assets)}
              </div>
            `)
          );
        });

      if (unmatchedAssets.length) {
        reportContainer.appendChild(
          createBlock(`
            <div
              style="
                margin-top: 22px;
                border: 1px solid #f59e0b;
                border-radius: 14px;
                overflow: hidden;
              "
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 16px;
                  padding: 14px 18px;
                  background: #fffbeb;
                  border-bottom: 1px solid #fde68a;
                "
              >
                <div>
                  <div
                    style="
                      color: #b45309;
                      font-size: 11px;
                      font-weight: 800;
                    "
                  >
                    بيانات حالية غير موجودة في ترتيب الشيت القديم
                  </div>

                  <div
                    style="
                      margin-top: 2px;
                      color: #0f172a;
                      font-size: 20px;
                      font-weight: 900;
                    "
                  >
                    أصول أخرى
                  </div>
                </div>

                <div
                  style="
                    min-width: 105px;
                    padding: 8px 12px;
                    border-radius: 10px;
                    background: #ffffff;
                    text-align: center;
                  "
                >
                  <div
                    style="
                      color: #64748b;
                      font-size: 10px;
                      font-weight: 700;
                    "
                  >
                    العدد الحالي
                  </div>

                  <div
                    style="
                      margin-top: 2px;
                      color: #0f172a;
                      font-size: 20px;
                      font-weight: 900;
                    "
                  >
                    ${unmatchedAssets.length}
                  </div>
                </div>
              </div>

              ${renderAssetTable(unmatchedAssets)}
            </div>
          `)
        );
      }

      if (section34) {
        reportContainer.appendChild(
          createBlock(`
            <div
              style="
                margin-top: 22px;
                margin-bottom: 42px;
                border: 2px solid #15803d;
                border-radius: 14px;
                overflow: hidden;
              "
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 16px;
                  padding: 14px 18px;
                  color: #ffffff;
                  background: #15803d;
                  border-bottom: 1px solid #166534;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                  "
                >
                  <div
                    style="
                      width: 42px;
                      height: 42px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      border-radius: 10px;
                      color: #15803d;
                      background: #ffffff;
                      font-size: 18px;
                      font-weight: 900;
                    "
                  >
                    34
                  </div>

                  <div>
                    <div
                      style="
                        font-size: 11px;
                        font-weight: 800;
                        opacity: .85;
                      "
                    >
                      البند رقم 34 والأخير
                    </div>

                    <div
                      style="
                        margin-top: 2px;
                        font-size: 21px;
                        font-weight: 900;
                      "
                    >
                      خزانات المياه
                    </div>
                  </div>
                </div>

                <div
                  style="
                    min-width: 105px;
                    padding: 8px 12px;
                    border-radius: 10px;
                    color: #0f172a;
                    background: #ffffff;
                    text-align: center;
                  "
                >
                  <div
                    style="
                      color: #64748b;
                      font-size: 10px;
                      font-weight: 700;
                    "
                  >
                    العدد الحالي
                  </div>

                  <div
                    style="
                      margin-top: 2px;
                      font-size: 20px;
                      font-weight: 900;
                    "
                  >
                    ${section34.assets.length}
                  </div>
                </div>
              </div>

              ${renderAssetTable(section34.assets)}
            </div>
          `)
        );
      }

      reportContainer.querySelectorAll("th").forEach((th) => {
        th.style.cssText += `
          padding: 9px 6px;
          border: 1px solid #dbe3ea;
          color: #334155;
          font-weight: 900;
          text-align: center;
          vertical-align: middle;
        `;
      });

      reportContainer.querySelectorAll("td").forEach((td) => {
        td.style.cssText += `
          padding: 8px 6px;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          text-align: center;
          vertical-align: middle;
          word-break: break-word;
        `;
      });

      document.body.appendChild(reportContainer);

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(reportContainer, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 1120,
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imageData = canvas.toDataURL("image/jpeg", 0.95);

      const imageWidth = pdfWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;

      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(
        imageData,
        "JPEG",
        0,
        position,
        imageWidth,
        imageHeight,
        undefined,
        "FAST"
      );

      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;

        pdf.addPage();

        pdf.addImage(
          imageData,
          "JPEG",
          0,
          position,
          imageWidth,
          imageHeight,
          undefined,
          "FAST"
        );

        heightLeft -= pdfHeight;
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
      if (reportContainer?.parentNode) {
        reportContainer.parentNode.removeChild(reportContainer);
      }

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

import { getCachedCollection } from "./realtimeCache";
import { calculateAssetsStats } from "./assetsStats";
import {
  getAssetTypeName,
  getPlaceName,
  getAssetCategoryLabel,
} from "./inventory";

const DEFAULT_SUGGESTIONS = [
  "كم عدد كل الأصول؟",
  "اعرض الأصول العاطلة",
  "اعرض الأصول في الورشة",
  "اعرض ملخص النظام",
];

const getCollections = () => ({
  assets: getCachedCollection("cache:assets"),
  assetTypes: getCachedCollection("cache:assetTypes"),
  workers: getCachedCollection("cache:workers"),
  engineers: getCachedCollection("cache:engineers"),
  farms: getCachedCollection("cache:farms"),
  kubras: getCachedCollection("cache:kubras"),
  sprinklers: getCachedCollection("cache:sprinklers"),
  heaps: getCachedCollection("cache:heaps"),
  movements: getCachedCollection("cache:assetMovements"),
});

const result = ({ answer, items = [], suggestions = DEFAULT_SUGGESTIONS }) => ({
  answer,
  items,
  suggestions,
});

const normalize = (value) =>
  String(value || "")
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[؟?!.،,]/g, "")
    .replace(/\s+/g, " ");

const sameQuestion = (a, b) => normalize(a) === normalize(b);

const getValue = (...values) =>
  values.find((value) => String(value || "").trim()) || "";

const getAssetPlaceType = (asset) =>
  getValue(asset.placeType, asset.currentPlace?.type);

const getAssetPlaceId = (asset) =>
  getValue(asset.placeId, asset.farmId, asset.kubraId, asset.currentPlace?.id);

const getAssetTitle = (asset) =>
  getValue(asset.name, asset.assetName, asset.code) || "أصل بدون اسم";

const getAssetHref = (asset) => `/assets/${asset.id}`;

const isAssetInFarm = (asset) =>
  getAssetPlaceType(asset) === "farm" || Boolean(asset.farmId);

const isAssetInKubra = (asset) =>
  getAssetPlaceType(asset) === "kubra" || Boolean(asset.kubraId);

const isAssetInWorkshop = (asset) =>
  asset.status === "في الورشة" ||
  getAssetPlaceType(asset) === "external_workshop" ||
  normalize(getPlaceName(asset)).includes("ورشه") ||
  normalize(asset.externalWorkshopName).includes("ورشه");

const isAssetBroken = (asset) => asset.status === "عاطل";
const isAssetGood = (asset) => asset.status === "صالح";

const mapAsset = (asset) => ({
  title: getAssetTitle(asset),
  subtitle: `${getAssetTypeName(asset)} - ${getPlaceName(asset)} - ${
    asset.status || "حالة غير محددة"
  }`,
  href: getAssetHref(asset),
});

const mapWorker = (worker) => ({
  title: worker.name || "عامل بدون اسم",
  subtitle: worker.phone || worker.nationality || "لا توجد بيانات إضافية",
  href: `/workers/${worker.id}`,
});

const mapEngineer = (engineer) => ({
  title: engineer.name || "مهندس بدون اسم",
  subtitle: engineer.phone || "لا توجد بيانات إضافية",
  href: `/engineers/${engineer.id}`,
});

const mapFarm = (farm) => ({
  title: farm.name || "مزرعة بدون اسم",
  subtitle: farm.managerName || farm.engineerNames || "لا توجد بيانات إضافية",
  href: `/farms/${farm.id}`,
});

const mapKubra = (kubra) => ({
  title: kubra.name || "كِبرة بدون اسم",
  subtitle: kubra.notes || "اضغط للعرض",
  href: `/kubras/${kubra.id}`,
});

const mapSprinkler = (sprinkler) => ({
  title: sprinkler.name || sprinkler.sprinklerName || "رشاش بدون اسم",
  subtitle: `${sprinkler.farmName || "مزرعة غير محددة"} - ${
    sprinkler.workerName || "بدون عامل"
  } - ${sprinkler.cropType || "نوع غير محدد"}`,
  href: `/sprinklers/${sprinkler.id}`,
});

const mapHeap = (heap) => ({
  title: heap.pileName || "كوم بدون اسم",
  subtitle: `${heap.farmName || "مزرعة غير محددة"} - ${
    heap.cropType || "نوع غير محدد"
  } - ${Number(heap.bricksCount || 0)} لبنة`,
  href: `/heaps/${heap.id}`,
});

const openPage = (title, href) =>
  result({
    answer: `افتح ${title} من الرابط التالي.`,
    items: [{ title, subtitle: "اضغط للانتقال للصفحة", href }],
    suggestions: [],
  });

const groupCount = (items, getKey) => {
  const map = {};

  items.forEach((item) => {
    const label = getKey(item) || "غير محدد";
    if (!map[label]) map[label] = { label, count: 0 };
    map[label].count += 1;
  });

  return Object.values(map).sort((a, b) => b.count - a.count);
};

const mapGroupRows = (rows, unit, href) =>
  rows.slice(0, 12).map((row) => ({
    title: row.label,
    subtitle: `${row.count} ${unit}`,
    href,
  }));

const getOfflineQueueCount = () => {
  if (typeof window === "undefined") return 0;

  try {
    const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
    return Array.isArray(queue) ? queue.length : 0;
  } catch {
    return 0;
  }
};

const getAssetsByWorker = (assets, workerId) =>
  assets.filter((asset) => {
    if ((asset.workerIds || []).includes(workerId)) return true;

    if (Array.isArray(asset.workers)) {
      return asset.workers.some((worker) => worker.id === workerId);
    }

    return false;
  });

const getFarmAssets = (assets, farm) =>
  assets.filter(
    (asset) =>
      asset.farmId === farm.id ||
      asset.placeId === farm.id ||
      (isAssetInFarm(asset) && asset.farmName === farm.name)
  );

const getKubraAssets = (assets, kubra) =>
  assets.filter(
    (asset) =>
      asset.kubraId === kubra.id ||
      asset.placeId === kubra.id ||
      (isAssetInKubra(asset) && asset.kubraName === kubra.name)
  );

const getFarmSprinklers = (sprinklers, farm) =>
  sprinklers.filter(
    (sprinkler) => sprinkler.farmId === farm.id || sprinkler.farmName === farm.name
  );

const getFarmHeaps = (heaps, farm) =>
  heaps.filter((heap) => heap.farmId === farm.id || heap.farmName === farm.name);

const systemSummary = (data) => {
  const stats = calculateAssetsStats(data.assets);
  const totalBricks = data.heaps.reduce(
    (sum, heap) => sum + Number(heap.bricksCount || 0),
    0
  );
  const pending = getOfflineQueueCount();

  return result({
    answer: `ملخص النظام: ${stats.total} أصل، ${stats.good} صالح، ${stats.broken} عاطل، ${stats.inWorkshop} في الورشة، ${data.workers.length} عامل، ${data.farms.length} مزرعة، ${data.kubras.length} كِبرة، ${data.sprinklers.length} رشاش، ${data.heaps.length} كوم، وإجمالي اللبن ${totalBricks}. العمليات المنتظرة للمزامنة: ${pending}.`,
    items: [
      { title: "صفحة التقارير", subtitle: "عرض التقارير كاملة", href: "/reports" },
      { title: "صفحة التحليلات", subtitle: "عرض الرسومات والتحليلات", href: "/analytics" },
    ],
  });
};

const actions = {
  "كم عدد كل الأصول؟": (data) => {
    const stats = calculateAssetsStats(data.assets);

    return result({
      answer: `إجمالي عدد الأصول والعهد: ${stats.total}. الصالح ${stats.good}، العاطل ${stats.broken}، في الورشة ${stats.inWorkshop}.`,
      items: [
        { title: "كل الأصول", subtitle: `${stats.total} أصل`, href: "/assets" },
        { title: "الأصول العاطلة", subtitle: `${stats.broken} أصل`, href: "/assets?status=عاطل" },
        { title: "الأصول في الورشة", subtitle: `${stats.inWorkshop} أصل`, href: "/assets?status=في الورشة" },
      ],
    });
  },

  "اعرض الأصول العاطلة": (data) => {
    const list = data.assets.filter(isAssetBroken);
    return result({
      answer: `عدد الأصول العاطلة: ${list.length}.`,
      items: list.slice(0, 12).map(mapAsset),
    });
  },

  "اعرض الأصول في الورشة": (data) => {
    const list = data.assets.filter(isAssetInWorkshop);
    return result({
      answer: `عدد الأصول في الورشة: ${list.length}.`,
      items: list.slice(0, 12).map(mapAsset),
    });
  },

  "اعرض الأصول الصالحة": (data) => {
    const list = data.assets.filter(isAssetGood);
    return result({
      answer: `عدد الأصول الصالحة: ${list.length}.`,
      items: list.slice(0, 12).map(mapAsset),
    });
  },

  "اعرض الأصول داخل المزارع": (data) => {
    const list = data.assets.filter(isAssetInFarm);
    return result({
      answer: `عدد الأصول داخل المزارع: ${list.length}.`,
      items: list.slice(0, 12).map(mapAsset),
    });
  },

  "اعرض الأصول داخل الكِبر": (data) => {
    const list = data.assets.filter(isAssetInKubra);
    return result({
      answer: `عدد الأصول داخل الكِبر: ${list.length}.`,
      items: list.slice(0, 12).map(mapAsset),
    });
  },

  "افتح صفحة الأصول": () => openPage("صفحة الأصول والعهد", "/assets"),

  "كم عدد العمال؟": (data) =>
    result({
      answer: `عدد العمال المسجلين: ${data.workers.length}.`,
      items: data.workers.slice(0, 12).map(mapWorker),
    }),

  "اعرض العمال": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.workers.length, 12)} عامل.`,
      items: data.workers.slice(0, 12).map(mapWorker),
    }),

  "مين أكثر عامل ماسك عهد؟": (data) => {
    const rows = data.workers
      .map((worker) => ({
        worker,
        count: getAssetsByWorker(data.assets, worker.id).length,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);

    if (!rows.length) {
      return result({ answer: "لا يوجد عمال مرتبطون بعهد حاليًا." });
    }

    return result({
      answer: `أكثر عامل ماسك عهد هو ${rows[0].worker.name || "بدون اسم"} بعدد ${rows[0].count} أصل.`,
      items: rows.slice(0, 12).map((row) => ({
        title: row.worker.name || "عامل بدون اسم",
        subtitle: `${row.count} أصل مرتبط`,
        href: `/workers/${row.worker.id}`,
      })),
    });
  },

  "افتح صفحة العمال": () => openPage("صفحة العمال", "/workers"),

  "كم عدد المزارع؟": (data) =>
    result({
      answer: `عدد المزارع المسجلة: ${data.farms.length}.`,
      items: data.farms.slice(0, 12).map(mapFarm),
    }),

  "اعرض المزارع": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.farms.length, 12)} مزرعة.`,
      items: data.farms.slice(0, 12).map(mapFarm),
    }),

  "اعرض المزارع وعدد الأصول": (data) => {
    const rows = data.farms
      .map((farm) => ({ farm, count: getFarmAssets(data.assets, farm).length }))
      .sort((a, b) => b.count - a.count);

    return result({
      answer: "ترتيب المزارع حسب عدد الأصول.",
      items: rows.slice(0, 12).map((row) => ({
        title: row.farm.name || "مزرعة بدون اسم",
        subtitle: `${row.count} أصل`,
        href: `/assets?farmId=${row.farm.id}`,
      })),
    });
  },

  "اعرض المزارع وعدد الرشاشات": (data) => {
    const rows = data.farms
      .map((farm) => ({ farm, count: getFarmSprinklers(data.sprinklers, farm).length }))
      .sort((a, b) => b.count - a.count);

    return result({
      answer: "ترتيب المزارع حسب عدد الرشاشات.",
      items: rows.slice(0, 12).map((row) => ({
        title: row.farm.name || "مزرعة بدون اسم",
        subtitle: `${row.count} رشاش`,
        href: "/sprinklers",
      })),
    });
  },

  "افتح صفحة المزارع": () => openPage("صفحة المزارع", "/farms"),

  "كم عدد الكِبر؟": (data) =>
    result({
      answer: `عدد الكِبر المسجلة: ${data.kubras.length}.`,
      items: data.kubras.slice(0, 12).map(mapKubra),
    }),

  "اعرض الكِبر": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.kubras.length, 12)} كِبرة.`,
      items: data.kubras.slice(0, 12).map(mapKubra),
    }),

  "اعرض الكِبر وعدد الأصول": (data) => {
    const rows = data.kubras
      .map((kubra) => ({ kubra, count: getKubraAssets(data.assets, kubra).length }))
      .sort((a, b) => b.count - a.count);

    return result({
      answer: "ترتيب الكِبر حسب عدد الأصول.",
      items: rows.slice(0, 12).map((row) => ({
        title: row.kubra.name || "كِبرة بدون اسم",
        subtitle: `${row.count} أصل`,
        href: `/assets?kubraId=${row.kubra.id}`,
      })),
    });
  },

  "افتح صفحة الكِبر": () => openPage("صفحة الكِبر", "/kubras"),

  "كم عدد الرشاشات؟": (data) =>
    result({
      answer: `إجمالي عدد الرشاشات: ${data.sprinklers.length}.`,
      items: data.sprinklers.slice(0, 12).map(mapSprinkler),
    }),

  "اعرض الرشاشات": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.sprinklers.length, 12)} رشاش.`,
      items: data.sprinklers.slice(0, 12).map(mapSprinkler),
    }),

  "اعرض الرشاشات بدون عامل": (data) => {
    const list = data.sprinklers.filter(
      (sprinkler) => !sprinkler.workerId && !sprinkler.workerName
    );

    return result({
      answer: `عدد الرشاشات بدون عامل: ${list.length}.`,
      items: list.slice(0, 12).map(mapSprinkler),
    });
  },

  "اعرض الرشاشات حسب المزرعة": (data) =>
    result({
      answer: "توزيع الرشاشات حسب المزرعة.",
      items: mapGroupRows(
        groupCount(data.sprinklers, (sprinkler) => sprinkler.farmName),
        "رشاش",
        "/sprinklers"
      ),
    }),

  "اعرض الرشاشات حسب نوع المحصول": (data) =>
    result({
      answer: "توزيع الرشاشات حسب نوع المحصول.",
      items: mapGroupRows(
        groupCount(data.sprinklers, (sprinkler) => sprinkler.cropType),
        "رشاش",
        "/sprinklers"
      ),
    }),

  "افتح صفحة الرشاشات": () => openPage("صفحة الرشاشات", "/sprinklers"),

  "كم عدد الأكوام؟": (data) =>
    result({
      answer: `إجمالي عدد الأكوام: ${data.heaps.length}.`,
      items: data.heaps.slice(0, 12).map(mapHeap),
    }),

  "كم إجمالي عدد اللبن؟": (data) => {
    const total = data.heaps.reduce(
      (sum, heap) => sum + Number(heap.bricksCount || 0),
      0
    );

    return result({
      answer: `إجمالي عدد اللبن في كل الأكوام: ${total} لبنة.`,
      items: data.heaps.slice(0, 12).map(mapHeap),
    });
  },

  "اعرض الأكوام": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.heaps.length, 12)} كوم.`,
      items: data.heaps.slice(0, 12).map(mapHeap),
    }),

  "اعرض الأكوام حسب المزرعة": (data) =>
    result({
      answer: "توزيع الأكوام حسب المزرعة.",
      items: mapGroupRows(
        groupCount(data.heaps, (heap) => heap.farmName),
        "كوم",
        "/heaps"
      ),
    }),

  "اعرض الأكوام حسب نوع المحصول": (data) =>
    result({
      answer: "توزيع الأكوام حسب نوع المحصول.",
      items: mapGroupRows(
        groupCount(data.heaps, (heap) => heap.cropType),
        "كوم",
        "/heaps"
      ),
    }),

  "افتح صفحة الأكوام": () => openPage("صفحة الأكوام", "/heaps"),

  "افتح التقارير": () => openPage("صفحة التقارير", "/reports"),
  "افتح التحليلات": () => openPage("صفحة التحليلات", "/analytics"),

  "اعرض ملخص النظام": (data) => systemSummary(data),

  "اعرض ملخص الأصول": (data) => {
    const stats = calculateAssetsStats(data.assets);

    return result({
      answer: `ملخص الأصول: الإجمالي ${stats.total}، الصالح ${stats.good}، العاطل ${stats.broken}، في الورشة ${stats.inWorkshop}، معدات ${stats.equipment}، قطع غيار ${stats.spareParts}، أدوات ${stats.tools}، مواد ${stats.materials}، داخل المزارع ${stats.inFarms}، داخل الكِبر ${stats.inKubras}.`,
      items: [
        { title: "كل الأصول", subtitle: `${stats.total} أصل`, href: "/assets" },
        { title: "الأصول العاطلة", subtitle: `${stats.broken} أصل`, href: "/assets?status=عاطل" },
        { title: "الأصول في الورشة", subtitle: `${stats.inWorkshop} أصل`, href: "/assets/workshop" },
      ],
    });
  },

  "هل يوجد عمليات تنتظر المزامنة؟": () => {
    const count = getOfflineQueueCount();

    return result({
      answer: count
        ? `يوجد ${count} عملية تنتظر المزامنة. سيتم رفعها عند عودة الاتصال.`
        : "لا توجد عمليات تنتظر المزامنة حاليًا.",
      suggestions: [],
    });
  },

  "اشرح الأوفلاين": () =>
    result({
      answer:
        "الأوفلاين يسمح بعرض آخر بيانات محفوظة وتنفيذ العمليات محليًا. عند عودة الاتصال تتم المزامنة تلقائيًا من قائمة العمليات المنتظرة.",
      suggestions: [],
    }),
};

const fallback = () =>
  result({
    answer:
      "اختار قسم من الأعلى ثم اختار سؤال جاهز عشان أديك إجابة دقيقة من بيانات النظام.",
    suggestions: [],
  });

export const askSmartAssistant = (message) => {
  const question = String(message || "").trim();
  const data = getCollections();

  if (!question) return fallback();

  const directKey = Object.keys(actions).find((key) => sameQuestion(key, question));

  if (directKey) {
    return actions[directKey](data);
  }

  return fallback();
};

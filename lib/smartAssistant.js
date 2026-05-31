import { getCachedCollection } from "./realtimeCache";

const getCollections = () => ({
  assets: getCachedCollection("cache:assets"),
  workers: getCachedCollection("cache:workers"),
  engineers: getCachedCollection("cache:engineers"),
  farms: getCachedCollection("cache:farms"),
  kubras: getCachedCollection("cache:kubras"),
  sprinklers: getCachedCollection("cache:sprinklers"),
  heaps: getCachedCollection("cache:heaps"),
});

const result = ({ answer, items = [], suggestions = [] }) => ({
  answer,
  items,
  suggestions,
});

const normalize = (value) =>
  String(value || "")
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");

const isWorkshopAsset = (asset) => {
  const status = normalize(asset.status);
  const placeType = normalize(asset.placeType);
  const placeName = normalize(asset.placeName);
  const workshopName = normalize(asset.externalWorkshopName);

  return (
    status.includes("ورشه") ||
    placeType === "external_workshop" ||
    placeType.includes("workshop") ||
    placeName.includes("ورشه") ||
    workshopName.length > 0
  );
};

const isBrokenAsset = (asset) => {
  const status = normalize(asset.status);
  return status.includes("عاطل");
};

const isGoodAsset = (asset) => {
  const status = normalize(asset.status);
  return status.includes("صالح");
};

const getAssetTitle = (asset) =>
  asset.name || asset.assetName || asset.code || "أصل بدون اسم";

const getAssetPlaceName = (asset) =>
  asset.placeName ||
  asset.farmName ||
  asset.kubraName ||
  asset.externalWorkshopName ||
  asset.currentPlace?.name ||
  "مكان غير محدد";

const mapAsset = (asset) => ({
  title: getAssetTitle(asset),
  subtitle: `${asset.assetTypeName || "نوع غير محدد"} - ${getAssetPlaceName(
    asset
  )} - ${asset.status || "حالة غير محددة"}`,
  href: `/assets/${asset.id}`,
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
  } - ${heap.bricksCount || 0} لبنة`,
  href: `/heaps/${heap.id}`,
});

const openPage = (title, href) =>
  result({
    answer: `افتح ${title} من الرابط التالي.`,
    items: [
      {
        title,
        subtitle: "اضغط للانتقال للصفحة",
        href,
      },
    ],
  });

const countBy = (items, getKey, hrefBuilder) => {
  const map = {};

  items.forEach((item) => {
    const label = getKey(item) || "غير محدد";

    if (!map[label]) {
      map[label] = {
        label,
        count: 0,
        href: hrefBuilder ? hrefBuilder(item, label) : "#",
      };
    }

    map[label].count += 1;
  });

  return Object.values(map).sort((a, b) => b.count - a.count);
};

const groupItemsToLinks = (rows, unit = "عنصر") =>
  rows.slice(0, 10).map((row) => ({
    title: row.label,
    subtitle: `${row.count} ${unit}`,
    href: row.href || "#",
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

const getSystemSummary = (data) => {
  const broken = data.assets.filter(isBrokenAsset).length;
  const workshop = data.assets.filter(isWorkshopAsset).length;
  const good = data.assets.filter(isGoodAsset).length;
  const totalBricks = data.heaps.reduce(
    (sum, heap) => sum + Number(heap.bricksCount || 0),
    0
  );

  return result({
    answer: `ملخص النظام: ${data.assets.length} أصل، ${good} صالح، ${broken} عاطل، ${workshop} في الورشة، ${data.workers.length} عامل، ${data.farms.length} مزرعة، ${data.sprinklers.length} رشاش، ${data.heaps.length} كوم، وإجمالي اللبن ${totalBricks}.`,
    items: [
      { title: "صفحة التقارير", subtitle: "عرض التقارير كاملة", href: "/reports" },
      { title: "صفحة التحليلات", subtitle: "عرض الرسومات والتحليلات", href: "/analytics" },
    ],
  });
};

const actions = {
  "كم عدد كل الأصول؟": (data) =>
    result({
      answer: `إجمالي عدد الأصول والعهد المسجلة: ${data.assets.length}.`,
      items: [
        { title: "فتح صفحة الأصول", subtitle: "عرض كل الأصول", href: "/assets" },
      ],
    }),

  "اعرض الأصول العاطلة": (data) => {
    const list = data.assets.filter(isBrokenAsset);

    return result({
      answer: `عدد الأصول العاطلة: ${list.length}.`,
      items: list.slice(0, 10).map(mapAsset),
    });
  },

  "اعرض الأصول في الورشة": (data) => {
    const list = data.assets.filter(isWorkshopAsset);

    return result({
      answer: `عدد الأصول في الورشة: ${list.length}.`,
      items: list.slice(0, 10).map(mapAsset),
    });
  },

  "اعرض الأصول الصالحة": (data) => {
    const list = data.assets.filter(isGoodAsset);

    return result({
      answer: `عدد الأصول الصالحة: ${list.length}.`,
      items: list.slice(0, 10).map(mapAsset),
    });
  },

  "اعرض الأصول داخل المزارع": (data) => {
    const list = data.assets.filter(
      (asset) =>
        asset.placeType === "farm" ||
        asset.farmId ||
        normalize(asset.placeName).includes("مزرعه")
    );

    return result({
      answer: `عدد الأصول داخل المزارع: ${list.length}.`,
      items: list.slice(0, 10).map(mapAsset),
    });
  },

  "اعرض الأصول داخل الكِبر": (data) => {
    const list = data.assets.filter(
      (asset) =>
        asset.placeType === "kubra" ||
        asset.kubraId ||
        normalize(asset.placeName).includes("كبر")
    );

    return result({
      answer: `عدد الأصول داخل الكِبر: ${list.length}.`,
      items: list.slice(0, 10).map(mapAsset),
    });
  },

  "افتح صفحة الأصول": () => openPage("صفحة الأصول والعهد", "/assets"),

  "كم عدد العمال؟": (data) =>
    result({
      answer: `عدد العمال المسجلين: ${data.workers.length}.`,
      items: data.workers.slice(0, 10).map(mapWorker),
    }),

  "اعرض العمال": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.workers.length, 10)} عمال.`,
      items: data.workers.slice(0, 10).map(mapWorker),
    }),

  "مين أكثر عامل ماسك عهد؟": (data) => {
    const rows = data.workers
      .map((worker) => {
        const count = data.assets.filter((asset) =>
          (asset.workerIds || []).includes(worker.id)
        ).length;

        return {
          worker,
          count,
        };
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);

    if (!rows.length) {
      return result({
        answer: "لا يوجد عمال مرتبطون بعهد حاليًا.",
      });
    }

    return result({
      answer: `أكثر عامل ماسك عهد هو ${rows[0].worker.name} بعدد ${rows[0].count} أصل.`,
      items: rows.slice(0, 10).map((row) => ({
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
      items: data.farms.slice(0, 10).map(mapFarm),
    }),

  "اعرض المزارع": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.farms.length, 10)} مزارع.`,
      items: data.farms.slice(0, 10).map(mapFarm),
    }),

  "اعرض المزارع وعدد الأصول": (data) => {
    const rows = data.farms
      .map((farm) => ({
        farm,
        count: data.assets.filter(
          (asset) => asset.farmId === farm.id || asset.placeId === farm.id
        ).length,
      }))
      .sort((a, b) => b.count - a.count);

    return result({
      answer: "ترتيب المزارع حسب عدد الأصول.",
      items: rows.slice(0, 10).map((row) => ({
        title: row.farm.name || "مزرعة بدون اسم",
        subtitle: `${row.count} أصل`,
        href: `/farms/${row.farm.id}`,
      })),
    });
  },

  "اعرض المزارع وعدد الرشاشات": (data) => {
    const rows = data.farms
      .map((farm) => ({
        farm,
        count: data.sprinklers.filter(
          (sprinkler) => sprinkler.farmName === farm.name
        ).length,
      }))
      .sort((a, b) => b.count - a.count);

    return result({
      answer: "ترتيب المزارع حسب عدد الرشاشات.",
      items: rows.slice(0, 10).map((row) => ({
        title: row.farm.name || "مزرعة بدون اسم",
        subtitle: `${row.count} رشاش`,
        href: `/farms/${row.farm.id}`,
      })),
    });
  },

  "افتح صفحة المزارع": () => openPage("صفحة المزارع", "/farms"),

  "كم عدد الكِبر؟": (data) =>
    result({
      answer: `عدد الكِبر المسجلة: ${data.kubras.length}.`,
      items: data.kubras.slice(0, 10).map(mapKubra),
    }),

  "اعرض الكِبر": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.kubras.length, 10)} كِبر.`,
      items: data.kubras.slice(0, 10).map(mapKubra),
    }),

  "اعرض الكِبر وعدد الأصول": (data) => {
    const rows = data.kubras
      .map((kubra) => ({
        kubra,
        count: data.assets.filter(
          (asset) => asset.kubraId === kubra.id || asset.placeId === kubra.id
        ).length,
      }))
      .sort((a, b) => b.count - a.count);

    return result({
      answer: "ترتيب الكِبر حسب عدد الأصول.",
      items: rows.slice(0, 10).map((row) => ({
        title: row.kubra.name || "كِبرة بدون اسم",
        subtitle: `${row.count} أصل`,
        href: `/kubras/${row.kubra.id}`,
      })),
    });
  },

  "افتح صفحة الكِبر": () => openPage("صفحة الكِبر", "/kubras"),

  "كم عدد الرشاشات؟": (data) =>
    result({
      answer: `إجمالي عدد الرشاشات: ${data.sprinklers.length}.`,
      items: data.sprinklers.slice(0, 10).map(mapSprinkler),
    }),

  "اعرض الرشاشات": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.sprinklers.length, 10)} رشاشات.`,
      items: data.sprinklers.slice(0, 10).map(mapSprinkler),
    }),

  "اعرض الرشاشات بدون عامل": (data) => {
    const list = data.sprinklers.filter(
      (sprinkler) => !sprinkler.workerId && !sprinkler.workerName
    );

    return result({
      answer: `عدد الرشاشات بدون عامل: ${list.length}.`,
      items: list.slice(0, 10).map(mapSprinkler),
    });
  },

  "اعرض الرشاشات حسب المزرعة": (data) => {
    const rows = countBy(
      data.sprinklers,
      (sprinkler) => sprinkler.farmName || "غير محدد",
      () => "/sprinklers"
    );

    return result({
      answer: "توزيع الرشاشات حسب المزرعة.",
      items: groupItemsToLinks(rows, "رشاش"),
    });
  },

  "اعرض الرشاشات حسب نوع المحصول": (data) => {
    const rows = countBy(
      data.sprinklers,
      (sprinkler) => sprinkler.cropType || "غير محدد",
      () => "/sprinklers"
    );

    return result({
      answer: "توزيع الرشاشات حسب نوع المحصول.",
      items: groupItemsToLinks(rows, "رشاش"),
    });
  },

  "افتح صفحة الرشاشات": () => openPage("صفحة الرشاشات", "/sprinklers"),

  "كم عدد الأكوام؟": (data) =>
    result({
      answer: `إجمالي عدد الأكوام: ${data.heaps.length}.`,
      items: data.heaps.slice(0, 10).map(mapHeap),
    }),

  "كم إجمالي عدد اللبن؟": (data) => {
    const total = data.heaps.reduce(
      (sum, heap) => sum + Number(heap.bricksCount || 0),
      0
    );

    return result({
      answer: `إجمالي عدد اللبن في كل الأكوام: ${total} لبنة.`,
      items: data.heaps.slice(0, 10).map(mapHeap),
    });
  },

  "اعرض الأكوام": (data) =>
    result({
      answer: `قائمة بأول ${Math.min(data.heaps.length, 10)} أكوام.`,
      items: data.heaps.slice(0, 10).map(mapHeap),
    }),

  "اعرض الأكوام حسب المزرعة": (data) => {
    const rows = countBy(
      data.heaps,
      (heap) => heap.farmName || "غير محدد",
      () => "/heaps"
    );

    return result({
      answer: "توزيع الأكوام حسب المزرعة.",
      items: groupItemsToLinks(rows, "كوم"),
    });
  },

  "اعرض الأكوام حسب نوع المحصول": (data) => {
    const rows = countBy(
      data.heaps,
      (heap) => heap.cropType || "غير محدد",
      () => "/heaps"
    );

    return result({
      answer: "توزيع الأكوام حسب نوع المحصول.",
      items: groupItemsToLinks(rows, "كوم"),
    });
  },

  "افتح صفحة الأكوام": () => openPage("صفحة الأكوام", "/heaps"),

  "افتح التقارير": () => openPage("صفحة التقارير", "/reports"),

  "افتح التحليلات": () => openPage("صفحة التحليلات", "/analytics"),

  "اعرض ملخص النظام": (data) => getSystemSummary(data),

  "اعرض ملخص الأصول": (data) => {
    const good = data.assets.filter(isGoodAsset).length;
    const broken = data.assets.filter(isBrokenAsset).length;
    const workshop = data.assets.filter(isWorkshopAsset).length;

    return result({
      answer: `ملخص الأصول: الإجمالي ${data.assets.length}، الصالح ${good}، العاطل ${broken}، في الورشة ${workshop}.`,
      items: [
        { title: "كل الأصول", subtitle: `${data.assets.length} أصل`, href: "/assets" },
        { title: "الأصول في الورشة", subtitle: `${workshop} أصل`, href: "/assets/workshop" },
      ],
    });
  },

  "هل يوجد عمليات تنتظر المزامنة؟": () => {
    const count = getOfflineQueueCount();

    return result({
      answer: count
        ? `يوجد ${count} عملية تنتظر المزامنة. سيتم رفعها عند عودة الاتصال.`
        : "لا توجد عمليات تنتظر المزامنة حاليًا.",
    });
  },

  "اشرح الأوفلاين": () =>
    result({
      answer:
        "الأوفلاين يسمح لك بعرض آخر بيانات محفوظة وتنفيذ بعض العمليات محليًا. عند عودة الاتصال يتم رفع العمليات المنتظرة تلقائيًا.",
    }),

  "افتح الإعدادات": () => openPage("صفحة الإعدادات", "/settings"),
};

const fallback = () =>
  result({
    answer:
      "عشان أديك إجابة دقيقة، اختار قسم من الأعلى ثم اختار سؤال من الأسئلة الجاهزة.",
    suggestions: [
      "كم عدد كل الأصول؟",
      "اعرض الأصول العاطلة",
      "كم عدد العمال؟",
      "اعرض ملخص النظام",
    ],
  });

export const askSmartAssistant = (message) => {
  const question = String(message || "").trim();
  const data = getCollections();

  if (!question) return fallback();

  const exactAction = actions[question];

  if (exactAction) {
    return exactAction(data);
  }

  const normalizedQuestion = normalize(question);

  const matchedKey = Object.keys(actions).find(
    (key) => normalize(key) === normalizedQuestion
  );

  if (matchedKey) {
    return actions[matchedKey](data);
  }

  return fallback();
};

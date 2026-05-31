import { getCachedCollection } from "./realtimeCache";

const DEFAULT_SUGGESTIONS = [
  "اعرض الأصول العاطلة",
  "كام أصل في الورشة؟",
  "فين مكينة 605؟",
  "مين مسئول مزرعة؟",
  "اعرض رشاشات مزرعة",
  "كام كوم برسيم؟",
];

const STOP_WORDS = [
  "فين",
  "أين",
  "اين",
  "مكان",
  "موجود",
  "موجودة",
  "كام",
  "كم",
  "عدد",
  "اعرض",
  "عرض",
  "هات",
  "وريني",
  "افتح",
  "روح",
  "الى",
  "إلى",
  "في",
  "من",
  "على",
  "عن",
  "هو",
  "هي",
  "ده",
  "دي",
  "دا",
  "اللي",
  "بتاع",
  "بتاعة",
  "المسجل",
  "المسجلة",
  "عندي",
  "كل",
  "ايه",
  "إيه",
  "ما",
  "هل",
];

const ENTITY_KEYWORDS = {
  assets: ["اصل", "أصل", "اصول", "أصول", "عهد", "عهدة", "معدة", "معدات", "مكينه", "مكينة", "ماكينة", "اله", "آلة", "دينمو", "جرار"],
  workers: ["عامل", "عمال", "العامل"],
  engineers: ["مهندس", "مهندسين", "المهندس"],
  farms: ["مزرعة", "مزارع", "المزرعة"],
  kubras: ["كبرة", "كِبرة", "كبر", "الكبر", "الكِبر"],
  sprinklers: ["رشاش", "رشاشات", "الرشاش"],
  heaps: ["كوم", "اكوام", "أكوام", "الكوم", "لبن", "لبنة"],
};

const normalizeArabic = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) =>
  normalizeArabic(value)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x && !STOP_WORDS.includes(x) && x.length > 1);

const includesText = (value, keyword) =>
  normalizeArabic(value).includes(normalizeArabic(keyword));

const getCollections = () => ({
  assets: getCachedCollection("cache:assets"),
  workers: getCachedCollection("cache:workers"),
  engineers: getCachedCollection("cache:engineers"),
  farms: getCachedCollection("cache:farms"),
  kubras: getCachedCollection("cache:kubras"),
  sprinklers: getCachedCollection("cache:sprinklers"),
  heaps: getCachedCollection("cache:heaps"),
});

const result = ({ answer, items = [], suggestions = DEFAULT_SUGGESTIONS }) => ({
  answer,
  items,
  suggestions,
});

const detectIntent = (text) => {
  const value = normalizeArabic(text);

  if (
    value.includes("فين") ||
    value.includes("اين") ||
    value.includes("مكان") ||
    value.includes("موجود") ||
    value.includes("موجوده")
  ) {
    return "location";
  }

  if (
    value.includes("كام") ||
    value.includes("كم") ||
    value.includes("عدد") ||
    value.includes("اجمالي") ||
    value.includes("إجمالي")
  ) {
    return "count";
  }

  if (
    value.includes("مين") ||
    value.includes("من ") ||
    value.includes("مسؤول") ||
    value.includes("مسئول") ||
    value.includes("ماسك") ||
    value.includes("مستلم")
  ) {
    return "owner";
  }

  if (
    value.includes("اعرض") ||
    value.includes("هات") ||
    value.includes("وريني") ||
    value.includes("افتح") ||
    value.includes("روح")
  ) {
    return "list";
  }

  return "search";
};

const detectEntity = (text) => {
  const value = normalizeArabic(text);

  const scores = Object.entries(ENTITY_KEYWORDS).map(([entity, words]) => {
    const score = words.reduce((sum, word) => {
      return value.includes(normalizeArabic(word)) ? sum + 1 : sum;
    }, 0);

    return { entity, score };
  });

  const best = scores.sort((a, b) => b.score - a.score)[0];

  return best?.score > 0 ? best.entity : "all";
};

const getAssetPlaceName = (asset) =>
  asset.placeName ||
  asset.farmName ||
  asset.kubraName ||
  asset.externalWorkshopName ||
  asset.currentPlace?.name ||
  "مكان غير محدد";

const getAssetPlaceType = (asset) => {
  if (asset.placeType === "farm") return "مزرعة";
  if (asset.placeType === "kubra") return "كِبرة";
  if (asset.placeType === "external_workshop") return "ورشة خارجية";
  return "غير محدد";
};

const getAssetTitle = (asset) =>
  asset.name || asset.assetName || asset.code || "أصل بدون اسم";

const scoreItem = ({ text, tokens, item, fields }) => {
  const normalizedText = normalizeArabic(text);

  let score = 0;
  const details = [];

  fields.forEach(({ key, weight = 1 }) => {
    const rawValue = item[key];
    const value = normalizeArabic(rawValue);

    if (!value) return;

    if (value === normalizedText) {
      score += 120 * weight;
      details.push(key);
      return;
    }

    if (value.startsWith(normalizedText)) {
      score += 80 * weight;
      details.push(key);
      return;
    }

    if (value.includes(normalizedText)) {
      score += 55 * weight;
      details.push(key);
    }

    tokens.forEach((token) => {
      if (value === token) score += 35 * weight;
      else if (value.startsWith(token)) score += 22 * weight;
      else if (value.includes(token)) score += 12 * weight;
    });
  });

  const numericTokens = tokens.filter((token) => /\d/.test(token));

  numericTokens.forEach((token) => {
    fields.forEach(({ key, weight = 1 }) => {
      const value = normalizeArabic(item[key]);

      if (value.includes(token)) {
        score += 35 * weight;
      }
    });
  });

  return { score, details };
};

const rankItems = ({ text, items, fields, mapItem, limit = 8 }) => {
  const tokens = tokenize(text);

  return items
    .map((item) => {
      const { score } = scoreItem({ text, tokens, item, fields });
      return {
        item,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => mapItem(item));
};

const countBy = (items, getKey) => {
  const map = {};

  items.forEach((item) => {
    const key = getKey(item) || "غير محدد";

    if (!map[key]) {
      map[key] = {
        label: key,
        count: 0,
      };
    }

    map[key].count += 1;
  });

  return Object.values(map).sort((a, b) => b.count - a.count);
};

const findFarmInText = (text, farms) => {
  const tokens = tokenize(text);
  const ranked = farms
    .map((farm) => {
      const { score } = scoreItem({
        text,
        tokens,
        item: farm,
        fields: [
          { key: "name", weight: 3 },
          { key: "managerName", weight: 1 },
          { key: "engineerNames", weight: 1 },
        ],
      });

      return { farm, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.farm || null;
};

const findWorkerInText = (text, workers) => {
  const tokens = tokenize(text);

  const ranked = workers
    .map((worker) => {
      const { score } = scoreItem({
        text,
        tokens,
        item: worker,
        fields: [
          { key: "name", weight: 3 },
          { key: "phone", weight: 2 },
          { key: "nationality", weight: 1 },
        ],
      });

      return { worker, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.worker || null;
};

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

const getAssetFields = () => [
  { key: "name", weight: 4 },
  { key: "code", weight: 4 },
  { key: "assetTypeName", weight: 3 },
  { key: "placeName", weight: 2 },
  { key: "farmName", weight: 2 },
  { key: "kubraName", weight: 2 },
  { key: "externalWorkshopName", weight: 2 },
  { key: "workerNames", weight: 2 },
  { key: "status", weight: 2 },
  { key: "category", weight: 1 },
  { key: "notes", weight: 1 },
];

const searchAssets = (text, assets) =>
  rankItems({
    text,
    items: assets,
    fields: getAssetFields(),
    mapItem: mapAsset,
  });

const searchWorkers = (text, workers) =>
  rankItems({
    text,
    items: workers,
    fields: [
      { key: "name", weight: 4 },
      { key: "phone", weight: 3 },
      { key: "nationality", weight: 1 },
      { key: "notes", weight: 1 },
    ],
    mapItem: mapWorker,
  });

const searchEngineers = (text, engineers) =>
  rankItems({
    text,
    items: engineers,
    fields: [
      { key: "name", weight: 4 },
      { key: "phone", weight: 3 },
      { key: "notes", weight: 1 },
    ],
    mapItem: mapEngineer,
  });

const searchFarms = (text, farms) =>
  rankItems({
    text,
    items: farms,
    fields: [
      { key: "name", weight: 4 },
      { key: "managerName", weight: 2 },
      { key: "engineerNames", weight: 2 },
      { key: "notes", weight: 1 },
    ],
    mapItem: mapFarm,
  });

const searchKubras = (text, kubras) =>
  rankItems({
    text,
    items: kubras,
    fields: [
      { key: "name", weight: 4 },
      { key: "notes", weight: 1 },
    ],
    mapItem: mapKubra,
  });

const searchSprinklers = (text, sprinklers) =>
  rankItems({
    text,
    items: sprinklers,
    fields: [
      { key: "name", weight: 4 },
      { key: "sprinklerName", weight: 4 },
      { key: "farmName", weight: 3 },
      { key: "machineName", weight: 3 },
      { key: "gearName", weight: 2 },
      { key: "cropType", weight: 2 },
      { key: "movementType", weight: 2 },
      { key: "workerName", weight: 2 },
      { key: "hectareNumber", weight: 1 },
    ],
    mapItem: mapSprinkler,
  });

const searchHeaps = (text, heaps) =>
  rankItems({
    text,
    items: heaps,
    fields: [
      { key: "pileName", weight: 4 },
      { key: "farmName", weight: 3 },
      { key: "sprinklerName", weight: 3 },
      { key: "cropType", weight: 2 },
      { key: "notes", weight: 1 },
    ],
    mapItem: mapHeap,
  });

const helpResponse = () =>
  result({
    answer:
      "أنا مساعد السنبلة. أقدر أبحث وأحسب من البيانات المحفوظة عندك بدون إنترنت. اسألني عن مكان أصل، عدد الأصول، العمال، المزارع، الرشاشات أو الأكوام.",
    suggestions: [
      "فين مكينة 605؟",
      "كام أصل عاطل؟",
      "مين مسئول مزرعة؟",
      "اعرض رشاشات مزرعة",
      "كام كوم برسيم؟",
    ],
  });

const handleAssetCount = (text, data) => {
  const value = normalizeArabic(text);

  let list = data.assets;
  let label = "الأصول";

  if (value.includes("عاطل")) {
    list = data.assets.filter((asset) => asset.status === "عاطل");
    label = "الأصول العاطلة";
  } else if (value.includes("صالح")) {
    list = data.assets.filter((asset) => asset.status === "صالح");
    label = "الأصول الصالحة";
  } else if (value.includes("ورشه") || value.includes("ورشة")) {
    list = data.assets.filter(
      (asset) =>
        asset.status === "في الورشة" || asset.placeType === "external_workshop"
    );
    label = "الأصول في الورشة";
  } else if (value.includes("مزرعه") || value.includes("مزارع")) {
    list = data.assets.filter((asset) => asset.placeType === "farm");
    label = "الأصول داخل المزارع";
  } else if (value.includes("كبر") || value.includes("كِبر")) {
    list = data.assets.filter((asset) => asset.placeType === "kubra");
    label = "الأصول داخل الكِبر";
  }

  return result({
    answer: `عدد ${label}: ${list.length}.`,
    items: list.slice(0, 8).map(mapAsset),
  });
};

const handleAssetLocation = (text, data) => {
  const matches = searchAssets(text, data.assets);

  if (!matches.length) {
    return result({
      answer:
        "لم أجد أصل مطابق للسؤال. جرّب كتابة اسم الأصل أو الكود بشكل أوضح.",
      suggestions: ["فين مكينة 605؟", "ابحث عن أصل باسم", "اعرض الأصول"],
    });
  }

  const bestHref = matches[0].href;
  const assetId = bestHref.split("/").pop();
  const asset = data.assets.find((item) => item.id === assetId);

  if (!asset) {
    return result({
      answer: "وجدت نتيجة قريبة، افتحها من القائمة.",
      items: matches,
    });
  }

  return result({
    answer: `${getAssetTitle(asset)} موجود في ${getAssetPlaceType(
      asset
    )}: ${getAssetPlaceName(asset)}. الحالة الحالية: ${
      asset.status || "غير محددة"
    }.`,
    items: matches.slice(0, 5),
    suggestions: [
      "اعرض الأصول العاطلة",
      "كام أصل في الورشة؟",
      "اعرض سجل الحركات",
    ],
  });
};

const handleOwnerQuestion = (text, data) => {
  const farm = findFarmInText(text, data.farms);

  if (farm) {
    return result({
      answer: `بيانات المسئول عن مزرعة ${farm.name || ""}: ${
        farm.managerName || "لا يوجد مسئول مسجل"
      }${
        farm.engineerNames
          ? `. المهندسون المسئولون: ${farm.engineerNames}.`
          : ""
      }`,
      items: [mapFarm(farm)],
    });
  }

  const worker = findWorkerInText(text, data.workers);

  if (worker) {
    const assets = data.assets.filter((asset) =>
      (asset.workerIds || []).includes(worker.id)
    );

    const sprinklers = data.sprinklers.filter(
      (sprinkler) => sprinkler.workerId === worker.id
    );

    return result({
      answer: `${worker.name || "العامل"} مرتبط بـ ${assets.length} أصل و ${
        sprinklers.length
      } رشاش.`,
      items: [
        ...assets.slice(0, 5).map(mapAsset),
        ...sprinklers.slice(0, 3).map(mapSprinkler),
      ],
    });
  }

  if (normalizeArabic(text).includes("عهد")) {
    const ranking = data.workers
      .map((worker) => {
        const assetsCount = data.assets.filter((asset) =>
          (asset.workerIds || []).includes(worker.id)
        ).length;

        return {
          worker,
          assetsCount,
        };
      })
      .filter((entry) => entry.assetsCount > 0)
      .sort((a, b) => b.assetsCount - a.assetsCount);

    if (!ranking.length) {
      return result({
        answer: "لا يوجد عمال مرتبطون بعهد في البيانات الحالية.",
      });
    }

    return result({
      answer: `أكثر عامل مرتبط بعهد هو ${
        ranking[0].worker.name || "بدون اسم"
      } بعدد ${ranking[0].assetsCount} أصل.`,
      items: ranking.slice(0, 8).map((entry) => ({
        title: entry.worker.name || "عامل بدون اسم",
        subtitle: `${entry.assetsCount} أصل مرتبط`,
        href: `/workers/${entry.worker.id}`,
      })),
    });
  }

  return result({
    answer:
      "لم أحدد الشخص المقصود. اكتب اسم مزرعة أو عامل، مثل: مين مسئول مزرعة السلام؟",
    suggestions: ["مين مسئول مزرعة؟", "مين ماسك عهد؟"],
  });
};

const handleFarmQuestion = (text, data) => {
  const farm = findFarmInText(text, data.farms);

  if (!farm) {
    return result({
      answer: `عدد المزارع المسجلة ${data.farms.length} مزرعة.`,
      items: data.farms.slice(0, 8).map(mapFarm),
    });
  }

  const assets = data.assets.filter(
    (asset) => asset.farmId === farm.id || asset.placeId === farm.id
  );

  const sprinklers = data.sprinklers.filter(
    (sprinkler) => sprinkler.farmName === farm.name
  );

  const heaps = data.heaps.filter((heap) => heap.farmId === farm.id);

  return result({
    answer: `مزرعة ${farm.name} بها ${assets.length} أصل، و ${sprinklers.length} رشاش، و ${heaps.length} كوم.`,
    items: [
      mapFarm(farm),
      ...assets.slice(0, 3).map(mapAsset),
      ...sprinklers.slice(0, 3).map(mapSprinkler),
      ...heaps.slice(0, 2).map(mapHeap),
    ],
  });
};

const handleSprinklerQuestion = (text, data) => {
  const farm = findFarmInText(text, data.farms);

  let list = data.sprinklers;

  if (farm) {
    list = data.sprinklers.filter((sprinkler) => sprinkler.farmName === farm.name);
  }

  const matches = searchSprinklers(text, list);

  if (matches.length && detectIntent(text) !== "count") {
    return result({
      answer: `وجدت ${matches.length} رشاش مطابق أو قريب من سؤالك.`,
      items: matches,
    });
  }

  return result({
    answer: farm
      ? `عدد الرشاشات في مزرعة ${farm.name}: ${list.length}.`
      : `إجمالي الرشاشات المسجلة: ${data.sprinklers.length}.`,
    items: list.slice(0, 8).map(mapSprinkler),
  });
};

const handleHeapQuestion = (text, data) => {
  const value = normalizeArabic(text);
  let list = data.heaps;

  const farm = findFarmInText(text, data.farms);

  if (farm) {
    list = list.filter((heap) => heap.farmId === farm.id || heap.farmName === farm.name);
  }

  const cropTokens = tokenize(text);
  const cropMatch = cropTokens.find((token) =>
    data.heaps.some((heap) => includesText(heap.cropType, token))
  );

  if (cropMatch) {
    list = list.filter((heap) => includesText(heap.cropType, cropMatch));
  }

  const totalBricks = list.reduce(
    (sum, heap) => sum + Number(heap.bricksCount || 0),
    0
  );

  if (value.includes("لبن") || value.includes("لبنه")) {
    return result({
      answer: `إجمالي عدد اللبن في النتائج المطابقة: ${totalBricks} لبنة.`,
      items: list.slice(0, 8).map(mapHeap),
    });
  }

  return result({
    answer: `عدد الأكوام المطابقة: ${list.length}. إجمالي اللبن: ${totalBricks} لبنة.`,
    items: list.slice(0, 8).map(mapHeap),
  });
};

const handleGeneralSearch = (text, data) => {
  const assets = searchAssets(text, data.assets).map((item) => ({
    ...item,
    title: `أصل: ${item.title}`,
  }));

  const workers = searchWorkers(text, data.workers).map((item) => ({
    ...item,
    title: `عامل: ${item.title}`,
  }));

  const engineers = searchEngineers(text, data.engineers).map((item) => ({
    ...item,
    title: `مهندس: ${item.title}`,
  }));

  const farms = searchFarms(text, data.farms).map((item) => ({
    ...item,
    title: `مزرعة: ${item.title}`,
  }));

  const kubras = searchKubras(text, data.kubras).map((item) => ({
    ...item,
    title: `كِبرة: ${item.title}`,
  }));

  const sprinklers = searchSprinklers(text, data.sprinklers).map((item) => ({
    ...item,
    title: `رشاش: ${item.title}`,
  }));

  const heaps = searchHeaps(text, data.heaps).map((item) => ({
    ...item,
    title: `كوم: ${item.title}`,
  }));

  const items = [
    ...assets,
    ...workers,
    ...engineers,
    ...farms,
    ...kubras,
    ...sprinklers,
    ...heaps,
  ].slice(0, 10);

  return result({
    answer: items.length
      ? `وجدت ${items.length} نتيجة قريبة من بحثك.`
      : "لم أجد نتيجة واضحة. جرّب كتابة اسم أو كود أصل، عامل، مزرعة، رشاش أو كوم.",
    items,
  });
};

export const askSmartAssistant = (message) => {
  const rawText = String(message || "").trim();
  const text = normalizeArabic(rawText);
  const data = getCollections();

  if (!text) {
    return result({
      answer: "اكتب سؤالك وأنا أساعدك في الوصول للبيانات بسرعة.",
    });
  }

  if (
    text.includes("مساعده") ||
    text.includes("تساعد") ||
    text.includes("تعمل") ||
    text.includes("تقدر")
  ) {
    return helpResponse();
  }

  const intent = detectIntent(text);
  const entity = detectEntity(text);

  if (entity === "assets" && intent === "count") {
    return handleAssetCount(text, data);
  }

  if (entity === "assets" && intent === "location") {
    return handleAssetLocation(text, data);
  }

  if (intent === "owner") {
    return handleOwnerQuestion(text, data);
  }

  if (entity === "farms") {
    return handleFarmQuestion(text, data);
  }

  if (entity === "sprinklers") {
    return handleSprinklerQuestion(text, data);
  }

  if (entity === "heaps") {
    return handleHeapQuestion(text, data);
  }

  if (entity === "workers") {
    const matches = searchWorkers(text, data.workers);

    return result({
      answer: matches.length
        ? `وجدت ${matches.length} عامل مطابق أو قريب.`
        : `عدد العمال المسجلين ${data.workers.length} عامل.`,
      items: matches.length ? matches : data.workers.slice(0, 8).map(mapWorker),
    });
  }

  if (entity === "engineers") {
    const matches = searchEngineers(text, data.engineers);

    return result({
      answer: matches.length
        ? `وجدت ${matches.length} مهندس مطابق أو قريب.`
        : `عدد المهندسين المسجلين ${data.engineers.length} مهندس.`,
      items: matches.length
        ? matches
        : data.engineers.slice(0, 8).map(mapEngineer),
    });
  }

  if (entity === "kubras") {
    const matches = searchKubras(text, data.kubras);

    return result({
      answer: matches.length
        ? `وجدت ${matches.length} كِبرة مطابقة أو قريبة.`
        : `عدد الكِبر المسجلة ${data.kubras.length}.`,
      items: matches.length ? matches : data.kubras.slice(0, 8).map(mapKubra),
    });
  }

  if (text.includes("ورشه") || text.includes("ورشة")) {
    const list = data.assets.filter(
      (asset) =>
        asset.status === "في الورشة" || asset.placeType === "external_workshop"
    );

    return result({
      answer: `يوجد ${list.length} أصل في الورشة.`,
      items: list.slice(0, 8).map(mapAsset),
    });
  }

  if (text.includes("عاطل")) {
    const list = data.assets.filter((asset) => asset.status === "عاطل");

    return result({
      answer: `يوجد ${list.length} أصل عاطل.`,
      items: list.slice(0, 8).map(mapAsset),
    });
  }

  return handleGeneralSearch(text, data);
};

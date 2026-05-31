import { getCachedCollection } from "./realtimeCache";

const includesText = (value, keyword) =>
  String(value || "").toLowerCase().includes(String(keyword || "").toLowerCase());

const getCollections = () => ({
  assets: getCachedCollection("cache:assets"),
  workers: getCachedCollection("cache:workers"),
  farms: getCachedCollection("cache:farms"),
  kubras: getCachedCollection("cache:kubras"),
  sprinklers: getCachedCollection("cache:sprinklers"),
  heaps: getCachedCollection("cache:heaps"),
});

const result = ({ answer, items = [], suggestions = [] }) => ({
  answer,
  items,
  suggestions:
    suggestions.length > 0
      ? suggestions
      : [
          "اعرض الأصول العاطلة",
          "كام أصل في الورشة؟",
          "فين مكينة 605؟",
          "اعرض رشاشات مزرعة",
        ],
});

export const askSmartAssistant = (message) => {
  const text = String(message || "").trim().toLowerCase();
  const data = getCollections();

  if (!text) {
    return result({
      answer: "اكتب سؤالك وأنا أساعدك في الوصول للبيانات بسرعة.",
    });
  }

  if (text.includes("مساعدة") || text.includes("تساعد") || text.includes("تعمل")) {
    return result({
      answer:
        "أنا مساعد السنبلة. أقدر أبحث في الأصول، العمال، المزارع، الكِبر، الرشاشات، والأكوام من البيانات المحفوظة عندك.",
      suggestions: [
        "اعرض الأصول العاطلة",
        "كام أصل في الورشة؟",
        "مين ماسك عهد؟",
        "اعرض الأكوام",
      ],
    });
  }

  if (text.includes("عاطل") || text.includes("العاطلة")) {
    const items = data.assets
      .filter((asset) => asset.status === "عاطل")
      .slice(0, 8)
      .map((asset) => ({
        title: asset.name || "أصل بدون اسم",
        subtitle: `${asset.assetTypeName || "نوع غير محدد"} - ${
          asset.placeName || asset.farmName || asset.kubraName || "مكان غير محدد"
        }`,
        href: `/assets/${asset.id}`,
      }));

    return result({
      answer: `يوجد ${data.assets.filter((asset) => asset.status === "عاطل").length} أصل عاطل.`,
      items,
    });
  }

  if (text.includes("ورشة") || text.includes("الورشه")) {
    const list = data.assets.filter(
      (asset) =>
        asset.status === "في الورشة" || asset.placeType === "external_workshop"
    );

    const items = list.slice(0, 8).map((asset) => ({
      title: asset.name || "أصل بدون اسم",
      subtitle: asset.externalWorkshopName || asset.placeName || "ورشة غير محددة",
      href: `/assets/${asset.id}`,
    }));

    return result({
      answer: `يوجد ${list.length} أصل في الورشة.`,
      items,
    });
  }

  if (text.includes("كام") && text.includes("أصل")) {
    return result({
      answer: `إجمالي الأصول المسجلة هو ${data.assets.length} أصل.`,
      items: [
        {
          title: "فتح صفحة الأصول",
          subtitle: "عرض كل الأصول والعهد",
          href: "/assets",
        },
      ],
    });
  }

  if (text.includes("عامل") || text.includes("عمال")) {
    const items = data.workers.slice(0, 8).map((worker) => ({
      title: worker.name || "عامل بدون اسم",
      subtitle: worker.phone || worker.nationality || "لا توجد بيانات إضافية",
      href: `/workers/${worker.id}`,
    }));

    return result({
      answer: `عدد العمال المسجلين ${data.workers.length} عامل.`,
      items,
    });
  }

  if (text.includes("مهندس") || text.includes("مهندسين")) {
    return result({
      answer: "افتح صفحة المهندسين من الرابط التالي.",
      items: [
        {
          title: "صفحة المهندسين",
          subtitle: "عرض وإدارة المهندسين",
          href: "/engineers",
        },
      ],
    });
  }

  if (text.includes("مزرعة") || text.includes("مزارع")) {
    const found = data.farms.filter((farm) => includesText(text, farm.name));

    const list = found.length ? found : data.farms.slice(0, 8);

    return result({
      answer: found.length
        ? `وجدت ${found.length} مزرعة مطابقة.`
        : `عدد المزارع المسجلة ${data.farms.length} مزرعة.`,
      items: list.map((farm) => ({
        title: farm.name || "مزرعة بدون اسم",
        subtitle: farm.managerName || farm.engineerNames || "لا توجد بيانات إضافية",
        href: `/farms/${farm.id}`,
      })),
    });
  }

  if (text.includes("رشاش") || text.includes("رشاشات")) {
    const farmNameMatch = data.farms.find((farm) => includesText(text, farm.name));

    const list = farmNameMatch
      ? data.sprinklers.filter((sprinkler) => sprinkler.farmName === farmNameMatch.name)
      : data.sprinklers;

    return result({
      answer: farmNameMatch
        ? `يوجد ${list.length} رشاش في مزرعة ${farmNameMatch.name}.`
        : `إجمالي الرشاشات ${data.sprinklers.length} رشاش.`,
      items: list.slice(0, 8).map((sprinkler) => ({
        title: sprinkler.name || sprinkler.sprinklerName || "رشاش بدون اسم",
        subtitle: `${sprinkler.farmName || "مزرعة غير محددة"} - ${
          sprinkler.workerName || "بدون عامل"
        }`,
        href: `/sprinklers/${sprinkler.id}`,
      })),
    });
  }

  if (text.includes("كوم") || text.includes("اكوام") || text.includes("أكوام")) {
    return result({
      answer: `إجمالي الأكوام المسجلة ${data.heaps.length} كوم.`,
      items: data.heaps.slice(0, 8).map((heap) => ({
        title: heap.pileName || "كوم بدون اسم",
        subtitle: `${heap.farmName || "مزرعة غير محددة"} - ${
          heap.cropType || "نوع غير محدد"
        }`,
        href: `/heaps/${heap.id}`,
      })),
    });
  }

  const allResults = [
    ...data.assets.map((item) => ({
      type: "أصل",
      title: item.name,
      subtitle: `${item.assetTypeName || ""} ${item.placeName || ""}`,
      href: `/assets/${item.id}`,
    })),
    ...data.workers.map((item) => ({
      type: "عامل",
      title: item.name,
      subtitle: item.phone || "",
      href: `/workers/${item.id}`,
    })),
    ...data.farms.map((item) => ({
      type: "مزرعة",
      title: item.name,
      subtitle: item.managerName || "",
      href: `/farms/${item.id}`,
    })),
    ...data.sprinklers.map((item) => ({
      type: "رشاش",
      title: item.name || item.sprinklerName,
      subtitle: item.farmName || "",
      href: `/sprinklers/${item.id}`,
    })),
    ...data.heaps.map((item) => ({
      type: "كوم",
      title: item.pileName,
      subtitle: item.farmName || "",
      href: `/heaps/${item.id}`,
    })),
  ]
    .filter((item) => includesText(item.title, text) || includesText(item.subtitle, text))
    .slice(0, 8)
    .map((item) => ({
      title: `${item.type}: ${item.title || "بدون اسم"}`,
      subtitle: item.subtitle || "اضغط للعرض",
      href: item.href,
    }));

  return result({
    answer: allResults.length
      ? `وجدت ${allResults.length} نتيجة قريبة من بحثك.`
      : "لم أجد نتيجة واضحة. جرّب كتابة اسم أصل، عامل، مزرعة، رشاش أو كوم.",
    items: allResults,
  });
};

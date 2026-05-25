export const calculateAssetsStats = (assets = []) => ({
  total: assets.length,

  good: assets.filter((a) => a.status === "صالح").length,
  broken: assets.filter((a) => a.status === "عاطل").length,
  inWorkshop: assets.filter((a) => a.status === "في الورشة").length,

  equipment: assets.filter((a) => (a.category || "asset") === "asset").length,
  spareParts: assets.filter((a) => a.category === "spare_part").length,
  tools: assets.filter((a) => a.category === "tool").length,
  materials: assets.filter((a) => a.category === "material").length,

  inFarms: assets.filter((a) => a.placeType === "farm").length,
  inKubras: assets.filter((a) => a.placeType === "kubra").length,
  inExternalWorkshops: assets.filter(
    (a) => a.placeType === "external_workshop"
  ).length,
});

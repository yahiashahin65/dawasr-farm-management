export const DEFAULT_ASSET_TYPE_NAME = "مكينة";

export const cleanName = (value) => String(value || "").trim();

export const normalizeList = (docs) =>
  docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => cleanName(item.name));

export const getAssetTypeName = (asset) =>
  cleanName(asset.assetTypeName) || DEFAULT_ASSET_TYPE_NAME;

export const getAssetCategory = (asset) => asset?.category || "asset";

export const getAssetCategoryLabel = (category) => {
  if (category === "spare_part") return "قطعة غيار";
  if (category === "tool") return "أداة";
  if (category === "material") return "مواد";
  return "معدة";
};

export const getPlaceName = (asset) =>
  cleanName(asset.placeName) ||
  cleanName(asset.farmName) ||
  cleanName(asset.kubraName) ||
  cleanName(asset.externalWorkshopName) ||
  "-";

export const getPlaceTypeLabel = (placeType) => {
  if (placeType === "kubra") return "الكِبرة";
  if (placeType === "external_workshop") return "ورشة خارجية";
  return "مزرعة";
};

export const isAssetWithoutValidType = (asset, validTypeIds = []) =>
  !cleanName(asset.assetTypeId) ||
  !cleanName(asset.assetTypeName) ||
  !validTypeIds.includes(asset.assetTypeId);

export const badgeClass = (status) => {
  if (status === "صالح") return "bg-green-50 text-green-700";
  if (status === "عاطل") return "bg-amber-50 text-amber-700";
  if (status === "في الورشة") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
};

export const getStatusCounts = (assets = []) => ({
  total: assets.length,
  good: assets.filter((asset) => asset.status === "صالح").length,
  broken: assets.filter((asset) => asset.status === "عاطل").length,
  inWorkshop: assets.filter((asset) => asset.status === "في الورشة").length,

  equipment: assets.filter((asset) => (asset.category || "asset") === "asset").length,
  spareParts: assets.filter((asset) => asset.category === "spare_part").length,
  tools: assets.filter((asset) => asset.category === "tool").length,
  materials: assets.filter((asset) => asset.category === "material").length,

  inFarms: assets.filter((asset) => asset.placeType === "farm").length,
  inKubras: assets.filter((asset) => asset.placeType === "kubra").length,
  inExternalWorkshops: assets.filter(
    (asset) => asset.placeType === "external_workshop"
  ).length,
});

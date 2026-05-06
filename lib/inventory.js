export const DEFAULT_ASSET_TYPE_NAME = "مكينة";

export const cleanName = (value) => String(value || "").trim();

export const normalizeList = (docs) =>
  docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => cleanName(item.name));

export const getAssetTypeName = (asset) =>
  cleanName(asset.assetTypeName) || DEFAULT_ASSET_TYPE_NAME;

export const getPlaceName = (asset) =>
  cleanName(asset.placeName) ||
  cleanName(asset.farmName) ||
  cleanName(asset.kubraName) ||
  "-";

export const getPlaceTypeLabel = (placeType) =>
  placeType === "kubra" ? "الكِبرة" : "مزرعة";

export const isAssetWithoutValidType = (asset, validTypeIds = []) =>
  !cleanName(asset.assetTypeId) ||
  !cleanName(asset.assetTypeName) ||
  !validTypeIds.includes(asset.assetTypeId);

export const badgeClass = (status) => {
  if (status === "صالح") return "bg-green-50 text-green-700";
  if (status === "عاطل") return "bg-amber-50 text-amber-700";
  if (status === "تالف") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-700";
};

export const getStatusCounts = (assets = []) => ({
  total: assets.length,
  good: assets.filter((asset) => asset.status === "صالح").length,
  broken: assets.filter((asset) => asset.status === "عاطل").length,
  damaged: assets.filter((asset) => asset.status === "تالف").length,
  inFarms: assets.filter((asset) => asset.placeType === "farm").length,
  inKubras: assets.filter((asset) => asset.placeType === "kubra").length,
});

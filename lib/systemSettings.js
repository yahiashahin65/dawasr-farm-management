import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export const DEFAULT_SYSTEM_SETTINGS = {
  sprinklerMovement: [
    "دائري",
    "نصف دائري",
    "ثلاث أرباع دائري",
    "نصين",
  ],
  cropType: ["برسيم", "رودس", "ذرة", "قمح", "شعير", "غير محدد"],
  gearType: [
    "1/1",
    "1/1 (300)",
    "1/1 (350)",
    "1/1 (425)",
    "10/11",
    "10/11 (400)",
    "10/11 (425)",
    "5/6 (350)",
  ],
  assetStatus: ["صالح", "عاطل", "في الورشة"],
  externalWorkshop: [],
};

export const loadSettingOptions = async (type) => {
  const snap = await getDocs(
    query(
      collection(db, "systemSettings"),
      where("type", "==", type),
      where("isActive", "==", true)
    )
  );

  const values = snap.docs
    .map((doc) => doc.data()?.name)
    .filter(Boolean);

  return values.length ? values : DEFAULT_SYSTEM_SETTINGS[type] || [];
};

export const loadMultipleSettingOptions = async (types = []) => {
  const result = {};

  await Promise.all(
    types.map(async (type) => {
      result[type] = await loadSettingOptions(type);
    })
  );

  return result;
};

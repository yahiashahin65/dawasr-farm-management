import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { setCachedCollection } from "./realtimeCache";

const collectionsToCache = [
  { name: "workers", cacheKey: "cache:workers" },
  { name: "farms", cacheKey: "cache:farms" },
  { name: "kubras", cacheKey: "cache:kubras" },
  { name: "engineers", cacheKey: "cache:engineers" },

  // New
  { name: "accountants", cacheKey: "cache:accountants" },
  { name: "vehicles", cacheKey: "cache:vehicles" },
  { name: "vehicleMaintenance", cacheKey: "cache:vehicleMaintenance" },

  { name: "assetTypes", cacheKey: "cache:assetTypes" },
  { name: "assets", cacheKey: "cache:assets" },
  { name: "heaps", cacheKey: "cache:heaps" },
  { name: "sprinklers", cacheKey: "cache:sprinklers" },
  { name: "assetMovements", cacheKey: "cache:assetMovements" },
  { name: "systemSettings", cacheKey: "cache:systemSettings" },
];

export const bootstrapOfflineCache = async () => {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) return;

  const alreadyRunning = sessionStorage.getItem("bootstrapCacheRunning");

  if (alreadyRunning === "true") return;

  sessionStorage.setItem("bootstrapCacheRunning", "true");

  try {
    await Promise.all(
      collectionsToCache.map(async (item) => {
        try {
          let snap;

          try {
            snap = await getDocs(
              query(collection(db, item.name), orderBy("createdAt", "desc"))
            );
          } catch {
            snap = await getDocs(collection(db, item.name));
          }

          const data = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setCachedCollection(item.cacheKey, data);
        } catch (error) {
          console.error(`Failed to cache ${item.name}`, error);
        }
      })
    );

    localStorage.setItem("offlineCacheReady", "true");
    localStorage.setItem("offlineCacheUpdatedAt", new Date().toISOString());
  } finally {
    sessionStorage.removeItem("bootstrapCacheRunning");
  }
};

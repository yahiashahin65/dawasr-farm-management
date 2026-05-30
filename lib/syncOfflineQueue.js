import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  getOfflineQueue,
  removeOfflineOperation,
  isOnline,
} from "./offlineQueue";

import {
  getCachedCollection,
  setCachedCollection,
} from "./realtimeCache";

const updateDocsByQuery = async ({ collectionName, field, value, payload }) => {
  if (!value) return;

  const snap = await getDocs(
    query(collection(db, collectionName), where(field, "==", value))
  );

  await Promise.all(
    snap.docs.map((item) =>
      updateDoc(doc(db, collectionName, item.id), {
        ...payload,
        updatedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      })
    )
  );
};

const markCacheItemSynced = (cacheKey, documentId) => {
  if (!documentId) return;

  const cached = getCachedCollection(cacheKey);

  setCachedCollection(
    cacheKey,
    cached.map((item) =>
      item.id === documentId
        ? {
            ...item,
            isOffline: false,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          }
        : item
    )
  );
};

const removeCacheItem = (cacheKey, documentId) => {
  if (!documentId) return;

  const cached = getCachedCollection(cacheKey);
  setCachedCollection(
    cacheKey,
    cached.filter((item) => item.id !== documentId)
  );
};

const cacheKeyByCollection = {
  assets: "cache:assets",
  assetMovements: "cache:assetMovements",
  assetTypes: "cache:assetTypes",
  workers: "cache:workers",
  farms: "cache:farms",
  engineers: "cache:engineers",
  kubras: "cache:kubras",
  heaps: "cache:heaps",
  sprinklers: "cache:sprinklers",
  systemSettings: "cache:systemSettings",
};

const markOperationCacheSynced = ({ collectionName, operation, documentId }) => {
  const cacheKey = cacheKeyByCollection[collectionName];

  if (!cacheKey) return;

  if (operation === "delete") {
    removeCacheItem(cacheKey, documentId);
    return;
  }

  if (
    operation === "create" ||
    operation === "update" ||
    operation === "move"
  ) {
    markCacheItemSynced(cacheKey, documentId);
  }
};

const updateLinkedAssetsTypeName = async ({ assetTypeId, assetTypeName }) => {
  if (!assetTypeId) throw new Error("Missing assetTypeId");

  await updateDocsByQuery({
    collectionName: "assets",
    field: "assetTypeId",
    value: assetTypeId,
    payload: {
      assetTypeName,
    },
  });

  const cachedAssets = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cachedAssets.map((asset) =>
      asset.assetTypeId === assetTypeId
        ? {
            ...asset,
            assetTypeName,
            isOffline: false,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          }
        : asset
    )
  );
};

const updateRelatedFarmName = async ({ farmId, farmName }) => {
  if (!farmId) throw new Error("Missing farmId");

  const assetsByFarmIdSnap = await getDocs(
    query(collection(db, "assets"), where("farmId", "==", farmId))
  );

  const assetsByPlaceIdSnap = await getDocs(
    query(collection(db, "assets"), where("placeId", "==", farmId))
  );

  const assetDocsMap = new Map();

  assetsByFarmIdSnap.docs.forEach((item) => {
    assetDocsMap.set(item.id, item);
  });

  assetsByPlaceIdSnap.docs.forEach((item) => {
    assetDocsMap.set(item.id, item);
  });

  await Promise.all(
    Array.from(assetDocsMap.values()).map((assetDoc) => {
      const data = assetDoc.data();
      const isFarmPlace = data.placeType === "farm";

      return updateDoc(doc(db, "assets", assetDoc.id), {
        farmName,
        placeName: isFarmPlace ? farmName : data.placeName || farmName,
        currentPlace: isFarmPlace
          ? {
              ...(data.currentPlace || {}),
              type: "farm",
              id: farmId,
              name: farmName,
            }
          : data.currentPlace || null,
        updatedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      });
    })
  );

  await updateDocsByQuery({
    collectionName: "heaps",
    field: "farmId",
    value: farmId,
    payload: {
      farmName,
    },
  });

  const sprinklersByFarmIdSnap = await getDocs(
    query(collection(db, "sprinklers"), where("farmId", "==", farmId))
  );

  await Promise.all(
    sprinklersByFarmIdSnap.docs.map((sprinklerDoc) =>
      updateDoc(doc(db, "sprinklers", sprinklerDoc.id), {
        farmName,
        updatedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      })
    )
  );

  const cachedAssets = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cachedAssets.map((asset) => {
      const isRelated =
        asset.farmId === farmId ||
        (asset.placeType === "farm" && asset.placeId === farmId);

      if (!isRelated) return asset;

      return {
        ...asset,
        farmName,
        placeName: asset.placeType === "farm" ? farmName : asset.placeName,
        currentPlace:
          asset.placeType === "farm"
            ? {
                ...(asset.currentPlace || {}),
                type: "farm",
                id: farmId,
                name: farmName,
              }
            : asset.currentPlace,
        isOffline: false,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
      };
    })
  );

  const cachedHeaps = getCachedCollection("cache:heaps");

  setCachedCollection(
    "cache:heaps",
    cachedHeaps.map((heap) =>
      heap.farmId === farmId
        ? {
            ...heap,
            farmName,
            isOffline: false,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          }
        : heap
    )
  );

  const cachedSprinklers = getCachedCollection("cache:sprinklers");

  setCachedCollection(
    "cache:sprinklers",
    cachedSprinklers.map((sprinkler) =>
      sprinkler.farmId === farmId
        ? {
            ...sprinkler,
            farmName,
            isOffline: false,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          }
        : sprinkler
    )
  );
};

const updateRelatedKubraName = async ({ kubraId, kubraName }) => {
  if (!kubraId) throw new Error("Missing kubraId");

  const assetsByKubraIdSnap = await getDocs(
    query(collection(db, "assets"), where("kubraId", "==", kubraId))
  );

  const assetsByPlaceIdSnap = await getDocs(
    query(collection(db, "assets"), where("placeId", "==", kubraId))
  );

  const assetDocsMap = new Map();

  assetsByKubraIdSnap.docs.forEach((item) => {
    assetDocsMap.set(item.id, item);
  });

  assetsByPlaceIdSnap.docs.forEach((item) => {
    assetDocsMap.set(item.id, item);
  });

  await Promise.all(
    Array.from(assetDocsMap.values()).map((assetDoc) => {
      const data = assetDoc.data();
      const isKubraPlace = data.placeType === "kubra";

      return updateDoc(doc(db, "assets", assetDoc.id), {
        kubraName,
        placeName: isKubraPlace ? kubraName : data.placeName || kubraName,
        currentPlace: isKubraPlace
          ? {
              ...(data.currentPlace || {}),
              type: "kubra",
              id: kubraId,
              name: kubraName,
            }
          : data.currentPlace || null,
        updatedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      });
    })
  );

  const cachedAssets = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cachedAssets.map((asset) => {
      const isRelated =
        asset.kubraId === kubraId ||
        (asset.placeType === "kubra" && asset.placeId === kubraId);

      if (!isRelated) return asset;

      return {
        ...asset,
        kubraName,
        placeName: asset.placeType === "kubra" ? kubraName : asset.placeName,
        currentPlace:
          asset.placeType === "kubra"
            ? {
                ...(asset.currentPlace || {}),
                type: "kubra",
                id: kubraId,
                name: kubraName,
              }
            : asset.currentPlace,
        isOffline: false,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
      };
    })
  );
};

const updateRelatedWorkerName = async ({
  workerId,
  workerName,
  workerPhone = "",
}) => {
  if (!workerId) throw new Error("Missing workerId");

  await updateDocsByQuery({
    collectionName: "sprinklers",
    field: "workerId",
    value: workerId,
    payload: {
      workerName,
    },
  });

  const assetsSnap = await getDocs(
    query(collection(db, "assets"), where("workerIds", "array-contains", workerId))
  );

  await Promise.all(
    assetsSnap.docs.map((assetDoc) => {
      const data = assetDoc.data();

      const workers = Array.isArray(data.workers)
        ? data.workers.map((worker) =>
            worker.id === workerId
              ? {
                  ...worker,
                  name: workerName,
                  phone: workerPhone || worker.phone || "",
                }
              : worker
          )
        : [];

      return updateDoc(doc(db, "assets", assetDoc.id), {
        workers,
        workerNames: workers.map((worker) => worker.name).join("، "),
        updatedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      });
    })
  );

  const cachedAssets = getCachedCollection("cache:assets");

  setCachedCollection(
    "cache:assets",
    cachedAssets.map((asset) => {
      if (!(asset.workerIds || []).includes(workerId)) return asset;

      const workers = Array.isArray(asset.workers)
        ? asset.workers.map((worker) =>
            worker.id === workerId
              ? {
                  ...worker,
                  name: workerName,
                  phone: workerPhone || worker.phone || "",
                }
              : worker
          )
        : [];

      return {
        ...asset,
        workers,
        workerNames: workers.map((worker) => worker.name).join("، "),
        isOffline: false,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
      };
    })
  );

  const cachedSprinklers = getCachedCollection("cache:sprinklers");

  setCachedCollection(
    "cache:sprinklers",
    cachedSprinklers.map((sprinkler) =>
      sprinkler.workerId === workerId
        ? {
            ...sprinkler,
            workerName,
            isOffline: false,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          }
        : sprinkler
    )
  );
};

const updateRelatedEngineerName = async ({
  engineerId,
  engineerName,
  engineerPhone = "",
}) => {
  if (!engineerId) throw new Error("Missing engineerId");

  const farmsSnap = await getDocs(
    query(collection(db, "farms"), where("engineerIds", "array-contains", engineerId))
  );

  await Promise.all(
    farmsSnap.docs.map((farmDoc) => {
      const data = farmDoc.data();

      const engineers = Array.isArray(data.engineers)
        ? data.engineers.map((engineer) =>
            engineer.id === engineerId
              ? {
                  ...engineer,
                  name: engineerName,
                  phone: engineerPhone || engineer.phone || "",
                }
              : engineer
          )
        : [];

      return updateDoc(doc(db, "farms", farmDoc.id), {
        engineers,
        engineerNames: engineers.map((engineer) => engineer.name).join("، "),
        updatedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      });
    })
  );

  const cachedFarms = getCachedCollection("cache:farms");

  setCachedCollection(
    "cache:farms",
    cachedFarms.map((farm) => {
      if (!(farm.engineerIds || []).includes(engineerId)) return farm;

      const engineers = Array.isArray(farm.engineers)
        ? farm.engineers.map((engineer) =>
            engineer.id === engineerId
              ? {
                  ...engineer,
                  name: engineerName,
                  phone: engineerPhone || engineer.phone || "",
                }
              : engineer
          )
        : [];

      return {
        ...farm,
        engineers,
        engineerNames: engineers.map((engineer) => engineer.name).join("، "),
        isOffline: false,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
      };
    })
  );
};

export const syncOfflineQueue = async () => {
  if (!isOnline()) return;

  const queue = getOfflineQueue();

  if (!queue.length) return;

  for (const item of queue) {
    try {
      const { collectionName, operation, documentId, payload } = item;

      if (!collectionName || !operation) {
        removeOfflineOperation(item.id);
        continue;
      }

      if (operation === "create") {
        if (documentId) {
          await setDoc(doc(db, collectionName, documentId), {
            ...payload,
            syncedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, collectionName), {
            ...payload,
            syncedAt: serverTimestamp(),
          });
        }
      }

      if (operation === "update" || operation === "move") {
        if (!documentId) throw new Error("Missing documentId");

        await updateDoc(doc(db, collectionName, documentId), {
          ...payload,
          syncedAt: serverTimestamp(),
        });
      }

      if (operation === "delete") {
        if (!documentId) throw new Error("Missing documentId");
        await deleteDoc(doc(db, collectionName, documentId));
      }

      if (operation === "bulk-update-asset-type-name") {
        await updateLinkedAssetsTypeName(payload);
      }

      if (operation === "update-related-farm-name") {
        await updateRelatedFarmName(payload);
      }

      if (operation === "update-related-kubra-name") {
        await updateRelatedKubraName(payload);
      }

      if (operation === "update-related-worker-name") {
        await updateRelatedWorkerName(payload);
      }

      if (operation === "update-related-engineer-name") {
        await updateRelatedEngineerName(payload);
      }

      markOperationCacheSynced({
        collectionName,
        operation,
        documentId,
      });

      removeOfflineOperation(item.id);
    } catch (error) {
      console.error("Offline sync failed:", item, error);
      break;
    }
  }
};

export const startOfflineSyncListener = () => {
  if (typeof window === "undefined") return () => {};

  const run = () => {
    syncOfflineQueue();
  };

  window.addEventListener("online", run);

  if (navigator.onLine) {
    syncOfflineQueue();
  }

  return () => {
    window.removeEventListener("online", run);
  };
};

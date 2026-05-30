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

const updateDocsByQuery = async ({ collectionName, field, value, payload }) => {
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

const updateDocsByArrayContains = async ({
  collectionName,
  field,
  value,
  payload,
}) => {
  const snap = await getDocs(
    query(collection(db, collectionName), where(field, "array-contains", value))
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
        const assetTypeId = payload?.assetTypeId;
        const assetTypeName = payload?.assetTypeName;

        if (!assetTypeId) throw new Error("Missing assetTypeId");

        await updateDocsByQuery({
          collectionName: "assets",
          field: "assetTypeId",
          value: assetTypeId,
          payload: {
            assetTypeName,
          },
        });
      }

      if (operation === "update-related-farm-name") {
        const farmId = payload?.farmId;
        const farmName = payload?.farmName;

        if (!farmId) throw new Error("Missing farmId");

        await updateDocsByQuery({
          collectionName: "assets",
          field: "farmId",
          value: farmId,
          payload: {
            farmName,
            placeName: farmName,
          },
        });

        await updateDocsByQuery({
          collectionName: "assets",
          field: "placeId",
          value: farmId,
          payload: {
            farmName,
            placeName: farmName,
          },
        });

        await updateDocsByQuery({
          collectionName: "sprinklers",
          field: "farmName",
          value: payload.oldFarmName || "",
          payload: {
            farmName,
          },
        });

        await updateDocsByQuery({
          collectionName: "heaps",
          field: "farmId",
          value: farmId,
          payload: {
            farmName,
          },
        });
      }

      if (operation === "update-related-kubra-name") {
        const kubraId = payload?.kubraId;
        const kubraName = payload?.kubraName;

        if (!kubraId) throw new Error("Missing kubraId");

        await updateDocsByQuery({
          collectionName: "assets",
          field: "kubraId",
          value: kubraId,
          payload: {
            kubraName,
            placeName: kubraName,
          },
        });

        await updateDocsByQuery({
          collectionName: "assets",
          field: "placeId",
          value: kubraId,
          payload: {
            kubraName,
            placeName: kubraName,
          },
        });
      }

      if (operation === "update-related-worker-name") {
        const workerId = payload?.workerId;
        const workerName = payload?.workerName;

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
          query(
            collection(db, "assets"),
            where("workerIds", "array-contains", workerId)
          )
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
                      }
                    : worker
                )
              : [];

            const workerNames = workers.map((worker) => worker.name).join("، ");

            return updateDoc(doc(db, "assets", assetDoc.id), {
              workers,
              workerNames,
              updatedAt: serverTimestamp(),
              syncedAt: serverTimestamp(),
            });
          })
        );
      }

      if (operation === "update-related-engineer-name") {
        const engineerId = payload?.engineerId;
        const engineerName = payload?.engineerName;

        if (!engineerId) throw new Error("Missing engineerId");

        const farmsSnap = await getDocs(
          query(
            collection(db, "farms"),
            where("engineerIds", "array-contains", engineerId)
          )
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
                      }
                    : engineer
                )
              : [];

            const engineerNames = engineers
              .map((engineer) => engineer.name)
              .join("، ");

            return updateDoc(doc(db, "farms", farmDoc.id), {
              engineers,
              engineerNames,
              updatedAt: serverTimestamp(),
              syncedAt: serverTimestamp(),
            });
          })
        );
      }

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

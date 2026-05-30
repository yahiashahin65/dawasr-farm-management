import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  getOfflineQueue,
  removeOfflineOperation,
  isOnline,
} from "./offlineQueue";

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

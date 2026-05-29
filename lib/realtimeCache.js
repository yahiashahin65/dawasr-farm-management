import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

const isBrowser = typeof window !== "undefined";

export const getCachedCollection = (cacheKey) => {
  if (!isBrowser) return [];

  try {
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

export const setCachedCollection = (cacheKey, data) => {
  if (!isBrowser) return;

  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // ignore cache errors
  }
};

export const subscribeCachedCollection = ({
  db,
  collectionName,
  cacheKey,
  orderField = "createdAt",
  orderDirection = "desc",
  onData,
  onLoading,
  onError,
}) => {
  const cachedData = getCachedCollection(cacheKey);

  if (cachedData.length) {
    onData(cachedData);
    onLoading?.(false);
  } else {
    onLoading?.(true);
  }

  const q = query(
    collection(db, collectionName),
    orderBy(orderField, orderDirection)
  );

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const freshData = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setCachedCollection(cacheKey, freshData);
      onData(freshData);
      onLoading?.(false);
    },
    (error) => {
      console.error(error);
      onError?.(error);
      onLoading?.(false);
    }
  );

  return unsubscribe;
};

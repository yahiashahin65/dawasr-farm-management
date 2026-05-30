import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

const isBrowser = typeof window !== "undefined";

const emitCacheUpdated = (cacheKey) => {
  if (!isBrowser) return;

  window.dispatchEvent(
    new CustomEvent("cache-updated", {
      detail: { cacheKey },
    })
  );
};

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
    emitCacheUpdated(cacheKey);
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
  const readCache = () => {
    const cachedData = getCachedCollection(cacheKey);

    if (cachedData.length) {
      onData(cachedData);
      onLoading?.(false);
    } else {
      onLoading?.(true);
    }
  };

  readCache();

  const onCacheUpdated = (event) => {
    if (event.detail?.cacheKey !== cacheKey) return;

    const cachedData = getCachedCollection(cacheKey);
    onData(cachedData);
    onLoading?.(false);
  };

  if (isBrowser) {
    window.addEventListener("cache-updated", onCacheUpdated);
  }

  const q = query(
    collection(db, collectionName),
    orderBy(orderField, orderDirection)
  );

  const unsubscribeSnapshot = onSnapshot(
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

  return () => {
    unsubscribeSnapshot?.();

    if (isBrowser) {
      window.removeEventListener("cache-updated", onCacheUpdated);
    }
  };
};

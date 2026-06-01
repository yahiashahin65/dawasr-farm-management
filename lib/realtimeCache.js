export const subscribeCachedCollection = ({
  db,
  collectionName,
  cacheKey,
  orderField = "createdAt",
  orderDirection = "desc",
  onData,
  onLoading,
  onError,
  useInitialCache = true,
}) => {
  const readCache = () => {
    if (!useInitialCache) {
      onLoading?.(true);
      return;
    }

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
    if (!useInitialCache) return;
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

      const cachedData = getCachedCollection(cacheKey);

      if (cachedData.length) {
        onData(cachedData);
      }

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

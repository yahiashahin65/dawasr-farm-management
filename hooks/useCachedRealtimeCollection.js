import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeFirestoreDoc = (doc) => ({
  id: doc.id,
  ...doc.data(),
});

export default function useCachedRealtimeCollection(
  collectionName,
  options = {}
) {
  const {
    cacheKey = collectionName,
    orderField = "createdAt",
    orderDirection = "desc",
    enabled = true,
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !collectionName) return;

    const storageKey = `farm-cache-${cacheKey}`;

    const cached = safeParse(localStorage.getItem(storageKey), []);

    if (cached.length) {
      setData(cached);
      setFromCache(true);
      setLoading(false);
    }

    const q = query(
      collection(db, collectionName),
      orderBy(orderField, orderDirection)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextData = snapshot.docs.map(normalizeFirestoreDoc);

        setData(nextData);
        setFromCache(false);
        setLoading(false);
        localStorage.setItem(storageKey, JSON.stringify(nextData));
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, cacheKey, orderField, orderDirection, enabled]);

  const clearCache = () => {
    localStorage.removeItem(`farm-cache-${cacheKey}`);
  };

  return {
    data,
    loading,
    fromCache,
    error,
    clearCache,
  };
}

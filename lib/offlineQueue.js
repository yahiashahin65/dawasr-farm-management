const QUEUE_KEY = "offlineQueue";

const isBrowser = typeof window !== "undefined";

const emitQueueUpdated = () => {
  if (!isBrowser) return;
  window.dispatchEvent(new Event("offline-queue-updated"));
};

export const getOfflineQueue = () => {
  if (!isBrowser) return [];

  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
};

export const setOfflineQueue = (queue) => {
  if (!isBrowser) return;

  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  emitQueueUpdated();
};

export const getOfflineQueueCount = () => {
  return getOfflineQueue().length;
};

export const addOfflineOperation = ({
  collectionName,
  operation,
  documentId = "",
  payload = {},
  meta = {},
}) => {
  const queue = getOfflineQueue();

  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    collectionName,
    operation, // create | update | delete | move
    documentId,
    payload,
    meta,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  setOfflineQueue([...queue, item]);

  return item;
};

export const removeOfflineOperation = (operationId) => {
  const queue = getOfflineQueue();
  setOfflineQueue(queue.filter((item) => item.id !== operationId));
};

export const clearOfflineQueue = () => {
  setOfflineQueue([]);
};

export const isOnline = () => {
  if (!isBrowser) return true;
  return navigator.onLine;
};

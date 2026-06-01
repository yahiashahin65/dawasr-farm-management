const CACHE_NAME = "dawasr-farm-management-v3";

const APP_SHELL = [
  "/",
  "/dashboard",
  "/reports",
  "/analytics",
  "/assets",
  "/workers",
  "/engineers",
  "/farms",
  "/kubras",
  "/heaps",
  "/sprinklers",
  "/settings",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "مزارع السنبلة";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: {
        url: data.url || "/activity-logs",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/activity-logs";

  event.waitUntil(self.clients.openWindow(url));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  if (
    request.url.includes("firestore.googleapis.com") ||
    request.url.includes("firebase") ||
    request.url.includes("googleapis.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) return response;

        const responseClone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone).catch(() => {});
        });

        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) return cachedResponse;

        if (request.mode === "navigate") {
          return caches.match("/dashboard");
        }

        return new Response("", {
          status: 408,
          statusText: "Offline",
        });
      })
  );
});

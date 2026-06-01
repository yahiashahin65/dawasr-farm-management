const CACHE_NAME = "dawasr-farm-management-v4";

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

try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyBU_xJt8rPRkDYvfIhLpHShp0bSDhti4d0",
    authDomain: "farm-a8328.firebaseapp.com",
    projectId: "farm-a8328",
    storageBucket: "farm-a8328.firebasestorage.app",
    messagingSenderId: "650295138273",
    appId: "1:650295138273:web:c4ae99294e2312cbd064a0",
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "مزارع السنبلة";

    self.registration.showNotification(title, {
      body: payload.notification?.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: {
        url: payload.data?.url || "/activity-logs",
      },
    });
  });
} catch (error) {
  console.error("Firebase messaging SW failed:", error);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/activity-logs";

  event.waitUntil(self.clients.openWindow(url));
});

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

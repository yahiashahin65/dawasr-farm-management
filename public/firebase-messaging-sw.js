importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBU_xJtbrRPKDYvfIhLpHSHpObSDhti4d0",
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification?.data?.url || "/activity-logs";

  event.waitUntil(
    self.clients.openWindow(urlToOpen)
  );
});

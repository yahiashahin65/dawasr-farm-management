import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";

import { db, getFirebaseMessaging } from "./firebase";

export const requestPushPermission = async (user) => {
  if (typeof window === "undefined") return null;

  if (!("Notification" in window)) {
    throw new Error("المتصفح لا يدعم الإشعارات");
  }

  if (!("serviceWorker" in navigator)) {
    throw new Error("المتصفح لا يدعم Service Worker");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("لم يتم السماح بالإشعارات");
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    throw new Error("Firebase Messaging غير مدعوم على هذا المتصفح");
  }

  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    {
      scope: "/",
      updateViaCache: "none",
    }
  );

  await navigator.serviceWorker.ready;
  await registration.update();

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  if (!vapidKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_VAPID_KEY غير موجود في Vercel");
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("تعذر إنشاء notification token");
  }

  await setDoc(
    doc(db, "pushTokens", token),
    {
      token,
      userId: user?.uid || "",
      userName: user?.displayName || user?.email || "مستخدم",
      userEmail: user?.email || "",
      platform: "web",
      active: true,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
};

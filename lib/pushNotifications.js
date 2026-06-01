import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";

import { db, getFirebaseMessaging } from "./firebase";

export const requestPushPermission = async (user) => {
  if (typeof window === "undefined") return null;

  if (!("Notification" in window)) {
    throw new Error("المتصفح لا يدعم الإشعارات");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("لم يتم السماح بالإشعارات");
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    throw new Error("Firebase Messaging غير مدعوم على هذا المتصفح");
  }

  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
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
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
};

export const listenForegroundMessages = async (callback) => {
  const messaging = await getFirebaseMessaging();

  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    callback?.(payload);
  });
};

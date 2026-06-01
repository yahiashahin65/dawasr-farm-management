import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";
const firebaseConfig = {
  apiKey: "AIzaSyBU_xJt8rPRkDYvfIhLpHShp0bSDhti4d0",
  authDomain: "farm-a8328.firebaseapp.com",
  projectId: "farm-a8328",
  storageBucket: "farm-a8328.firebasestorage.app",
  messagingSenderId: "650295138273",
  appId: "1:650295138273:web:c4ae99294e2312cbd064a0"
};
export const getFirebaseMessaging = async () => {
  if (typeof window === "undefined") return null;

  const supported = await isSupported();

  if (!supported) return null;

  return getMessaging(app);
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

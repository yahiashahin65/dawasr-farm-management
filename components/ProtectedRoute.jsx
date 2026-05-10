import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export default function ProtectedRoute({ children }) {
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }

        try {
          const userRef = doc(
            db,
            "users",
            user.uid
          );

          const userSnap = await getDoc(
            userRef
          );

          if (!userSnap.exists()) {
            router.replace("/login");
            return;
          }

          const role =
            userSnap.data()?.role || "viewer";

          if (
            role !== "admin" &&
            role !== "viewer"
          ) {
            router.replace("/login");
            return;
          }
        } catch (error) {
          console.error(error);
          router.replace("/login");
          return;
        } finally {
          setChecking(false);
        }
      }
    );

    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50 text-lg font-bold text-slate-600"
      >
        جاري التحقق من تسجيل الدخول...
      </div>
    );
  }

  return children;
}

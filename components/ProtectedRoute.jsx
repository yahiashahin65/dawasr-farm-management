import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        setChecking(false);
        router.replace("/login");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists()) {
          setAllowed(false);
          router.replace("/login");
          return;
        }

        const role = userSnap.data()?.role || "viewer";

        if (role !== "admin" && role !== "viewer") {
          setAllowed(false);
          router.replace("/login");
          return;
        }

        setAllowed(true);
      } catch (error) {
        console.error(error);
        setAllowed(false);
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, []);

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

  if (!allowed) return null;

  return children;
}

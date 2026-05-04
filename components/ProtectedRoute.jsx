import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/login");
      else setChecking(false);
    });
    return () => unsub();
  }, [router]);

  if (checking) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center text-gray-600">جاري التحقق من تسجيل الدخول...</div>;
  }
  return children;
}

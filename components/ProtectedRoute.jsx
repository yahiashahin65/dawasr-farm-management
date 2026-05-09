import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserRole(userSnap.data().role || "viewer");
        } else {
          setUserRole("viewer");
        }
      } catch (error) {
        console.error(error);
        setUserRole("viewer");
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center text-gray-600"
      >
        جاري التحقق من تسجيل الدخول...
      </div>
    );
  }

  return children;
}

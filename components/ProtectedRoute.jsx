import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const allowed = !!user && (role === "admin" || role === "viewer");

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/login");
    }
  }, [loading, allowed, router]);

  if (loading) {
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

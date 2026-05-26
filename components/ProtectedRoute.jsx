import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import AppLoader from "./AppLoader";

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
      <AppLoader
        title="جاري تحميل معدات مزارع السنبلة..."
        subtitle="يتم التحقق من الصلاحيات"
      />
    );
  }

  if (!allowed) return null;

  return children;
}

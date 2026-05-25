import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTractor } from "@fortawesome/free-solid-svg-icons";

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
        className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-slate-100 px-6"
      >
        <style jsx>{`
          .tractor-track {
            position: relative;
            width: min(520px, 90vw);
            height: 130px;
            overflow: hidden;
          }

          .tractor {
            position: absolute;
            left: -120px;
            bottom: 28px;
            font-size: 54px;
            color: #15803d;
            animation: tractorMove 2.4s ease-in-out infinite;
            filter: drop-shadow(0 10px 12px rgba(21, 128, 61, 0.25));
          }

          .dust {
            position: absolute;
            bottom: 22px;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(120, 113, 108, 0.35);
            animation: dustMove 2.4s ease-in-out infinite;
          }

          .dust.one {
            left: 70px;
            animation-delay: 0.2s;
          }

          .dust.two {
            left: 45px;
            animation-delay: 0.45s;
          }

          .dust.three {
            left: 20px;
            animation-delay: 0.7s;
          }

          .ground {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 18px;
            height: 4px;
            border-radius: 999px;
            background: linear-gradient(
              to left,
              transparent,
              #84cc16,
              #16a34a,
              transparent
            );
          }

          @keyframes tractorMove {
            0% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(calc(min(520px, 90vw) - 20px));
            }
            100% {
              transform: translateX(0);
            }
          }

          @keyframes dustMove {
            0%,
            100% {
              opacity: 0;
              transform: translateX(0) scale(0.6);
            }
            45% {
              opacity: 1;
              transform: translateX(-30px) scale(1);
            }
            70% {
              opacity: 0;
              transform: translateX(-55px) scale(1.4);
            }
          }
        `}</style>

        <div className="text-center">
          <div className="tractor-track mx-auto">
            <div className="tractor">
              <FontAwesomeIcon icon={faTractor} />
            </div>

            <span className="dust one" />
            <span className="dust two" />
            <span className="dust three" />
            <div className="ground" />
          </div>

          <p className="mt-4 text-lg font-black text-green-800">
            جاري تجهيز المزرعة...
          </p>

          <p className="mt-1 text-sm font-bold text-slate-500">
            يتم التحقق من تسجيل الدخول
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return children;
}

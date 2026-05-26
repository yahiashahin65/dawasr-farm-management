import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTractor } from "@fortawesome/free-solid-svg-icons";

export default function ProtectedRoute({ children, pageLoading = false }) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const allowed = !!user && (role === "admin" || role === "viewer");

  useEffect(() => {
    if (!loading && !pageLoading && !allowed) {
      router.replace("/login");
    }
  }, [loading, pageLoading, allowed, router]);

  if (loading || pageLoading) {
    return (
      <div
        dir="rtl"
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-green-50 via-lime-50 to-emerald-100 px-6"
      >
        <style jsx>{`
          .farm-loader {
            position: relative;
            width: min(720px, 94vw);
            min-height: 360px;
          }

          .sign-board {
            position: absolute;
            right: 0;
            top: 35px;
            z-index: 5;
            width: 260px;
            border: 4px solid #7c4a20;
            border-radius: 22px;
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            padding: 18px 16px;
            text-align: center;
            box-shadow: 0 18px 35px rgba(120, 53, 15, 0.2);
          }

          .sign-board::before,
          .sign-board::after {
            content: "";
            position: absolute;
            bottom: -72px;
            width: 12px;
            height: 72px;
            border-radius: 999px;
            background: #7c4a20;
          }

          .sign-board::before {
            right: 42px;
          }

          .sign-board::after {
            left: 42px;
          }

          .sun {
            position: absolute;
            left: 55px;
            top: 30px;
            width: 74px;
            height: 74px;
            border-radius: 999px;
            background: #facc15;
            box-shadow: 0 0 50px rgba(250, 204, 21, 0.55);
          }

          .cloud {
            position: absolute;
            top: 60px;
            left: 150px;
            width: 100px;
            height: 34px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.85);
            animation: cloudMove 5s ease-in-out infinite;
          }

          .cloud::before,
          .cloud::after {
            content: "";
            position: absolute;
            bottom: 10px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.9);
          }

          .cloud::before {
            right: 18px;
            width: 42px;
            height: 42px;
          }

          .cloud::after {
            left: 18px;
            width: 52px;
            height: 52px;
          }

          .tractor-track {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 80px;
            height: 145px;
            overflow: hidden;
          }

          .tractor {
            position: absolute;
            left: -120px;
            bottom: 34px;
            z-index: 4;
            font-size: 64px;
            color: #15803d;
            animation: tractorMove 3s ease-in-out infinite;
            filter: drop-shadow(0 14px 16px rgba(21, 128, 61, 0.3));
          }

          .grass-ground {
            position: absolute;
            left: -20px;
            right: -20px;
            bottom: 0;
            height: 96px;
            border-radius: 50% 50% 0 0 / 25% 25% 0 0;
            background:
              repeating-linear-gradient(
                90deg,
                rgba(22, 163, 74, 0.95) 0 4px,
                rgba(132, 204, 22, 0.95) 4px 8px,
                rgba(21, 128, 61, 0.95) 8px 12px
              );
            box-shadow: inset 0 18px 35px rgba(255, 255, 255, 0.22);
          }

          .grass-ground::before {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: -14px;
            height: 24px;
            background:
              repeating-linear-gradient(
                -70deg,
                transparent 0 12px,
                #16a34a 12px 16px,
                transparent 16px 28px
              );
          }

          .dust {
            position: absolute;
            bottom: 46px;
            width: 9px;
            height: 9px;
            border-radius: 999px;
            background: rgba(120, 113, 108, 0.35);
            animation: dustMove 3s ease-in-out infinite;
          }

          .dust.one {
            left: 90px;
            animation-delay: 0.2s;
          }

          .dust.two {
            left: 62px;
            animation-delay: 0.45s;
          }

          .dust.three {
            left: 35px;
            animation-delay: 0.7s;
          }

          .loading-text {
            position: absolute;
            right: 0;
            left: 0;
            bottom: -8px;
            text-align: center;
          }

          @keyframes tractorMove {
            0% {
              transform: translateX(0) rotate(0deg);
            }
            50% {
              transform: translateX(calc(min(720px, 94vw) - 20px)) rotate(-2deg);
            }
            100% {
              transform: translateX(0) rotate(0deg);
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
              transform: translateX(-38px) scale(1);
            }
            70% {
              opacity: 0;
              transform: translateX(-70px) scale(1.4);
            }
          }

          @keyframes cloudMove {
            0%,
            100% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(28px);
            }
          }
        `}</style>

        <div className="farm-loader">
          <div className="sun" />
          <div className="cloud" />

          <div className="sign-board">
            <p className="text-lg font-black text-green-900">
              معدات مزارع السنبلة
            </p>
            <p className="mt-1 text-xs font-bold text-amber-800">
              نظام إدارة المعدات والعهد
            </p>
          </div>

          <div className="tractor-track">
            <div className="tractor">
              <FontAwesomeIcon icon={faTractor} />
            </div>

            <span className="dust one" />
            <span className="dust two" />
            <span className="dust three" />
          </div>

          <div className="grass-ground" />

          <div className="loading-text">
            <p className="text-xl font-black text-green-900">
              جاري تحميل معدات مزارع السنبلة...
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              يتم تجهيز البيانات والتحقق من الصلاحيات
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return children;
}

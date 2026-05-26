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
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-lime-50 to-green-200 px-6"
      >
        <style jsx>{`
          .scene {
            position: relative;
            width: min(760px, 95vw);
            height: 430px;
            border-radius: 42px;
            overflow: hidden;
            background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.72),
              rgba(236, 253, 245, 0.9)
            );
            box-shadow:
              0 35px 80px rgba(21, 128, 61, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.65);
          }

          .sun {
            position: absolute;
            left: 60px;
            top: 42px;
            width: 86px;
            height: 86px;
            border-radius: 50%;
            background:
              radial-gradient(circle at 35% 30%, #fff7ad 0 16%, #facc15 38%, #f59e0b 100%);
            box-shadow:
              0 0 70px rgba(250, 204, 21, 0.7),
              inset -10px -12px 20px rgba(180, 83, 9, 0.18),
              inset 10px 10px 18px rgba(255, 255, 255, 0.42);
          }

          .sun::after {
            content: "";
            position: absolute;
            inset: -18px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(250, 204, 21, 0.25), transparent 68%);
            animation: sunPulse 2.8s ease-in-out infinite;
          }

          .cloud {
            position: absolute;
            top: 78px;
            left: 180px;
            width: 125px;
            height: 38px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.92);
            box-shadow:
              0 14px 28px rgba(15, 23, 42, 0.08),
              inset 0 -6px 12px rgba(226, 232, 240, 0.7);
            animation: cloudMove 5s ease-in-out infinite;
          }

          .cloud::before,
          .cloud::after {
            content: "";
            position: absolute;
            bottom: 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.96);
          }

          .cloud::before {
            right: 18px;
            width: 52px;
            height: 52px;
          }

          .cloud::after {
            left: 20px;
            width: 62px;
            height: 62px;
          }

          .sign-board {
            position: absolute;
            right: 44px;
            top: 52px;
            z-index: 8;
            width: 285px;
            transform: perspective(700px) rotateY(-7deg) rotateX(2deg);
            border: 5px solid #7c4a20;
            border-radius: 26px;
            background:
              linear-gradient(135deg, #fef3c7, #fde68a 55%, #fbbf24);
            padding: 20px 16px;
            text-align: center;
            box-shadow:
              0 24px 36px rgba(120, 53, 15, 0.28),
              inset 0 3px 0 rgba(255, 255, 255, 0.55),
              inset 0 -8px 15px rgba(146, 64, 14, 0.14);
          }

          .sign-board::before,
          .sign-board::after {
            content: "";
            position: absolute;
            bottom: -85px;
            width: 14px;
            height: 85px;
            border-radius: 999px;
            background: linear-gradient(90deg, #7c4a20, #a16207, #78350f);
            box-shadow: 0 12px 15px rgba(120, 53, 15, 0.18);
          }

          .sign-board::before {
            right: 48px;
          }

          .sign-board::after {
            left: 48px;
          }

          .sign-title {
            text-shadow: 0 2px 0 rgba(255, 255, 255, 0.55);
          }

          .tractor-track {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 112px;
            height: 155px;
            overflow: hidden;
            z-index: 6;
          }

          .tractor-wrap {
            position: absolute;
            left: -140px;
            bottom: 30px;
            animation: tractorMove 3.2s ease-in-out infinite;
          }

          .tractor-shadow {
            position: absolute;
            left: 8px;
            bottom: -16px;
            width: 105px;
            height: 18px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.18);
            filter: blur(4px);
            transform: perspective(400px) rotateX(65deg);
          }

          .tractor {
            position: relative;
            z-index: 2;
            font-size: 72px;
            color: #15803d;
            transform: perspective(700px) rotateY(-16deg) rotateX(5deg);
            filter:
              drop-shadow(0 16px 14px rgba(21, 128, 61, 0.28))
              drop-shadow(-4px 4px 0 rgba(20, 83, 45, 0.18));
          }

          .wheel {
            position: absolute;
            bottom: 1px;
            z-index: 3;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 5px solid #14532d;
            background: radial-gradient(circle, #bbf7d0 0 25%, #166534 28% 100%);
            animation: wheelSpin 0.6s linear infinite;
          }

          .wheel.big {
            right: 6px;
            width: 30px;
            height: 30px;
            bottom: -2px;
          }

          .wheel.small {
            left: 12px;
          }

          .dust {
            position: absolute;
            bottom: 50px;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: rgba(120, 113, 108, 0.32);
            animation: dustMove 3.2s ease-in-out infinite;
            z-index: 5;
          }

          .dust.one {
            left: 90px;
            animation-delay: 0.15s;
          }

          .dust.two {
            left: 62px;
            animation-delay: 0.38s;
          }

          .dust.three {
            left: 35px;
            animation-delay: 0.62s;
          }

          .grass-ground {
            position: absolute;
            left: -25px;
            right: -25px;
            bottom: 0;
            height: 135px;
            z-index: 4;
            border-radius: 50% 50% 0 0 / 22% 22% 0 0;
            background:
              radial-gradient(circle at 20% 20%, rgba(255,255,255,0.2), transparent 22%),
              repeating-linear-gradient(
                90deg,
                #15803d 0 4px,
                #22c55e 4px 8px,
                #84cc16 8px 12px,
                #166534 12px 16px
              );
            box-shadow:
              inset 0 24px 32px rgba(255, 255, 255, 0.22),
              inset 0 -18px 25px rgba(20, 83, 45, 0.25);
          }

          .grass-ground::before {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: -18px;
            height: 34px;
            background:
              repeating-linear-gradient(
                -65deg,
                transparent 0 10px,
                #16a34a 10px 14px,
                transparent 14px 25px
              );
            opacity: 0.95;
          }

          .grass-ground::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 20px;
            height: 18px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          }

          .loading-text {
            position: absolute;
            right: 0;
            left: 0;
            bottom: 26px;
            z-index: 9;
            text-align: center;
          }

          .loading-pill {
            display: inline-block;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.76);
            border: 1px solid rgba(255, 255, 255, 0.82);
            padding: 10px 22px;
            box-shadow: 0 18px 30px rgba(22, 101, 52, 0.18);
            backdrop-filter: blur(10px);
          }

          @keyframes tractorMove {
            0% {
              transform: translateX(0) translateY(0);
            }
            45% {
              transform: translateX(calc(min(760px, 95vw) - 20px)) translateY(-4px);
            }
            50% {
              transform: translateX(calc(min(760px, 95vw) - 20px)) translateY(0);
            }
            100% {
              transform: translateX(0) translateY(0);
            }
          }

          @keyframes wheelSpin {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes dustMove {
            0%,
            100% {
              opacity: 0;
              transform: translateX(0) translateY(0) scale(0.55);
            }
            45% {
              opacity: 1;
              transform: translateX(-40px) translateY(-8px) scale(1);
            }
            70% {
              opacity: 0;
              transform: translateX(-78px) translateY(-16px) scale(1.45);
            }
          }

          @keyframes cloudMove {
            0%,
            100% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(32px);
            }
          }

          @keyframes sunPulse {
            0%,
            100% {
              opacity: 0.6;
              transform: scale(1);
            }
            50% {
              opacity: 0.95;
              transform: scale(1.08);
            }
          }

          @media (max-width: 640px) {
            .scene {
              height: 420px;
              border-radius: 30px;
            }

            .sign-board {
              right: 50%;
              transform: translateX(50%) perspective(700px) rotateX(2deg);
              top: 32px;
              width: 260px;
            }

            .sun {
              left: 24px;
              top: 24px;
              width: 62px;
              height: 62px;
            }

            .cloud {
              display: none;
            }

            .tractor {
              font-size: 62px;
            }
          }
        `}</style>

        <div className="scene">
          <div className="sun" />
          <div className="cloud" />

          <div className="sign-board">
            <p className="sign-title text-xl font-black text-green-950">
              معدات مزارع السنبلة
            </p>
          </div>

          <div className="tractor-track">
            <div className="tractor-wrap">
              <div className="tractor-shadow" />
              <div className="tractor">
                <FontAwesomeIcon icon={faTractor} />
              </div>
              <span className="wheel big" />
              <span className="wheel small" />
            </div>

            <span className="dust one" />
            <span className="dust two" />
            <span className="dust three" />
          </div>

          <div className="grass-ground" />

          <div className="loading-text">
            <div className="loading-pill">
              <p className="text-lg font-black text-green-950">
                جاري تحميل معدات مزارع السنبلة...
              </p>
              <p className="mt-1 text-xs font-bold text-slate-600">
                يتم تجهيز البيانات والتحقق من الصلاحيات
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return children;
}

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

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
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-sky-200 via-emerald-50 to-green-200 px-5"
      >
        <style jsx>{`
          .sun {
            position: fixed;
            left: -62px;
            top: -70px;
            z-index: 1;
            width: 165px;
            height: 165px;
            border-radius: 50%;
            background: radial-gradient(
              circle at 62% 62%,
              #fff7ad 0 10%,
              #facc15 38%,
              #f59e0b 78%
            );
            box-shadow: 0 0 90px rgba(250, 204, 21, 0.75);
          }

          .sun-rays {
            position: fixed;
            left: -90px;
            top: -90px;
            z-index: 0;
            width: 260px;
            height: 260px;
            background: conic-gradient(
              from 0deg,
              rgba(250, 204, 21, 0.18),
              transparent 12deg,
              rgba(250, 204, 21, 0.2) 22deg,
              transparent 34deg
            );
            border-radius: 50%;
            filter: blur(1px);
            animation: sunPulse 3s ease-in-out infinite;
          }

          .birds {
            position: fixed;
            top: 76px;
            left: 50%;
            z-index: 2;
            width: 180px;
            height: 70px;
            transform: translateX(-50%);
            opacity: 0.55;
          }

          .bird {
            position: absolute;
            width: 24px;
            height: 12px;
            border-top: 4px solid #475569;
            border-radius: 50%;
            animation: birdFloat 2.8s ease-in-out infinite;
          }

          .bird::after {
            content: "";
            position: absolute;
            right: 15px;
            top: -4px;
            width: 24px;
            height: 12px;
            border-top: 4px solid #475569;
            border-radius: 50%;
            transform: rotate(-12deg);
          }

          .bird.one {
            right: 20px;
            top: 0;
          }

          .bird.two {
            right: 82px;
            top: 36px;
            transform: scale(0.85);
            animation-delay: 0.35s;
          }

          .bird.three {
            left: 6px;
            top: 18px;
            transform: scale(0.72);
            animation-delay: 0.65s;
          }

          .scene {
            position: relative;
            z-index: 3;
            width: min(920px, 94vw);
            height: min(760px, 78vh);
            min-height: 560px;
            overflow: hidden;
            border-radius: 46px;
            border: 5px solid rgba(255, 255, 255, 0.85);
            background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.66),
              rgba(240, 253, 244, 0.92)
            );
            box-shadow:
              0 34px 80px rgba(21, 128, 61, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(8px);
          }

          .cloud {
            position: absolute;
            top: 70px;
            right: 70px;
            width: 130px;
            height: 40px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.92);
            box-shadow:
              0 16px 28px rgba(15, 23, 42, 0.08),
              inset 0 -8px 14px rgba(226, 232, 240, 0.75);
            animation: cloudMove 5.5s ease-in-out infinite;
          }

          .cloud::before,
          .cloud::after {
            content: "";
            position: absolute;
            bottom: 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.97);
          }

          .cloud::before {
            right: 18px;
            width: 54px;
            height: 54px;
          }

          .cloud::after {
            left: 18px;
            width: 66px;
            height: 66px;
          }

          .sign-board {
            position: absolute;
            top: 92px;
            right: 50%;
            z-index: 9;
            width: min(520px, 82vw);
            padding: 26px 24px;
            text-align: center;
            border: 7px solid #7c4a20;
            border-radius: 30px;
            background:
              linear-gradient(90deg, rgba(120, 53, 15, 0.18), transparent 12%, transparent 88%, rgba(120, 53, 15, 0.15)),
              linear-gradient(180deg, #fde68a, #fbbf24);
            transform: translateX(50%);
            box-shadow:
              0 24px 40px rgba(120, 53, 15, 0.28),
              inset 0 5px 0 rgba(255, 255, 255, 0.45),
              inset 0 -10px 18px rgba(146, 64, 14, 0.16);
          }

          .sign-board::before,
          .sign-board::after {
            content: "";
            position: absolute;
            bottom: -112px;
            width: 26px;
            height: 112px;
            border-radius: 999px;
            background: linear-gradient(90deg, #7c4a20, #b45309, #78350f);
            box-shadow: 0 16px 22px rgba(120, 53, 15, 0.22);
          }

          .sign-board::before {
            right: 72px;
          }

          .sign-board::after {
            left: 72px;
          }

          .sign-title {
            color: #14532d;
            font-size: clamp(24px, 4vw, 38px);
            font-weight: 900;
            text-shadow: 0 3px 0 rgba(255, 255, 255, 0.55);
          }

          .hill {
            position: absolute;
            right: -8%;
            bottom: 0;
            z-index: 5;
            width: 116%;
            height: 280px;
            border-radius: 50% 50% 0 0 / 28% 28% 0 0;
            background:
              radial-gradient(circle at 18% 22%, rgba(255, 255, 255, 0.16), transparent 20%),
              linear-gradient(180deg, #7ccf31 0%, #22a447 42%, #0f6d32 100%);
            box-shadow:
              inset 0 28px 36px rgba(255, 255, 255, 0.2),
              inset 0 -24px 35px rgba(20, 83, 45, 0.28);
          }

          .hill::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(circle, rgba(255, 255, 255, 0.32) 0 1px, transparent 2px),
              linear-gradient(105deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 20px);
            background-size: 40px 28px, 34px 34px;
            opacity: 0.45;
          }

          .tractor-track {
            position: absolute;
            right: 0;
            left: 0;
            bottom: 250px;
            z-index: 8;
            height: 150px;
            overflow: hidden;
          }

          .tractor {
            position: absolute;
            left: -180px;
            bottom: 0;
            width: 150px;
            height: 95px;
            animation: tractorMove 3.2s ease-in-out infinite;
            filter: drop-shadow(0 18px 18px rgba(20, 83, 45, 0.28));
          }

          .tractor-body {
            position: absolute;
            left: 42px;
            bottom: 26px;
            width: 86px;
            height: 42px;
            border-radius: 12px 18px 10px 8px;
            background: linear-gradient(135deg, #22c55e, #15803d 65%, #166534);
            box-shadow:
              inset 0 4px 7px rgba(255, 255, 255, 0.28),
              inset 0 -7px 10px rgba(20, 83, 45, 0.35);
          }

          .tractor-front {
            position: absolute;
            right: 8px;
            bottom: 30px;
            width: 35px;
            height: 32px;
            border-radius: 9px 18px 12px 8px;
            background: linear-gradient(135deg, #16a34a, #166534);
          }

          .tractor-cabin {
            position: absolute;
            left: 24px;
            bottom: 58px;
            width: 48px;
            height: 42px;
            border-radius: 13px 13px 7px 7px;
            background: #15803d;
            box-shadow: inset 0 4px 6px rgba(255, 255, 255, 0.25);
          }

          .tractor-window {
            position: absolute;
            left: 32px;
            bottom: 66px;
            width: 31px;
            height: 24px;
            border-radius: 7px 7px 4px 4px;
            background: linear-gradient(135deg, #dff8ff, #a7f3d0);
          }

          .tractor-pipe {
            position: absolute;
            right: 24px;
            bottom: 62px;
            width: 8px;
            height: 32px;
            border-radius: 999px;
            background: #334155;
          }

          .wheel {
            position: absolute;
            bottom: 0;
            border-radius: 50%;
            border: 9px solid #1f2937;
            background:
              radial-gradient(circle, #fde047 0 20%, #92400e 22% 30%, #111827 32% 100%);
            animation: wheelSpin 0.6s linear infinite;
          }

          .wheel.big {
            left: 20px;
            width: 58px;
            height: 58px;
          }

          .wheel.small {
            right: 18px;
            bottom: 3px;
            width: 42px;
            height: 42px;
          }

          .dust {
            position: absolute;
            bottom: 26px;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background: rgba(168, 162, 158, 0.48);
            animation: dustMove 3.2s ease-in-out infinite;
          }

          .dust.one {
            left: 80px;
            animation-delay: 0.15s;
          }

          .dust.two {
            left: 52px;
            animation-delay: 0.38s;
          }

          .dust.three {
            left: 24px;
            animation-delay: 0.62s;
          }

          .loading-card {
            position: absolute;
            right: 50%;
            bottom: 44px;
            z-index: 10;
            width: min(620px, 86vw);
            padding: 26px 30px 28px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.92);
            border-radius: 44px;
            background: rgba(255, 255, 255, 0.76);
            box-shadow:
              0 24px 45px rgba(22, 101, 52, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.94);
            transform: translateX(50%);
            backdrop-filter: blur(12px);
            animation: cardFloat 3s ease-in-out infinite;
          }

          .loading-title {
            color: #14532d;
            font-size: clamp(22px, 4vw, 34px);
            font-weight: 900;
            line-height: 1.35;
          }

          .loading-subtitle {
            margin-top: 6px;
            color: #64748b;
            font-size: 15px;
            font-weight: 800;
          }

          .progress {
            position: relative;
            height: 20px;
            margin-top: 20px;
            overflow: hidden;
            border-radius: 999px;
            border: 3px solid rgba(255, 255, 255, 0.8);
            background: rgba(226, 232, 240, 0.75);
          }

          .progress-fill {
            position: absolute;
            inset: 0 auto 0 0;
            width: 62%;
            border-radius: inherit;
            background:
              repeating-linear-gradient(
                -45deg,
                #22c55e 0 18px,
                #84cc16 18px 36px
              );
            animation: progressMove 1s linear infinite;
          }

          @keyframes tractorMove {
            0% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(calc(min(920px, 94vw) - 70px));
            }
            100% {
              transform: translateX(0);
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
              transform: translateX(0) scale(0.6);
            }
            45% {
              opacity: 1;
              transform: translateX(-42px) scale(1);
            }
            75% {
              opacity: 0;
              transform: translateX(-86px) scale(1.5);
            }
          }

          @keyframes progressMove {
            to {
              background-position: 36px 0;
            }
          }

          @keyframes cloudMove {
            0%,
            100% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(-26px);
            }
          }

          @keyframes birdFloat {
            0%,
            100% {
              transform: translateY(0) scale(var(--scale, 1));
            }
            50% {
              transform: translateY(-5px) scale(var(--scale, 1));
            }
          }

          @keyframes cardFloat {
            0%,
            100% {
              transform: translateX(50%) translateY(0);
            }
            50% {
              transform: translateX(50%) translateY(-7px);
            }
          }

          @keyframes sunPulse {
            0%,
            100% {
              opacity: 0.75;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.08);
            }
          }

          @media (max-width: 640px) {
            .sun {
              left: -52px;
              top: -58px;
              width: 138px;
              height: 138px;
            }

            .sun-rays {
              left: -82px;
              top: -82px;
              width: 220px;
              height: 220px;
            }

            .birds {
              top: 70px;
              width: 130px;
            }

            .scene {
              height: 620px;
              min-height: 620px;
              border-radius: 36px;
            }

            .sign-board {
              top: 84px;
              width: 78vw;
              padding: 20px 14px;
            }

            .sign-board::before,
            .sign-board::after {
              bottom: -95px;
              height: 95px;
              width: 18px;
            }

            .sign-board::before {
              right: 52px;
            }

            .sign-board::after {
              left: 52px;
            }

            .tractor-track {
              bottom: 258px;
            }

            .tractor {
              width: 128px;
              height: 82px;
            }

            .tractor-body {
              width: 72px;
              height: 36px;
            }

            .tractor-cabin {
              width: 42px;
              height: 37px;
            }

            .tractor-window {
              width: 27px;
              height: 21px;
            }

            .wheel.big {
              width: 50px;
              height: 50px;
            }

            .wheel.small {
              width: 36px;
              height: 36px;
            }

            .hill {
              height: 250px;
            }

            .loading-card {
              bottom: 36px;
              width: 86vw;
              padding: 22px 18px 24px;
              border-radius: 38px;
            }

            .loading-subtitle {
              font-size: 13px;
            }
          }
        `}</style>

        <div className="sun-rays" />
        <div className="sun" />

        <div className="birds">
          <span className="bird one" />
          <span className="bird two" />
          <span className="bird three" />
        </div>

        <div className="scene">
          <div className="cloud" />

          <div className="sign-board">
            <p className="sign-title">معدات مزارع السنبلة</p>
          </div>

          <div className="tractor-track">
            <div className="tractor">
              <div className="tractor-cabin" />
              <div className="tractor-window" />
              <div className="tractor-body" />
              <div className="tractor-front" />
              <div className="tractor-pipe" />
              <span className="wheel big" />
              <span className="wheel small" />
            </div>

            <span className="dust one" />
            <span className="dust two" />
            <span className="dust three" />
          </div>

          <div className="hill" />

          <div className="loading-card">
            <p className="loading-title">
              جاري تحميل معدات مزارع السنبلة...
            </p>
            <p className="loading-subtitle">
              يتم تجهيز البيانات والتحقق من الصلاحيات
            </p>

            <div className="progress">
              <div className="progress-fill" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return children;
}

export default function AppLoader({
  title = "جاري تحميل معدات مزارع السنبلة...",
  subtitle = "يتم تجهيز البيانات والتحقق من الصلاحيات",
  variant = "full",
}) {
  const isCompact = variant === "compact";

  return (
    <div
      dir="rtl"
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-sky-200 via-emerald-50 to-green-200 px-5 ${
        isCompact ? "min-h-[420px] rounded-[32px]" : "min-h-screen"
      }`}
    >
      <style jsx>{`
        .sun {
          position: fixed;
          left: -62px;
          top: -70px;
          z-index: 1;
          width: ${isCompact ? "120px" : "165px"};
          height: ${isCompact ? "120px" : "165px"};
          border-radius: 50%;
          background: radial-gradient(circle at 62% 62%, #fff7ad 0 10%, #facc15 38%, #f59e0b 78%);
          box-shadow: 0 0 90px rgba(250, 204, 21, 0.75);
        }

        .sun-rays {
          position: fixed;
          left: -90px;
          top: -90px;
          z-index: 0;
          width: ${isCompact ? "200px" : "260px"};
          height: ${isCompact ? "200px" : "260px"};
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

        .scene {
          position: relative;
          z-index: 3;
          width: ${isCompact ? "min(620px, 100%)" : "min(920px, 94vw)"};
          height: ${isCompact ? "400px" : "min(760px, 78vh)"};
          min-height: ${isCompact ? "400px" : "560px"};
          overflow: hidden;
          border-radius: ${isCompact ? "32px" : "46px"};
          border: 5px solid rgba(255, 255, 255, 0.85);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(240, 253, 244, 0.92));
          box-shadow: 0 34px 80px rgba(21, 128, 61, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
        }

        .cloud {
          position: absolute;
          top: ${isCompact ? "42px" : "70px"};
          right: ${isCompact ? "42px" : "70px"};
          width: ${isCompact ? "90px" : "130px"};
          height: ${isCompact ? "30px" : "40px"};
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
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
          width: ${isCompact ? "38px" : "54px"};
          height: ${isCompact ? "38px" : "54px"};
        }

        .cloud::after {
          left: 18px;
          width: ${isCompact ? "46px" : "66px"};
          height: ${isCompact ? "46px" : "66px"};
        }

        .sign-board {
          position: absolute;
          top: ${isCompact ? "45px" : "92px"};
          right: 50%;
          z-index: 9;
          width: ${isCompact ? "min(360px, 82vw)" : "min(520px, 82vw)"};
          padding: ${isCompact ? "16px 18px" : "26px 24px"};
          text-align: center;
          border: ${isCompact ? "5px" : "7px"} solid #7c4a20;
          border-radius: ${isCompact ? "24px" : "30px"};
          background: linear-gradient(180deg, #fde68a, #fbbf24);
          transform: translateX(50%);
          box-shadow: 0 24px 40px rgba(120, 53, 15, 0.28);
        }

        .sign-board::before,
        .sign-board::after {
          content: "";
          position: absolute;
          bottom: ${isCompact ? "-78px" : "-112px"};
          width: ${isCompact ? "18px" : "26px"};
          height: ${isCompact ? "78px" : "112px"};
          border-radius: 999px;
          background: linear-gradient(90deg, #7c4a20, #b45309, #78350f);
        }

        .sign-board::before {
          right: ${isCompact ? "52px" : "72px"};
        }

        .sign-board::after {
          left: ${isCompact ? "52px" : "72px"};
        }

        .sign-title {
          color: #14532d;
          font-size: ${isCompact ? "24px" : "clamp(24px, 4vw, 38px)"};
          font-weight: 900;
        }

        .hill {
          position: absolute;
          right: -8%;
          bottom: 0;
          z-index: 5;
          width: 116%;
          height: ${isCompact ? "175px" : "280px"};
          border-radius: 50% 50% 0 0 / 28% 28% 0 0;
          background: linear-gradient(180deg, #7ccf31 0%, #22a447 42%, #0f6d32 100%);
        }

        .tractor-track {
          position: absolute;
          right: 0;
          left: 0;
          bottom: ${isCompact ? "145px" : "250px"};
          z-index: 8;
          height: ${isCompact ? "105px" : "150px"};
          overflow: hidden;
        }

        .tractor {
          position: absolute;
          left: ${isCompact ? "-140px" : "-180px"};
          bottom: 0;
          width: ${isCompact ? "115px" : "150px"};
          height: ${isCompact ? "75px" : "95px"};
          animation: tractorMove 3.2s ease-in-out infinite;
          filter: drop-shadow(0 18px 18px rgba(20, 83, 45, 0.28));
        }

        .tractor-body {
          position: absolute;
          left: ${isCompact ? "32px" : "42px"};
          bottom: ${isCompact ? "22px" : "26px"};
          width: ${isCompact ? "68px" : "86px"};
          height: ${isCompact ? "34px" : "42px"};
          border-radius: 12px 18px 10px 8px;
          background: linear-gradient(135deg, #22c55e, #15803d 65%, #166534);
        }

        .tractor-front {
          position: absolute;
          right: 8px;
          bottom: ${isCompact ? "25px" : "30px"};
          width: ${isCompact ? "28px" : "35px"};
          height: ${isCompact ? "27px" : "32px"};
          border-radius: 9px 18px 12px 8px;
          background: linear-gradient(135deg, #16a34a, #166534);
        }

        .tractor-cabin {
          position: absolute;
          left: ${isCompact ? "18px" : "24px"};
          bottom: ${isCompact ? "50px" : "58px"};
          width: ${isCompact ? "38px" : "48px"};
          height: ${isCompact ? "34px" : "42px"};
          border-radius: 13px 13px 7px 7px;
          background: #15803d;
        }

        .tractor-window {
          position: absolute;
          left: ${isCompact ? "25px" : "32px"};
          bottom: ${isCompact ? "57px" : "66px"};
          width: ${isCompact ? "24px" : "31px"};
          height: ${isCompact ? "18px" : "24px"};
          border-radius: 7px;
          background: linear-gradient(135deg, #dff8ff, #a7f3d0);
        }

        .tractor-pipe {
          position: absolute;
          right: 24px;
          bottom: ${isCompact ? "53px" : "62px"};
          width: 8px;
          height: ${isCompact ? "27px" : "32px"};
          border-radius: 999px;
          background: #334155;
        }

        .wheel {
          position: absolute;
          bottom: 0;
          border-radius: 50%;
          border: ${isCompact ? "7px" : "9px"} solid #1f2937;
          background: radial-gradient(circle, #fde047 0 20%, #92400e 22% 30%, #111827 32% 100%);
          animation: wheelSpin 0.6s linear infinite;
        }

        .wheel.big {
          left: ${isCompact ? "14px" : "20px"};
          width: ${isCompact ? "46px" : "58px"};
          height: ${isCompact ? "46px" : "58px"};
        }

        .wheel.small {
          right: ${isCompact ? "14px" : "18px"};
          bottom: 3px;
          width: ${isCompact ? "34px" : "42px"};
          height: ${isCompact ? "34px" : "42px"};
        }

        .loading-card {
          position: absolute;
          right: 50%;
          bottom: ${isCompact ? "24px" : "44px"};
          z-index: 10;
          width: ${isCompact ? "min(420px, 86vw)" : "min(620px, 86vw)"};
          padding: ${isCompact ? "18px 20px" : "26px 30px 28px"};
          text-align: center;
          border-radius: ${isCompact ? "30px" : "44px"};
          background: rgba(255, 255, 255, 0.76);
          transform: translateX(50%);
          animation: cardFloat 3s ease-in-out infinite;
        }

        .loading-title {
          color: #14532d;
          font-size: ${isCompact ? "22px" : "clamp(22px, 4vw, 34px)"};
          font-weight: 900;
          line-height: 1.35;
        }

        .loading-subtitle {
          margin-top: 6px;
          color: #64748b;
          font-size: ${isCompact ? "13px" : "15px"};
          font-weight: 800;
        }

        .progress {
          position: relative;
          height: ${isCompact ? "16px" : "20px"};
          margin-top: ${isCompact ? "14px" : "20px"};
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
          background: repeating-linear-gradient(-45deg, #22c55e 0 18px, #84cc16 18px 36px);
          animation: progressMove 1s linear infinite;
        }

        @keyframes tractorMove {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(${isCompact ? "520px" : "calc(min(920px, 94vw) - 70px)"});
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
          .scene {
            width: 94vw;
            height: ${isCompact ? "380px" : "560px"};
            min-height: ${isCompact ? "380px" : "560px"};
            border-radius: 34px;
          }

          .cloud {
            display: none;
          }

          .sign-board {
            top: ${isCompact ? "38px" : "72px"};
            width: 78vw;
            padding: 16px 12px;
          }

          .sign-title {
            font-size: ${isCompact ? "20px" : "24px"};
          }

          .tractor-track {
            bottom: ${isCompact ? "135px" : "225px"};
            height: 105px;
          }

          .loading-card {
            bottom: ${isCompact ? "20px" : "34px"};
            width: 84vw;
            padding: 18px 16px;
            border-radius: 30px;
          }

          .loading-title {
            font-size: ${isCompact ? "19px" : "22px"};
          }

          .loading-subtitle {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="sun-rays" />
      <div className="sun" />

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
        </div>

        <div className="hill" />

        <div className="loading-card">
          <p className="loading-title">{title}</p>
          <p className="loading-subtitle">{subtitle}</p>

          <div className="progress">
            <div className="progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}

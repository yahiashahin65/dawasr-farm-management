import Link from "next/link";
import { useRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import useUserRole from "../hooks/useUserRole";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGaugeHigh,
  faUsers,
  faTractor,
  faRightFromBracket,
  faWheatAwn,
  faUserTie,
  faWarehouse,
  faLayerGroup,
  faChartLine,
  faChartPie,
  faScrewdriverWrench,
  faRightLeft,
  faSeedling,
  faDroplet,
  faLeaf,
} from "@fortawesome/free-solid-svg-icons";

const links = [
  { href: "/dashboard", label: "الرئيسية", icon: faGaugeHigh },
  { href: "/reports", label: "التقارير", icon: faChartLine },
  { href: "/analytics", label: "التحليلات", icon: faChartPie },
  { href: "/assets", label: "الأصول والعهد", icon: faTractor },
  { href: "/assets/movements", label: "سجل الحركات", icon: faRightLeft },
  { href: "/heaps", label: "الأكوام", icon: faSeedling },
  { href: "/sprinklers", label: "الرشاشات", icon: faDroplet },
  {
    href: "/assets/workshop",
    label: "الأصول في الورش",
    icon: faScrewdriverWrench,
  },
  { href: "/engineers", label: "المهندسون", icon: faUserTie },
  { href: "/farms", label: "المزارع", icon: faWheatAwn },
  { href: "/kubras", label: "الكِبر", icon: faWarehouse },
  { href: "/asset-types", label: "أنواع الأصول", icon: faLayerGroup },
  { href: "/workers", label: "العمال", icon: faUsers },
];

export default function Layout({ children, title = "مزارع السنبلة" }) {
  const router = useRouter();
  const { role } = useUserRole();

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-green-50 via-slate-50 to-white text-right text-slate-900"
    >
      <aside className="fixed right-0 top-0 z-20 hidden h-screen w-72 border-l border-green-100 bg-white p-5 shadow-xl shadow-green-50 lg:flex lg:flex-col">
        <div className="mb-6 shrink-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 p-5 text-white shadow-lg shadow-green-100">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/15">
            <FontAwesomeIcon icon={faLeaf} className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-black">مزارع السنبلة</h1>

          <p className="mt-2 text-xs font-bold text-green-100">
            نظام إدارة المعدات والرشاشات والأكوام
          </p>

          <div className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black">
            {role === "admin" ? "مدير النظام" : "مشاهدة فقط"}
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-3 pl-1">
          {links.map((item) => {
            const active =
              router.pathname === item.href ||
              router.pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-green-700 text-white shadow-lg shadow-green-100"
                    : "text-slate-600 hover:bg-green-50 hover:text-green-800"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active ? "bg-white/15" : "bg-slate-100"
                  }`}
                >
                  <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
                </span>

                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="mt-4 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </aside>

      <header className="sticky top-0 z-10 border-b border-green-100 bg-white/90 px-4 py-4 shadow-sm backdrop-blur lg:mr-72">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-700 text-white shadow-lg shadow-green-100 lg:hidden">
                <FontAwesomeIcon icon={faLeaf} />
              </div>

              <div>
                <p className="text-xs font-black text-green-700">
                  مزارع السنبلة
                </p>

                <h2 className="text-xl font-black text-slate-900">{title}</h2>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  {role === "admin" ? "مدير النظام" : "مشاهدة فقط"}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700 transition hover:bg-red-100 lg:hidden"
              title="تسجيل الخروج"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {links.map((item) => {
              const active =
                router.pathname === item.href ||
                router.pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-black transition ${
                    active
                      ? "bg-green-700 text-white shadow-md shadow-green-100"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <FontAwesomeIcon icon={item.icon} className="ml-2 h-3 w-3" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="p-4 lg:mr-72 lg:p-6">{children}</main>
    </div>
  );
}

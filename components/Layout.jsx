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
  faScrewdriverWrench,
  faRightLeft,
} from "@fortawesome/free-solid-svg-icons";

const links = [
  { href: "/dashboard", label: "لوحة التحكم", icon: faGaugeHigh },
  { href: "/reports", label: "التقارير", icon: faChartLine },
  { href: "/assets", label: "الأصول والعهد", icon: faTractor },
  { href: "/assets/workshop", label: "الأصول في الورش", icon: faScrewdriverWrench },
  { href: "/assets/movements", label: "سجل الحركات", icon: faRightLeft },
  { href: "/engineers", label: "المهندسون", icon: faUserTie },
  { href: "/farms", label: "المزارع", icon: faWheatAwn },
  { href: "/kubras", label: "الكِبر", icon: faWarehouse },
  { href: "/asset-types", label: "أنواع الأصول", icon: faLayerGroup },
  { href: "/workers", label: "العمال", icon: faUsers },
  { href: "/heaps", label: "الأكوام", icon: faLayerGroup },
];

export default function Layout({ children, title = "لوحة التحكم" }) {
  const router = useRouter();
  const { role } = useUserRole();

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-right text-slate-900">
      <aside className="fixed right-0 top-0 z-20 hidden h-full w-72 border-l border-slate-200 bg-white p-5 shadow-sm lg:block">
        <div className="mb-8 rounded-3xl bg-green-900 p-5 text-white">
          <h1 className="text-xl font-black">مزارع السنبلة</h1>

          <p className="mt-2 text-xs font-bold text-green-100">
            {role === "admin" ? "مدير النظام" : "مشاهدة فقط"}
          </p>
        </div>

        <nav className="space-y-2">
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
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="absolute bottom-5 right-5 left-5 flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </aside>

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:mr-72">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">{title}</h2>

            <p className="mt-1 text-xs font-bold text-slate-500 lg:hidden">
              {role === "admin" ? "مدير النظام" : "مشاهدة فقط"}
            </p>
          </div>

          <nav className="flex gap-2 overflow-x-auto lg:hidden">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${
                  router.pathname === item.href ||
                  router.pathname.startsWith(item.href + "/")
                    ? "bg-green-700 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="p-4 lg:mr-72 lg:p-6">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { useRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGaugeHigh, faUsers, faTractor, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";

const links = [
  { href: "/dashboard", label: "لوحة التحكم", icon: faGaugeHigh },
  { href: "/workers", label: "العمال", icon: faUsers },
  { href: "/assets", label: "العهد والمعدات", icon: faTractor },
];

export default function Layout({ children, title = "لوحة التحكم" }) {
  const router = useRouter();
  const logout = async () => { await signOut(auth); router.push("/login"); };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-right">
      <aside className="fixed right-0 top-0 z-20 hidden h-full w-64 border-l border-gray-100 bg-white p-5 shadow-sm md:block">
        <div className="mb-8">
          <h1 className="text-xl font-black text-green-800">مزارع السنبلة</h1>
          <p className="mt-1 text-xs text-gray-500">نظام إدارة العهد والجرد</p>
        </div>
        <nav className="space-y-2">
          {links.map((item) => {
            const active = router.pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${active ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="absolute bottom-5 right-5 left-5 flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100">
          <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </aside>

      <main className="md:mr-64">
        <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-gray-900 md:text-2xl">{title}</h2>
            <button onClick={logout} className="md:hidden rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700">خروج</button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto md:hidden">
            {links.map((item) => <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-xl bg-white border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700">{item.label}</Link>)}
          </div>
        </header>
        <section className="p-4 md:p-8">{children}</section>
      </main>
    </div>
  );
}

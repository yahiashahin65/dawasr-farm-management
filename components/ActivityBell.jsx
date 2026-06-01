import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faClockRotateLeft,
  faCircle,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";

import { db } from "../lib/firebase";

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : null;

  if (!date) return "الآن";

  return date.toLocaleString("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const getTypeClass = (type) => {
  switch (type) {
    case "create":
      return "bg-emerald-100 text-emerald-700";
    case "update":
      return "bg-blue-100 text-blue-700";
    case "delete":
      return "bg-red-100 text-red-700";
    case "move":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const getTypeLabel = (type) => {
  switch (type) {
    case "create":
      return "إضافة";
    case "update":
      return "تعديل";
    case "delete":
      return "حذف";
    case "move":
      return "نقل";
    default:
      return "نشاط";
  }
};

export default function ActivityBell() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = useMemo(() => logs.length, [logs]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLogs(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
        setLoading(false);
      },
      (error) => {
        console.error("Activity logs error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="relative z-50" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
        title="آخر الأنشطة"
      >
        <FontAwesomeIcon icon={faBell} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/20 md:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            className="
              fixed left-3 right-3 top-24 z-[9999]
              overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-100
              md:absolute md:left-0 md:right-auto md:top-14 md:w-[380px]
            "
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="font-black text-slate-800">آخر الأنشطة</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  أحدث العمليات داخل النظام
                </p>
              </div>

              <FontAwesomeIcon
                icon={faClockRotateLeft}
                className="text-green-700"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2 md:max-h-[420px]">
              {loading ? (
                <div className="p-6 text-center text-sm font-bold text-slate-400">
                  جاري تحميل الأنشطة...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-6 text-center text-sm font-bold text-slate-400">
                  لا توجد أنشطة بعد
                </div>
              ) : (
                logs.map((log) => (
                  <Link
                    key={log.id}
                    href={log.itemPath || "/activity-logs"}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl p-3 transition hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-xs ${getTypeClass(
                          log.type
                        )}`}
                      >
                        <FontAwesomeIcon
                          icon={faCircle}
                          className="text-[8px]"
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-black text-slate-800">
                            {log.title || "نشاط جديد"}
                          </p>

                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                            {getTypeLabel(log.type)}
                          </span>
                        </div>

                        {log.description && (
                          <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">
                            {log.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-400">
                            {log.userName || "النظام"}
                          </span>

                          <span className="text-[11px] font-bold text-slate-400">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 p-3">
              <Link
                href="/activity-logs"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800"
              >
                عرض كل الأنشطة
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

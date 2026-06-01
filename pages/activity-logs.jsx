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
  faClockRotateLeft,
  faExternalLinkAlt,
  faCircle,
  faCheckDouble,
} from "@fortawesome/free-solid-svg-icons";

import Layout from "../components/Layout";
import { db } from "../lib/firebase";

const SEEN_STORAGE_KEY = "seenActivityLogIds";

const getSeenIds = () => {
  if (typeof window === "undefined") return [];

  try {
    const value = localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveSeenIds = (ids) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore localStorage errors
  }
};

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : null;

  if (!date) return "الآن";

  return date.toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

const getTypeClass = (type) => {
  switch (type) {
    case "create":
      return "bg-emerald-50 text-emerald-700";
    case "update":
      return "bg-blue-50 text-blue-700";
    case "delete":
      return "bg-red-50 text-red-700";
    case "move":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [seenIds, setSeenIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSeenIds(getSeenIds());
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      orderBy("createdAt", "desc"),
      limit(100)
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
        console.error("Activity logs page error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const unreadCount = useMemo(() => {
    return logs.filter((log) => !seenIds.includes(log.id)).length;
  }, [logs, seenIds]);

  const markAsSeen = (logId) => {
    if (!logId) return;

    setSeenIds((prev) => {
      if (prev.includes(logId)) return prev;

      const next = [logId, ...prev].slice(0, 500);
      saveSeenIds(next);

      return next;
    });
  };

  const markAllAsSeen = () => {
    const ids = logs.map((log) => log.id).filter(Boolean);

    setSeenIds((prev) => {
      const next = Array.from(new Set([...ids, ...prev])).slice(0, 500);
      saveSeenIds(next);

      return next;
    });
  };

  return (
    <Layout title="سجل النشاط">
      <div className="space-y-6" dir="rtl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50 text-green-700">
                <FontAwesomeIcon icon={faClockRotateLeft} />
              </div>

              <div>
                <h1 className="text-2xl font-black text-slate-900">
                  سجل النشاط
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  كل العمليات المهمة التي تمت داخل النظام
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={markAllAsSeen}
              disabled={!logs.length || unreadCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <FontAwesomeIcon icon={faCheckDouble} />
              تعليم الكل كمقروء
              {unreadCount > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-1 text-xs">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          {loading ? (
            <div className="p-10 text-center font-bold text-slate-400">
              جاري تحميل سجل النشاط...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center font-bold text-slate-400">
              لا توجد أنشطة حتى الآن
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const seen = seenIds.includes(log.id);

                return (
                  <div
                    key={log.id}
                    className={`p-5 transition ${
                      seen ? "bg-white" : "bg-green-50/60"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {!seen && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                              <FontAwesomeIcon
                                icon={faCircle}
                                className="text-[7px]"
                              />
                              جديد
                            </span>
                          )}

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${getTypeClass(
                              log.type
                            )}`}
                          >
                            {getTypeLabel(log.type)}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                            {log.module || "general"}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-black text-slate-900">
                          {log.title || "نشاط جديد"}
                        </h3>

                        {log.description && (
                          <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                            {log.description}
                          </p>
                        )}

                        <p className="mt-2 text-xs font-bold text-slate-400">
                          بواسطة: {log.userName || "النظام"} —{" "}
                          {formatDate(log.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!seen && (
                          <button
                            type="button"
                            onClick={() => markAsSeen(log.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
                          >
                            تم الاطلاع
                          </button>
                        )}

                        {log.itemPath && (
                          <Link
                            href={log.itemPath}
                            onClick={() => markAsSeen(log.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800"
                          >
                            فتح العنصر
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClockRotateLeft,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";

import Layout from "../components/Layout";
import { db } from "../lib/firebase";

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

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
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
              {logs.map((log) => (
                <div key={log.id} className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
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

                    {log.itemPath && (
                      <Link
                        href={log.itemPath}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-green-50 hover:text-green-700"
                      >
                        فتح العنصر
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
                      }

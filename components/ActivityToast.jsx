import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faXmark } from "@fortawesome/free-solid-svg-icons";

import { db } from "../lib/firebase";

export default function ActivityToast() {
  const [toast, setToast] = useState(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const latest = snap.docs[0];

      if (!latest) return;

      const data = {
        id: latest.id,
        ...latest.data(),
      };

      if (firstLoad.current) {
        firstLoad.current = false;
        return;
      }

      setToast(data);

      setTimeout(() => {
        setToast(null);
      }, 6000);
    });

    return () => unsubscribe();
  }, []);

  if (!toast) return null;

  return (
    <div
      dir="rtl"
      className="fixed left-4 top-24 z-[99999] w-[calc(100%-2rem)] max-w-sm animate-[toastIn_.25s_ease-out] rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-100"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-700">
          <FontAwesomeIcon icon={faBell} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-black text-slate-900">
            {toast.title || "نشاط جديد"}
          </p>

          {toast.description && (
            <p className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-slate-500">
              {toast.description}
            </p>
          )}

          <Link
            href={toast.itemPath || "/activity-logs"}
            onClick={() => setToast(null)}
            className="mt-3 inline-flex rounded-2xl bg-green-700 px-3 py-2 text-xs font-black text-white hover:bg-green-800"
          >
            فتح
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <style jsx>{`
        @keyframes toastIn {
          from {
            transform: translateY(-12px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRobot,
  faXmark,
  faPaperPlane,
  faSparkles,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";

import { askSmartAssistant } from "../lib/smartAssistant";

export default function SanbalaAssistant() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([
    {
      from: "assistant",
      answer:
        "أهلًا، أنا مساعد السنبلة. اسألني عن الأصول، العمال، المزارع، الرشاشات أو الأكوام.",
      items: [],
      suggestions: [
        "اعرض الأصول العاطلة",
        "كام أصل في الورشة؟",
        "اعرض العمال",
        "اعرض الأكوام",
      ],
    },
  ]);

  const ask = (text) => {
    const value = String(text || message).trim();

    if (!value) return;

    const response = askSmartAssistant(value);

    setChat((prev) => [
      ...prev,
      {
        from: "user",
        text: value,
      },
      {
        from: "assistant",
        ...response,
      },
    ]);

    setMessage("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-5 bottom-6 z-40 flex h-16 w-16 items-center justify-center rounded-3xl bg-green-700 text-white shadow-2xl shadow-green-900/30 transition hover:-translate-y-1 hover:bg-green-800"
        title="مساعد السنبلة"
      >
        <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-emerald-300" />
        <FontAwesomeIcon icon={faRobot} className="text-2xl" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm">
          <div
            className="absolute left-0 top-0 flex h-full w-full max-w-md animate-[slideInLeft_.25s_ease-out] flex-col bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 p-5 text-white">
              <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-white/10" />

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <FontAwesomeIcon icon={faSparkles} className="text-xl" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black">مساعد السنبلة</h3>
                    
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
              {chat.map((item, index) =>
                item.from === "user" ? (
                  <div key={index} className="flex justify-start">
                    <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-green-700 px-4 py-3 text-sm font-bold leading-7 text-white">
                      {item.text}
                    </div>
                  </div>
                ) : (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[90%] rounded-3xl rounded-tl-md bg-white p-4 text-sm shadow-sm ring-1 ring-slate-100">
                      <p className="font-bold leading-7 text-slate-700">
                        {item.answer}
                      </p>

                      {item.items?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.items.map((result) => (
                            <Link
                              key={result.href + result.title}
                              href={result.href}
                              onClick={() => setOpen(false)}
                              className="block rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:bg-green-50"
                            >
                              <p className="font-black text-slate-800">
                                {result.title}
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                {result.subtitle}
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}

                      {item.suggestions?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => ask(suggestion)}
                              className="rounded-full bg-green-50 px-3 py-2 text-xs font-black text-green-700 hover:bg-green-100"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
              className="border-t border-slate-100 bg-white p-4"
            >
              <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="mr-2 text-slate-400"
                />

                <input
                  className="flex-1 bg-transparent px-2 py-3 text-sm font-bold outline-none"
                  placeholder="اسأل مساعد السنبلة..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                <button
                  type="submit"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-700 text-white hover:bg-green-800"
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0.8;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

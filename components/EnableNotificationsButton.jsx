import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

import { requestPushPermission } from "../lib/pushNotifications";
import { auth } from "../lib/firebase";

export default function EnableNotificationsButton() {
  const [loading, setLoading] = useState(false);

  const enable = async () => {
    try {
      setLoading(true);
      await requestPushPermission(auth.currentUser);
      alert("تم تفعيل إشعارات الجهاز بنجاح");
    } catch (error) {
      alert(error.message || "تعذر تفعيل الإشعارات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={enable}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:bg-slate-300"
    >
      <FontAwesomeIcon icon={faBell} />
      {loading ? "جاري التفعيل..." : "تفعيل إشعارات الجهاز"}
    </button>
  );
}

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

import { requestPushPermission } from "../lib/pushNotifications";
import { auth } from "../lib/firebase";

export default function EnableNotificationsButton() {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const enableNotifications = async () => {
    try {
      setLoading(true);

      await requestPushPermission(auth.currentUser);

      setEnabled(true);
      alert("تم تفعيل الإشعارات بنجاح");
    } catch (error) {
      alert(error.message || "تعذر تفعيل الإشعارات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={enableNotifications}
      disabled={loading || enabled}
      className="inline-flex items-center gap-2 rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      <FontAwesomeIcon icon={faBell} />
      {enabled ? "الإشعارات مفعلة" : loading ? "جاري التفعيل..." : "تفعيل الإشعارات"}
    </button>
  );
}

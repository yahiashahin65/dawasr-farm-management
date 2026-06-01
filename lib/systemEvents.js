import { addActivityLog } from "./activityLog";

export const createSystemEvent = async ({
  type = "info",
  module = "general",
  title = "",
  description = "",
  userId = "",
  userName = "النظام",
  itemId = "",
  itemPath = "",
  metadata = {},
  notify = true,
}) => {
  const logRef = await addActivityLog({
    type,
    module,
    title,
    description,
    userId,
    userName,
    itemId,
    itemPath,
    metadata: {
      ...metadata,
      notify,
    },
  });

  if (notify && typeof window !== "undefined") {
    fetch("/api/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: description,
        url: itemPath || "/activity-logs",
      }),
    }).catch((error) => {
      console.error("Push notification error:", error);
    });
  }

  return logRef;
};

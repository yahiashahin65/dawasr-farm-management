import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const addActivityLog = async ({
  type = "info",
  module = "general",
  title = "",
  description = "",
  userId = "",
  userName = "النظام",
  itemId = "",
  itemPath = "",
  metadata = {},
}) => {
  if (!title) return null;

  return addDoc(collection(db, "activityLogs"), {
    type,
    module,
    title,
    description,
    userId,
    userName,
    itemId,
    itemPath,
    metadata,
    createdAt: serverTimestamp(),
  });
};

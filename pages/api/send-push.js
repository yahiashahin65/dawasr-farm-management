import admin from "firebase-admin";

const getPrivateKey = () => {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!key) return "";

  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
};

const getAdminApp = () => {
  if (admin.apps.length) return admin.app();

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "send-push API is running",
        env: {
          hasProjectId: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
          hasClientEmail: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
          hasPrivateKey: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || null,
        },
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    getAdminApp();

    const db = admin.firestore();

    const { title, body, url = "/activity-logs" } = req.body || {};

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const tokensSnap = await db
      .collection("pushTokens")
      .where("active", "==", true)
      .get();

    const tokens = tokensSnap.docs
      .map((doc) => doc.data().token)
      .filter(Boolean);

    if (!tokens.length) {
      return res.status(200).json({ message: "No tokens found" });
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: body || "",
      },
      data: {
        url,
      },
      webpush: {
        fcmOptions: {
          link: url,
        },
      },
    });

    return res.status(200).json({
  success: true,
  tokensCount: tokens.length,
  successCount: response.successCount,
  failureCount: response.failureCount,
  responses: response.responses.map((item) => ({
    success: item.success,
    error: item.error
      ? {
          code: item.error.code,
          message: item.error.message,
        }
      : null,
  })),
});
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Unknown server error",
      code: error.code || null,
    });
  }
}

import admin from "firebase-admin";

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "send-push API is running. Use POST to send notifications.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
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
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error("Send push error:", error);

    return res.status(500).json({
      message: error.message || "Failed to send push notification",
    });
  }
}

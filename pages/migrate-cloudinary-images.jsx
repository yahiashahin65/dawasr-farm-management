import { useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import { fileToFirestoreImage } from "../lib/imageToFirestore";

export default function MigrateCloudinaryImages() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message) => {
    setLogs((prev) => [...prev, message]);
  };

  const downloadBackup = (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `assets-backup-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const migrate = async () => {
    if (loading) return;

    const confirmed = confirm(
      "سيتم تحويل صور Cloudinary القديمة إلى Base64 داخل Firestore. سيتم تحميل Backup أولًا. هل تريد المتابعة؟"
    );

    if (!confirmed) return;

    setLoading(true);
    setLogs([]);

    try {
      const snap = await getDocs(collection(db, "assets"));

      const assets = snap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      downloadBackup(assets);
      addLog(`تم تحميل Backup لعدد ${assets.length} أصل`);

      const cloudinaryAssets = assets.filter(
        (asset) =>
          asset.imageUrl &&
          typeof asset.imageUrl === "string" &&
          asset.imageUrl.includes("cloudinary.com")
      );

      addLog(`عدد الصور القديمة على Cloudinary: ${cloudinaryAssets.length}`);

      for (const asset of cloudinaryAssets) {
        try {
          addLog(`جاري تحويل: ${asset.name || asset.id}`);

          const response = await fetch(asset.imageUrl);

          if (!response.ok) {
            throw new Error("فشل تحميل الصورة من Cloudinary");
          }

          const blob = await response.blob();

          const file = new File([blob], `${asset.id}.jpg`, {
            type: blob.type || "image/jpeg",
          });

          const firestoreImage = await fileToFirestoreImage(file);

          await updateDoc(doc(db, "assets", asset.id), {
            imageUrl: firestoreImage,
            oldCloudinaryUrl: asset.imageUrl,
            imageMigratedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          addLog(`تم تحويل: ${asset.name || asset.id}`);
        } catch (error) {
          console.error(error);
          addLog(`فشل تحويل: ${asset.name || asset.id} - ${error.message}`);
        }
      }

      addLog("انتهت عملية التحويل");
    } catch (error) {
      console.error(error);
      addLog(`خطأ عام: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 30, direction: "rtl", fontFamily: "Arial" }}>
      <h1>تحويل صور Cloudinary إلى Firestore</h1>

      <button
        onClick={migrate}
        disabled={loading}
        style={{
          padding: "12px 20px",
          background: loading ? "#999" : "#111827",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "جاري التحويل..." : "ابدأ التحويل"}
      </button>

      <div style={{ marginTop: 25 }}>
        {logs.map((log, index) => (
          <p key={index}>{log}</p>
        ))}
      </div>
    </div>
  );
}

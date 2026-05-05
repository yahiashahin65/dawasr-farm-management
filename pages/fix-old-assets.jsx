import { useState } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

export default function FixOldAssets() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFix = async () => {
    setLoading(true);
    setMessage("");

    try {
      const machineTypeName = "مكينة";
      let machineTypeId = "";

      const q = query(
        collection(db, "assetTypes"),
        where("name", "==", machineTypeName)
      );

      const typeSnapshot = await getDocs(q);

      if (!typeSnapshot.empty) {
        machineTypeId = typeSnapshot.docs[0].id;
      } else {
        const createdType = await addDoc(collection(db, "assetTypes"), {
          name: machineTypeName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        machineTypeId = createdType.id;
      }

      const assetsSnapshot = await getDocs(collection(db, "assets"));

      let updatedCount = 0;

      for (const assetDoc of assetsSnapshot.docs) {
        const asset = assetDoc.data();

        if (!asset.assetTypeId || !asset.assetTypeName) {
          await updateDoc(doc(db, "assets", assetDoc.id), {
            assetTypeId: machineTypeId,
            assetTypeName: machineTypeName,
            updatedAt: serverTimestamp(),
          });

          updatedCount++;
        }
      }

      setMessage(`تم ربط ${updatedCount} معدة قديمة بنوع مكينة`);
    } catch (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء التحديث");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6 text-right">
        <h1 className="text-2xl font-bold mb-6">
          تحديث المعدات القديمة
        </h1>

        <button
          onClick={handleFix}
          disabled={loading}
          className="w-full bg-green-700 text-white p-4 rounded-xl font-bold disabled:bg-gray-400"
        >
          {loading ? "جاري التحديث..." : "ربط المعدات القديمة بنوع مكينة"}
        </button>

        {message && (
          <p className="mt-4 text-center font-bold text-green-700">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

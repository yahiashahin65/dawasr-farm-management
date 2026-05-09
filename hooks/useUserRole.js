import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function useUserRole() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setRole("viewer");
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setRole(userSnap.data().role || "viewer");
        } else {
          setRole("viewer");
        }
      } catch (error) {
        console.error(error);
        setRole("viewer");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return {
    user,
    role,
    loading,
    isAdmin: role === "admin",
    isViewer: role === "viewer",
    canManage: role === "admin",
    canView: role === "admin" || role === "viewer",
  };
}

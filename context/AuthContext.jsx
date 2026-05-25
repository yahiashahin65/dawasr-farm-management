import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);

      if (!currentUser) {
        setUser(null);
        setRole("viewer");
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        setRole(userSnap.exists() ? userSnap.data()?.role || "viewer" : "viewer");
      } catch (error) {
        console.error(error);
        setRole("viewer");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      isAdmin: role === "admin",
      isViewer: role === "viewer",
      canManage: role === "admin",
      canView: role === "admin" || role === "viewer",
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

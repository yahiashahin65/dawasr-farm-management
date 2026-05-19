import { useState } from "react";
import { useRouter } from "next/router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err) {
      alert("بيانات الدخول غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-4 flex items-center justify-center text-right">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700">
          <FontAwesomeIcon icon={faLock} className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">تسجيل دخول</h1>
        <div className="mt-6 space-y-4">
          <input className="form-input" type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="form-input" type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn-primary w-full" disabled={loading}>{loading ? "جاري الدخول..." : "دخول"}</button>
        </div>
      </form>
    </main>
  );
}

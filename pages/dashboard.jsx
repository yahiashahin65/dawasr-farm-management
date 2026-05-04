import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faTractor, faScrewdriverWrench } from "@fortawesome/free-solid-svg-icons";

export default function Dashboard() {
  const [stats, setStats] = useState({ workers: 0, assets: 0, maintenance: 0 });
  useEffect(() => {
    const load = async () => {
      const workers = await getDocs(collection(db, "workers"));
      const assets = await getDocs(collection(db, "assets"));
      let maintenance = 0;
      assets.forEach((doc) => { if (doc.data().status === "صيانة") maintenance++; });
      setStats({ workers: workers.size, assets: assets.size, maintenance });
    };
    load();
  }, []);
  const cards = [
    { label: "إجمالي العمال", value: stats.workers, icon: faUsers },
    { label: "إجمالي العهد", value: stats.assets, icon: faTractor },
    { label: "تحت الصيانة", value: stats.maintenance, icon: faScrewdriverWrench },
  ];
  return <ProtectedRoute><Layout title="لوحة التحكم"><div className="grid gap-4 md:grid-cols-3">{cards.map(c => <div key={c.label} className="page-card p-5"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700"><FontAwesomeIcon icon={c.icon} className="h-5 w-5" /></div><p className="text-sm font-bold text-gray-500">{c.label}</p><h3 className="mt-2 text-3xl font-black text-gray-900">{c.value}</h3></div>)}</div></Layout></ProtectedRoute>;
}

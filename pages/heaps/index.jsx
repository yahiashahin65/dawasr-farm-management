import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function HeapsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const snapshot = await getDocs(collection(db, 'heaps'));

    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setItems(data);
  };

  const filteredItems = items.filter((item) => {
    const keyword = search.toLowerCase();

    return (
      item.pileName?.toLowerCase().includes(keyword) ||
      item.farmName?.toLowerCase().includes(keyword) ||
      item.sprinklerName?.toLowerCase().includes(keyword)
    );
  });

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return <div>Heaps Page</div>;
}

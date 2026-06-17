'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SORT_LABELS: Record<string, string> = {
  nameAsc:   'Name A–Z',
  priceAsc:  'Price: Low to High',
  priceDesc: 'Price: High to Low',
  savings:   'Best Savings',
};

export default function MobileSortSelect({ currentSort }: { currentSort: string }) {
  const router      = useRouter();
  const searchParams = useSearchParams();

  function handleChange(sort: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('page');
    if (sort === 'nameAsc') p.delete('sort');
    else p.set('sort', sort);
    router.push(`/products?${p.toString()}`);
  }

  return (
    <select
      className="sidebar-select browse-sort-mobile"
      style={{ width: 'auto', maxWidth: 200 }}
      value={currentSort}
      onChange={e => handleChange(e.target.value)}
    >
      {Object.entries(SORT_LABELS).map(([val, label]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  );
}

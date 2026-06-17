import Link from 'next/link';
import { ShopSubcategory } from '@/lib/shop';

interface Props {
  categoryCode: string;
  subcategories: ShopSubcategory[];
  activeSub?: string;
}

export default function SubcategoryFilter({ categoryCode, subcategories, activeSub }: Props) {
  if (subcategories.length === 0) return null;

  return (
    <div className="cats" style={{ marginBottom: '24px' }}>
      <Link
        href={`/category/${categoryCode}`}
        className={`cat${!activeSub ? ' cat-active' : ''}`}
      >
        All
      </Link>
      {subcategories.map(sub => (
        <Link
          key={sub.id}
          href={`/category/${categoryCode}?sub=${sub.code}`}
          className={`cat${activeSub === sub.code ? ' cat-active' : ''}`}
        >
          {sub.label || sub.name}
          <span className="cat-count">({sub.productCount})</span>
        </Link>
      ))}
    </div>
  );
}

import type { ShopProduct } from '@/lib/shop';
import ProductCard from './ProductCard';
import Link from 'next/link';

interface Props {
  products: ShopProduct[];
  categoryCode: string | null;
}

export default function RelatedProducts({ products, categoryCode }: Props) {
  if (products.length === 0) return null;

  return (
    <div style={{ marginTop: '56px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
          You may also like
        </h2>
        {categoryCode && (
          <Link
            href={`/category/${categoryCode}`}
            style={{ fontSize: '13px', color: 'var(--saffron-deep)', fontWeight: 600, textDecoration: 'none' }}
          >
            See all in category →
          </Link>
        )}
      </div>

      <div className="products-grid">
        {products.map(p => (
          <ProductCard key={p.code} product={p} />
        ))}
      </div>
    </div>
  );
}

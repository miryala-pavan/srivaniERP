import Link from 'next/link';
import Image from 'next/image';
import type { ShopProduct } from '@/lib/shop';
import AddToListButton from './AddToListButton';

function fmtPrice(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

interface Props {
  products: ShopProduct[];
  catalogueMode?: boolean;
}

export default function FrequentlyBoughtWith({ products, catalogueMode = false }: Props) {
  if (!products.length) return null;

  return (
    <div style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', marginBottom: '14px' }}>
        Customers also buy
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '10px',
      }}>
        {products.map(p => {
          const bestPack = p.packs.find(pk => pk.inStock) ?? p.packs[0];
          const inStock = p.packs.some(pk => pk.inStock);
          return (
            <div
              key={p.code}
              style={{
                display: 'flex', flexDirection: 'column',
                background: 'var(--paper-2)', borderRadius: '14px',
                border: '1px solid var(--line)', overflow: 'hidden',
              }}
            >
              <Link href={`/product/${p.code}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ aspectRatio: '1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl} alt={p.name}
                      width={100} height={100}
                      style={{ objectFit: 'contain', padding: '8px' }}
                      unoptimized
                    />
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="3"/>
                      <path d="M3 9h18"/><path d="M9 21V9"/>
                    </svg>
                  )}
                </div>
                <div style={{ padding: '8px 10px 4px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.35,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {p.name}
                  </p>
                  {!catalogueMode && (
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--saffron-deep)', margin: '4px 0 6px' }}>
                      ₹{fmtPrice(bestPack?.price ?? p.fromPrice)}
                    </p>
                  )}
                </div>
              </Link>
              {!catalogueMode && (
                <div style={{ padding: '0 10px 10px' }} onClick={e => e.stopPropagation()}>
                  <AddToListButton
                    code={bestPack?.pluBarcode ?? p.code}
                    name={p.name}
                    packLabel={bestPack?.packLabel ?? ''}
                    sellingPrice={bestPack?.price ?? p.fromPrice}
                    imageUrl={p.imageUrl}
                    disabled={!inStock}
                    volumeTiers={bestPack?.volumeTiers}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

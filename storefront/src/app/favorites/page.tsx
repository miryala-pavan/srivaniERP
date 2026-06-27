'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import ProductImage from '@/components/ProductImage';
import WishlistButton from '@/components/WishlistButton';
import { useWishlist } from '@/context/WishlistContext';

function fmtPrice(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function FavoritesPage() {
  const { items, count } = useWishlist();

  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '32px', paddingBottom: '80px' }}>

        <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px', color: 'var(--ink)' }}>
          Favourites
          {count > 0 && (
            <span style={{ marginLeft: '10px', fontSize: '14px', fontWeight: 600, color: 'var(--ink-soft)' }}>
              {count} item{count !== 1 ? 's' : ''}
            </span>
          )}
        </h1>

        {count === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '40vh', textAlign: 'center', gap: '16px',
          }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
              stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <p style={{ fontSize: '15px', color: 'var(--ink-soft)', maxWidth: '280px' }}>
              No saved items yet. Tap the heart icon on any product to save it here.
            </p>
            <Link
              href="/"
              style={{
                padding: '11px 28px', borderRadius: '12px',
                background: 'var(--saffron)', color: '#fff',
                fontSize: '14px', fontWeight: 700, textDecoration: 'none',
              }}
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '12px',
            marginTop: '20px',
          }}>
            {items.map(item => (
              <Link
                key={item.code}
                href={`/product/${item.code}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: 'var(--paper-2)',
                  border: '1.5px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}>
                  {/* Image + heart */}
                  <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--cream, #FDF6EC)' }}>
                    <ProductImage
                      imageUrl={item.imageUrl ?? null}
                      alt={item.name}
                      className="w-full h-full object-contain p-3"
                    />
                    <div
                      onClick={e => e.preventDefault()}
                      style={{ position: 'absolute', top: '7px', right: '7px' }}
                    >
                      <WishlistButton
                        code={item.code}
                        name={item.name}
                        imageUrl={item.imageUrl}
                        fromPrice={item.fromPrice}
                        categoryName={item.categoryName}
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '10px 12px 14px' }}>
                    {item.categoryName && (
                      <div style={{
                        fontSize: '10px', fontWeight: 600, color: 'var(--ink-soft)',
                        textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px',
                      }}>
                        {item.categoryName}
                      </div>
                    )}
                    <p style={{
                      fontSize: '13px', fontWeight: 700, color: 'var(--ink)',
                      lineHeight: 1.3, marginBottom: '8px',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {item.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontFamily: 'var(--font-fraunces), serif',
                        fontWeight: 700, fontSize: '15px',
                        color: 'var(--saffron-deep)',
                      }}>
                        ₹{fmtPrice(item.fromPrice)}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        color: 'var(--saffron)',
                        border: '1.5px solid var(--saffron)',
                        borderRadius: '6px', padding: '3px 8px',
                      }}>
                        View →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

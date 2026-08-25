'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadRecentlyViewed, type RecentProduct } from './RecentlyViewedTracker';
import { useStoreConfig } from '@/context/StoreConfigContext';

const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE ?? 'http://localhost:4001';

function resolveImg(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;   // already absolute
  return `${IMG_BASE}${url}`;               // relative path → prepend API base
}

function fmtPrice(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function RecentlyViewedSection() {
  const { catalogueMode } = useStoreConfig();
  const [products, setProducts] = useState<RecentProduct[]>([]);

  useEffect(() => {
    setProducts(loadRecentlyViewed().slice(0, 6));
  }, []);

  if (products.length < 2) return null;

  return (
    <section style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', marginBottom: '14px' }}>
        Recently viewed
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '10px',
      }}>
        {products.map(p => (
          <Link
            key={p.code}
            href={`/product/${p.code}`}
            style={{
              display: 'flex', flexDirection: 'column',
              background: 'var(--paper-2)', borderRadius: '12px',
              border: '1px solid var(--line)', overflow: 'hidden',
              textDecoration: 'none',
            }}
          >
            <div style={{ aspectRatio: '1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {resolveImg(p.imageUrl) ? (
                <img
                  src={resolveImg(p.imageUrl)!}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 100, height: 100, objectFit: 'contain', padding: '6px' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = '/noimage.png'; }}
                />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <path d="M3 9h18"/><path d="M9 21V9"/>
                </svg>
              )}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.35,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {p.name}
              </p>
              {!catalogueMode && (
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--saffron-deep)', margin: '4px 0 0' }}>
                  ₹{fmtPrice(p.fromPrice)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

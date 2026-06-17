'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { getProductSuggestions } from '@/lib/shop';
import type { SuggestResult } from '@/lib/shop';

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SuggestResult | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Build flat list of navigable items for keyboard nav
  const items: Array<{ type: 'product'; code: string } | { type: 'category'; code: string }> = [
    ...(results?.products ?? []).map(p => ({ type: 'product' as const, code: p.code })),
    ...(results?.categories ?? []).map(c => ({ type: 'category' as const, code: c.code })),
  ];

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    const data = await getProductSuggestions(q, 6);
    setResults(data);
    setOpen(data.products.length > 0 || data.categories.length > 0);
    setActiveIdx(-1);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(val), 250);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) { router.push(`/search?q=${encodeURIComponent(q)}`); setOpen(false); }
  }

  function navigate(item: typeof items[number]) {
    setOpen(false);
    if (item.type === 'product') router.push(`/product/${item.code}`);
    else router.push(`/category/${item.code}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      navigate(items[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const products = results?.products ?? [];
  const categories = results?.categories ?? [];
  const productOffset = 0;
  const categoryOffset = products.length;

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
      <form className="search-form" onSubmit={handleSubmit} role="search">
        <input
          className="search-input"
          type="search"
          placeholder="Search products…"
          aria-label="Search products"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button className="search-btn" type="submit" aria-label="Submit search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </form>

      {open && (products.length > 0 || categories.length > 0) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {products.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase' }}>
                Products
              </div>
              {products.map((p, i) => {
                const idx = productOffset + i;
                const active = activeIdx === idx;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => navigate({ type: 'product', code: p.code })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '8px 14px',
                      border: 'none',
                      background: active ? '#f3f4f6' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.iconUrl ? (
                        <Image src={p.iconUrl} alt="" width={32} height={32} style={{ objectFit: 'contain' }} unoptimized />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>Code: {p.code}</div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>₹{p.sellingPrice.toFixed(2)}</div>
                  </button>
                );
              })}
            </>
          )}

          {categories.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', borderTop: products.length > 0 ? '1px solid #f3f4f6' : undefined }}>
                Categories
              </div>
              {categories.map((c, i) => {
                const idx = categoryOffset + i;
                const active = activeIdx === idx;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => navigate({ type: 'category', code: c.code })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '8px 14px',
                      border: 'none',
                      background: active ? '#f3f4f6' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{c.name}</div>
                      {c.department && <div style={{ fontSize: '11px', color: '#6b7280' }}>{c.department}</div>}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          <div style={{ padding: '8px 14px', borderTop: '1px solid #f3f4f6' }}>
            <button
              type="button"
              onClick={() => { router.push(`/search?q=${encodeURIComponent(query.trim())}`); setOpen(false); }}
              style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              See all results for &ldquo;{query}&rdquo; →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

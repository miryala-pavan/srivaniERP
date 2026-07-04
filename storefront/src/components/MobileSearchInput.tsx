'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { getProductSuggestions } from '@/lib/shop';
import type { SuggestResult } from '@/lib/shop';

interface Props {
  initialQuery?: string;
}

export default function MobileSearchInput({ initialQuery = '' }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SuggestResult | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Auto-focus on mobile when no query yet
    if (!initialQuery && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initialQuery]);

  async function fetchSuggestions(q: string) {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    const data = await getProductSuggestions(q, 6);
    setResults(data);
    setOpen(data.products.length > 0 || data.categories.length > 0);
  }

  function handleChange(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(val), 280);
  }

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const products = results?.products ?? [];
  const categories = results?.categories ?? [];

  return (
    <div style={{ position: 'relative', marginBottom: '24px' }}>
      <form
        onSubmit={e => { e.preventDefault(); submit(query); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          border: '2px solid var(--saffron)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(217,131,36,0.12)',
        }}
      >
        <span style={{ padding: '0 12px', color: 'var(--saffron)', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Search rice, dal, oil, masala…"
          autoComplete="off"
          autoCorrect="off"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '16px',
            padding: '14px 0',
            color: 'var(--ink)',
            fontFamily: 'var(--font-hanken), sans-serif',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            style={{ padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', lineHeight: 1 }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        <button
          type="submit"
          style={{
            padding: '10px 18px',
            background: 'var(--saffron)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '14px',
            borderRadius: '0 12px 12px 0',
            margin: '2px',
            fontFamily: 'var(--font-hanken), sans-serif',
          }}
        >
          Search
        </button>
      </form>

      {/* Autocomplete dropdown */}
      {open && (products.length > 0 || categories.length > 0) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0, right: 0,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {products.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase' }}>
                Products
              </div>
              {products.map(p => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => { setOpen(false); router.push(`/product/${p.code}`); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.iconUrl
                      ? <Image src={p.iconUrl} alt="" width={36} height={36} style={{ objectFit: 'contain' }} unoptimized />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Code: {p.code}</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>₹{p.sellingPrice.toFixed(2)}</div>
                </button>
              ))}
            </>
          )}

          {categories.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', borderTop: products.length > 0 ? '1px solid #f3f4f6' : undefined }}>
                Categories
              </div>
              {categories.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { setOpen(false); router.push(`/category/${c.code}`); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{c.name}</div>
                    {c.department && <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.department}</div>}
                  </div>
                </button>
              ))}
            </>
          )}

          <div style={{ padding: '10px 14px', borderTop: '1px solid #f3f4f6' }}>
            <button
              type="button"
              onClick={() => { setOpen(false); submit(query); }}
              style={{ fontSize: '13px', color: 'var(--saffron-deep)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              See all results for &ldquo;{query}&rdquo; →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

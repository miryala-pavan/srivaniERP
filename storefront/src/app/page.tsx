export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategories, getProducts } from '@/lib/shop';
import ProductCard from '@/components/ProductCard';
import CategoryTile from '@/components/CategoryTile';
import RecentlyViewedSection from '@/components/RecentlyViewedSection';

export const metadata: Metadata = {
  title: 'Srivani Stores — Online Grocery in Sangareddy, Telangana',
  description:
    'Order groceries, staples, oils, dals, masalas, dairy & household essentials online. Home delivery in Sangareddy. Srivani Stores — Sangareddy since 1980.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Srivani Stores — Online Grocery in Sangareddy, Telangana',
    description: 'Order groceries online and get home delivery in Sangareddy, Telangana.',
    url: '/',
  },
};

export default async function HomePage() {
  const [categories, featured] = await Promise.all([
    getCategories(),
    getProducts({ limit: 8 }),
  ]);

  return (
    <div className="wrap">
      {/* ─── Slim hero strip — the seal doesn't stay legible shrunk into the
           header (tested: text renders at ~3-4px), so it lives here instead,
           full size but with minimal copy so categories stay near the top. */}
      <section className="mini-hero">
        <div className="seal-wrap">
          <div className="seal">
            <svg className="ring" viewBox="0 0 230 230" aria-hidden="true" focusable="false">
              <defs>
                <path
                  id="home-circle"
                  fill="none"
                  d="M115,115 m-92,0 a92,92 0 1,1 184,0 a92,92 0 1,1 -184,0"
                />
              </defs>
              <text>
                <textPath href="#home-circle" startOffset="0">
                  PURE · TRUST · QUALITY · SINCE 1980 · PURE · TRUST · QUALITY · SINCE 1980 ·{' '}
                </textPath>
              </text>
            </svg>
            <div className="core">
              <div className="yr">1980</div>
              <div className="leaf" />
              <div className="sub">Kirana &amp; General</div>
            </div>
          </div>
        </div>
        <div className="mini-hero-copy">
          <h1>Your favourite kirana is <em>now online.</em></h1>
          <p>Pure, Trust &amp; Quality since 1980 — home delivery and store pickup in Sangareddy.</p>
        </div>
      </section>

      {/* ─── Shop by category — LIVE, loads immediately ─────────────────── */}
      <section className="sec" style={{ paddingTop: '10px' }}>
        <p className="eyebrow">Shop by category</p>
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" style={{ gap: '14px' }}>
            {categories.map(cat => (
              <CategoryTile key={cat.id} category={cat} />
            ))}
          </div>
        ) : (
          <p className="text-ink-soft">Loading categories…</p>
        )}
      </section>

      {/* ─── Recently viewed (client-side, localStorage) ──────────────── */}
      <section className="sec" style={{ paddingBottom: 0 }}>
        <RecentlyViewedSection />
      </section>

      {/* ─── Featured products — LIVE ─────────────────────────────────── */}
      {featured.data.length > 0 && (
        <section className="sec">
          <p className="eyebrow">Featured products</p>
          <h2>Fresh picks from our shelves.</h2>
          <div className="products-grid">
            {featured.data.map(product => (
              <ProductCard key={product.code} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Browse Products banner ─────────────────────────────────── */}
      <Link href="/products" className="browse-banner">
        <div className="browse-banner-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <div>
            <p className="browse-banner-title">Browse all products</p>
            <p className="browse-banner-sub">Groceries, oils, dals, masalas, dairy, snacks &amp; more</p>
          </div>
        </div>
        <span className="browse-banner-arrow">
          Shop now &rarr;
        </span>
      </Link>
    </div>
  );
}

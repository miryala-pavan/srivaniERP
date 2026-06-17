import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page Not Found — Srivani Stores',
};

export default function NotFound() {
  return (
    <div className="wrap">
      <section className="sec" style={{ textAlign: 'center', paddingTop: '80px', paddingBottom: '80px' }}>
        <p style={{
          fontSize: '72px',
          fontFamily: 'var(--font-fraunces), serif',
          fontWeight: 900,
          color: 'var(--gold)',
          lineHeight: 1,
          marginBottom: '16px',
        }}>
          404
        </p>
        <p className="eyebrow">Nothing here</p>
        <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>
          Page not found
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: '15px', maxWidth: '400px', margin: '0 auto 36px', lineHeight: 1.7 }}>
          The product, category, or page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/products" className="btn btn-pri" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '12px 24px', borderRadius: '10px',
            background: 'var(--saffron)', color: '#fff',
            fontWeight: 700, fontSize: '14px', textDecoration: 'none',
          }}>
            Browse All Products
          </Link>
          <Link href="/search" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '12px 24px', borderRadius: '10px',
            border: '1.5px solid var(--line)', color: 'var(--ink)',
            fontWeight: 600, fontSize: '14px', textDecoration: 'none',
          }}>
            Search Products
          </Link>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '12px 24px', borderRadius: '10px',
            border: '1.5px solid var(--line)', color: 'var(--ink)',
            fontWeight: 600, fontSize: '14px', textDecoration: 'none',
          }}>
            Go Home
          </Link>
        </div>

        <div style={{ marginTop: '56px', color: 'var(--ink-soft)', fontSize: '13px' }}>
          Need help?{' '}
          <a href="tel:+919382828484" style={{ color: 'var(--saffron-deep)', fontWeight: 700 }}>
            Call +91 93828 28484
          </a>{' '}
          or{' '}
          <a
            href="https://wa.me/919382828484"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--saffron-deep)', fontWeight: 700 }}
          >
            WhatsApp us
          </a>
        </div>
      </section>
    </div>
  );
}

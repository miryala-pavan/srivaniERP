export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { getProducts } from '@/lib/shop';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';

export const metadata: Metadata = {
  title: 'Deals & Offers — Srivani Stores',
  description: 'Shop the best deals at Srivani Stores — products with genuine savings off the MRP, sorted by highest discount first.',
  openGraph: {
    title: 'Deals & Offers — Srivani Stores',
    description: 'Best deals and discounts at Srivani Stores, Sangareddy.',
  },
};

const PAGE_SIZE = 48;

interface Props {
  searchParams: { page?: string };
}

export default async function DealsPage({ searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  const result = await getProducts({
    dealsOnly: true,
    sort: 'savings',
    page,
    limit: PAGE_SIZE,
  });

  // Client-side filter: only show products where best pack actually has a discount
  const deals = result.data.filter(p =>
    p.packs.some(pk => pk.mrp !== null && pk.mrp > pk.price),
  );

  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem   = Math.min(page * PAGE_SIZE, result.total);

  return (
    <div className="wrap">
      <section className="sec">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            { label: 'Deals & Offers' },
          ]}
        />

        <p className="eyebrow">Special prices</p>
        <h2 style={{ marginBottom: '8px' }}>Deals &amp; Offers</h2>

        {result.total > 0 && (
          <p style={{ marginBottom: '28px', color: 'var(--ink-soft)', fontSize: '14px' }}>
            {`Showing ${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${result.total.toLocaleString()} discounted products`}
          </p>
        )}

        {deals.length > 0 ? (
          <div className="products-grid">
            {deals.map(p => (
              <ProductCard key={p.code} product={p} />
            ))}
          </div>
        ) : (
          <EmptyDeals />
        )}

        <Pagination
          page={page}
          totalPages={result.totalPages}
          baseHref="/deals"
        />
      </section>
    </div>
  );
}

function EmptyDeals() {
  return (
    <div className="empty-state" style={{ padding: '80px 24px' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏷️</div>
      <h3 style={{ fontSize: '18px', color: 'var(--ink)', marginBottom: '8px' }}>No deals right now</h3>
      <p style={{ fontSize: '14px' }}>Check back soon — we update offers regularly.</p>
      <a
        href="/products"
        style={{
          display: 'inline-block',
          marginTop: '20px',
          padding: '10px 24px',
          borderRadius: '10px',
          background: 'var(--saffron)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '14px',
          textDecoration: 'none',
        }}
      >
        Browse All Products
      </a>
    </div>
  );
}

export const dynamic = 'force-dynamic';
import { getProducts } from '@/lib/shop';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';

const PAGE_SIZE = 24;

interface Props {
  searchParams: { q?: string; page?: string };
}

export async function generateMetadata({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? '';
  return { title: q ? `"${q}" — Srivani Stores` : 'Search — Srivani Stores' };
}

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  const result = q
    ? await getProducts({ search: q, page, limit: PAGE_SIZE })
    : { data: [], total: 0, page: 1, totalPages: 0 };

  const baseHref = q ? `/search?q=${encodeURIComponent(q)}` : '/search';

  return (
    <div className="wrap">
      <section className="sec">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            { label: q ? `Search: "${q}"` : 'Search' },
          ]}
        />

        <p className="eyebrow">Search results</p>
        {q ? (
          <h2 style={{ marginBottom: '8px' }}>
            Results for <em>&ldquo;{q}&rdquo;</em>
          </h2>
        ) : (
          <h2 style={{ marginBottom: '8px' }}>Search products</h2>
        )}

        {q && (
          <p style={{ marginBottom: '28px', color: 'var(--ink-soft)', fontSize: '14px' }}>
            {result.total > 0
              ? `${result.total} product${result.total !== 1 ? 's' : ''} found`
              : 'No products found'}
          </p>
        )}

        {!q ? (
          <EmptyState
            icon="🔎"
            heading="What are you looking for?"
            body="Type a product name, brand, or code into the search bar above."
            actions={[
              { label: 'Browse All Products', href: '/products' },
              { label: 'View Deals', href: '/deals' },
            ]}
          />
        ) : (
          <>
            <ProductGrid
              products={result.data}
              emptyIcon="😕"
              emptyHeading={`No results for "${q}"`}
              emptyMessage="We couldn't find any products matching that search. Try a different term or browse by category."
              emptyActions={[
                { label: 'Browse All Products', href: '/products' },
                { label: 'View Deals', href: '/deals' },
              ]}
            />
            <Pagination
              page={page}
              totalPages={result.totalPages}
              baseHref={baseHref}
            />
          </>
        )}
      </section>
    </div>
  );
}

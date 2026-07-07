export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { getProducts, getDepartments } from '@/lib/shop';
import type { SortOption } from '@/lib/shop';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';
import MobileSearchInput from '@/components/MobileSearchInput';
import FilterSidebar from '@/components/FilterSidebar';
import MobileSortSelect from '@/components/MobileSortSelect';

const PAGE_SIZE = 24;

interface Props {
  searchParams: {
    q?: string; page?: string; dept?: string; sort?: string; inStock?: string;
    minPrice?: string; maxPrice?: string;
  };
}

export async function generateMetadata({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? '';
  return { title: q ? `"${q}" — Srivani Stores` : 'Search — Srivani Stores' };
}

export default async function SearchPage({ searchParams }: Props) {
  const q         = searchParams.q?.trim() ?? '';
  const page      = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const deptCode  = searchParams.dept?.trim() || undefined;
  const sort      = (searchParams.sort as SortOption) || 'nameAsc';
  const inStock   = searchParams.inStock === 'true';
  const minPrice  = searchParams.minPrice ? Number(searchParams.minPrice) : undefined;
  const maxPrice  = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined;

  const [departments, result] = await Promise.all([
    getDepartments(),
    q
      ? getProducts({ search: q, deptCode, sort, inStock, minPrice, maxPrice, page, limit: PAGE_SIZE })
      : Promise.resolve({ data: [], total: 0, page: 1, totalPages: 0 }),
  ]);

  const baseHref = (() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (deptCode) p.set('dept', deptCode);
    if (sort && sort !== 'nameAsc') p.set('sort', sort);
    if (inStock) p.set('inStock', 'true');
    if (minPrice != null) p.set('minPrice', String(minPrice));
    if (maxPrice != null) p.set('maxPrice', String(maxPrice));
    const qs = p.toString();
    return `/search${qs ? `?${qs}` : ''}`;
  })();

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
        <h2 style={{ marginBottom: '16px' }}>
          {q ? <>Results for <em>&ldquo;{q}&rdquo;</em></> : 'Search products'}
        </h2>

        {/* Search input — always visible, essential on mobile where header bar is hidden */}
        <MobileSearchInput initialQuery={q} />

        {q && (
          <p style={{ marginBottom: '20px', color: 'var(--ink-soft)', fontSize: '14px' }}>
            {result.total > 0
              ? `${result.total} product${result.total !== 1 ? 's' : ''} found`
              : 'No products found'}
          </p>
        )}

        {!q ? (
          <EmptyState
            icon="🔎"
            heading="What are you looking for?"
            body="Type above to search for rice, dal, oil, masala, and thousands more products."
            actions={[
              { label: 'Browse All Products', href: '/products' },
              { label: 'View Deals', href: '/deals' },
            ]}
          />
        ) : (
          <div className="browse-layout">
            <Suspense fallback={null}>
              <FilterSidebar
                departments={departments}
                total={result.total}
                currentDept={deptCode ?? ''}
                currentSort={sort}
                currentInStock={inStock}
                currentMinPrice={searchParams.minPrice ?? ''}
                currentMaxPrice={searchParams.maxPrice ?? ''}
                basePath="/search"
              />
            </Suspense>

            <div>
              <div className="browse-toolbar">
                <span className="browse-count" />
                <Suspense fallback={null}>
                  <MobileSortSelect currentSort={sort} />
                </Suspense>
              </div>

              <ProductGrid
                products={result.data}
                emptyIcon="😕"
                emptyHeading={`No results for "${q}"`}
                emptyMessage="We couldn't find any products matching that search. Try a different term, remove some filters, or browse by category."
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
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

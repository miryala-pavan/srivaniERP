export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getDepartments, getProducts } from '@/lib/shop';
import type { SortOption } from '@/lib/shop';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import FilterSidebar from '@/components/FilterSidebar';
import MobileSortSelect from '@/components/MobileSortSelect';
import Breadcrumbs from '@/components/Breadcrumbs';
import EmptyState from '@/components/EmptyState';

export const metadata: Metadata = {
  title: 'Browse All Products — Srivani Stores',
  description: 'Shop the full range at Srivani Stores, Sangareddy — groceries, personal care, homecare and more. Pure, Trust & Quality since 1983.',
  openGraph: {
    title: 'Browse All Products — Srivani Stores',
    description: 'Shop groceries, personal care, homecare and more at Srivani Stores, Sangareddy.',
    type: 'website',
  },
};

const PAGE_SIZE = 48;


interface Props {
  searchParams: {
    dept?: string;
    sort?: string;
    inStock?: string;
    page?: string;
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const deptCode  = searchParams.dept?.trim() || undefined;
  const sort      = (searchParams.sort as SortOption) || 'nameAsc';
  const inStock   = searchParams.inStock === 'true';
  const page      = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  const baseHref = (() => {
    const p = new URLSearchParams();
    if (deptCode) p.set('dept', deptCode);
    if (sort && sort !== 'nameAsc') p.set('sort', sort);
    if (inStock) p.set('inStock', 'true');
    const qs = p.toString();
    return `/products${qs ? `?${qs}` : ''}`;
  })();

  const [departments, result] = await Promise.all([
    getDepartments(),
    getProducts({ deptCode, sort, inStock, page, limit: PAGE_SIZE }),
  ]);

  const activeDept = departments.find(d => d.code === deptCode);
  const startItem  = (page - 1) * PAGE_SIZE + 1;
  const endItem    = Math.min(page * PAGE_SIZE, result.total);

  return (
    <div className="browse-wrap">
      <div style={{ paddingTop: '24px' }}>
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            { label: activeDept ? activeDept.name : 'All Products' },
          ]}
        />
      </div>

      <div className="browse-layout">
        {/* Sidebar + mobile button — client component */}
        <Suspense fallback={null}>
          <FilterSidebar
            departments={departments}
            total={result.total}
            currentDept={deptCode ?? ''}
            currentSort={sort}
            currentInStock={inStock}
          />
        </Suspense>

        {/* Main content */}
        <div>
          {/* Toolbar */}
          <div className="browse-toolbar">
            <span className="browse-count">
              {result.total === 0
                ? 'No products found'
                : `Showing ${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${result.total.toLocaleString()} products`}
              {activeDept ? ` in ${activeDept.name}` : ''}
            </span>

            {/* Mobile sort — hidden on desktop via CSS */}
            <Suspense fallback={null}>
              <MobileSortSelect currentSort={sort} />
            </Suspense>
          </div>

          {/* Product grid */}
          {result.data.length > 0 ? (
            <div className="products-grid">
              {result.data.map(product => (
                <ProductCard key={product.code} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📦"
              heading="No products found"
              body={
                deptCode
                  ? `No products found in this department${inStock ? ' with stock available' : ''}. Try removing filters or browsing another department.`
                  : `No products found${inStock ? ' in stock right now' : ''}. Try adjusting your filters.`
              }
              actions={[
                { label: 'Browse Everything', href: '/products' },
                { label: 'View Deals', href: '/deals' },
              ]}
            />
          )}

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={result.totalPages}
            baseHref={baseHref}
          />
        </div>
      </div>
    </div>
  );
}

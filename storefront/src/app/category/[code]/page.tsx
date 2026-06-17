import { notFound } from 'next/navigation';
import { getCategories, getProducts, getNavTree } from '@/lib/shop';
import Breadcrumbs from '@/components/Breadcrumbs';
import SubcategoryFilter from '@/components/SubcategoryFilter';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 24;

interface Props {
  params: { code: string };
  searchParams: { sub?: string; page?: string };
}

export async function generateMetadata({ params }: Props) {
  const categories = await getCategories();
  const cat = categories.find(c => c.code === params.code);
  const name = cat?.label || cat?.name || params.code;
  const count = cat?.productCount;
  const description = `Shop ${name} at Srivani Stores, Sangareddy${count ? ` — ${count} products available` : ''}. Fresh groceries, pure quality since 1983. Order via WhatsApp.`;

  return {
    title: `${name} — Srivani Stores`,
    description,
    openGraph: {
      title: `${name} — Srivani Stores`,
      description,
      type: 'website',
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { code } = params;
  const activeSub = searchParams.sub;
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  const [categories, result, navTree] = await Promise.all([
    getCategories(),
    getProducts({
      categoryCode: code,
      subCategoryCode: activeSub,
      page,
      limit: PAGE_SIZE,
    }),
    getNavTree(),
  ]);

  // Support both top-level category codes AND subcategory codes directly
  let cat = categories.find(c => c.code === code);
  let isSubcategoryPage = false;
  let parentCatForSub = null;

  if (!cat) {
    // Check if `code` is a subcategory code — find it in the tree
    for (const c of categories) {
      const sub = c.subcategories.find(s => s.code === code);
      if (sub) {
        parentCatForSub = c;
        // Synthesize a cat-like object for the subcategory
        cat = { ...sub, subcategories: [], productCount: sub.productCount } as any;
        isSubcategoryPage = true;
        break;
      }
    }
  }
  if (!cat) notFound();

  const catLabel = cat.label || cat.name;
  const activeSub_ = !isSubcategoryPage
    ? cat.subcategories.find(s => s.code === activeSub)
    : undefined;
  const subLabel = activeSub_?.label || activeSub_?.name;

  // Build full breadcrumb using navTree for department info
  const navDept = navTree.find(d =>
    d.categories.some(nc => nc.code === code || nc.code === parentCatForSub?.code
      || nc.subcategories.some(s => s.code === code)),
  );
  const navCat = navDept?.categories.find(nc =>
    nc.code === code || nc.code === parentCatForSub?.code
    || nc.subcategories.some(s => s.code === code),
  );

  const baseHref = activeSub
    ? `/category/${code}?sub=${activeSub}`
    : `/category/${code}`;

  const crumbs = [
    { label: 'Home', href: '/' },
    ...(navDept ? [{ label: navDept.name, href: `/products?dept=${navDept.code}` }] : []),
    // If we're viewing a subcategory directly, show the parent category as a breadcrumb
    ...(isSubcategoryPage && parentCatForSub
      ? [{ label: parentCatForSub.label || parentCatForSub.name, href: `/category/${parentCatForSub.code}` }]
      : navCat && navCat.code !== code
      ? [{ label: navCat.name, href: `/category/${navCat.code}` }]
      : []),
    { label: catLabel, href: activeSub ? `/category/${code}` : undefined },
    ...(subLabel ? [{ label: subLabel }] : []),
  ];

  return (
    <div className="wrap">
      <section className="sec">
        <Breadcrumbs crumbs={crumbs} />

        <p className="eyebrow">Shop by aisle</p>
        <h2 style={{ marginBottom: '8px' }}>{catLabel}</h2>
        {result.total > 0 && (
          <p style={{ marginBottom: '24px', color: 'var(--ink-soft)', fontSize: '14px' }}>
            {result.total} product{result.total !== 1 ? 's' : ''}
            {subLabel ? ` in ${subLabel}` : ''}
          </p>
        )}

        {!isSubcategoryPage && (
          <SubcategoryFilter
            categoryCode={code}
            subcategories={cat.subcategories}
            activeSub={activeSub}
          />
        )}

        <ProductGrid
          products={result.data}
          emptyIcon="🛒"
          emptyHeading="No products here yet"
          emptyMessage={
            activeSub
              ? `We don't have any products in this subcategory right now. Try browsing the full ${catLabel} aisle or search for what you need.`
              : `We don't have any products in ${catLabel} right now. Try browsing all products or searching for something specific.`
          }
          emptyActions={[
            { label: 'Browse All Products', href: '/products' },
            { label: 'Search Products', href: '/search' },
          ]}
        />

        <Pagination
          page={page}
          totalPages={result.totalPages}
          baseHref={baseHref}
        />
      </section>
    </div>
  );
}

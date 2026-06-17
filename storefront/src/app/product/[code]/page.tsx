import { notFound } from 'next/navigation';
import { getProduct, getProducts } from '@/lib/shop';
import type { ShopProduct } from '@/lib/shop';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductImage from '@/components/ProductImage';
import ProductDetailListButton from '@/components/ProductDetailListButton';
import RelatedProducts from '@/components/RelatedProducts';
import WishlistButton from '@/components/WishlistButton';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4002').replace(/\/$/, '');

function buildJsonLd(product: ShopProduct) {
  const inStockPacks = product.packs.filter(p => p.inStock);
  const allPacks     = product.packs;

  const makeOffer = (pack: ShopProduct['packs'][number]) => ({
    '@type': 'Offer',
    name: pack.packLabel,
    price: pack.price.toFixed(2),
    priceCurrency: 'INR',
    availability: pack.inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    url: `${SITE_URL}/product/${product.code}`,
    seller: { '@type': 'Organization', name: 'Srivani Stores' },
  });

  const offers =
    allPacks.length === 1
      ? makeOffer(allPacks[0])
      : {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice:  Math.min(...allPacks.map(p => p.price)).toFixed(2),
          highPrice: Math.max(...allPacks.map(p => p.price)).toFixed(2),
          offerCount: allPacks.length,
          offers: allPacks.map(makeOffer),
        };

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    sku: product.code,
    ...(product.description ? { description: product.description } : {}),
    ...(product.imageUrl    ? { image: product.imageUrl }           : {}),
    brand: { '@type': 'Brand', name: 'Srivani Stores' },
    ...(inStockPacks.length > 0 ? { keywords: product.keywords ?? undefined } : {}),
    offers,
  };
}

interface Props {
  params: { code: string };
}

export async function generateMetadata({ params }: Props) {
  const product = await getProduct(params.code);
  if (!product) return { title: 'Product not found — Srivani Stores' };

  const price = product.fromPrice;
  const cat = [product.categoryName, product.subcategoryName].filter(Boolean).join(' › ');
  const metaDesc = product.description
    ? `${product.description.slice(0, 140)}… Buy at Srivani Stores from ₹${price}.`
    : `Buy ${product.name}${cat ? ` (${cat})` : ''} at Srivani Stores, Sangareddy. From ₹${price}. Order via WhatsApp for home delivery.`;

  return {
    title: `${product.name} — Srivani Stores`,
    description: metaDesc,
    keywords: product.keywords ?? undefined,
    openGraph: {
      title: `${product.name} — Srivani Stores`,
      description: metaDesc,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : [],
      type: 'website',
    },
  };
}

function formatPrice(price: number) {
  return price % 1 === 0 ? String(price) : price.toFixed(2);
}

function buildWhatsAppUrl(productName: string, packLabel: string, price: number) {
  const text = `Hi Srivani Stores, I'd like to order: ${productName} - ${packLabel} (Rs.${formatPrice(price)}).`;
  return `https://wa.me/919382828484?text=${encodeURIComponent(text)}`;
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.code);
  if (!product) notFound();

  // Related products — same subcategory, exclude self, max 6
  const relatedResult = product.categoryCode
    ? await getProducts({ subCategoryCode: product.categoryCode, limit: 7 })
    : null;
  const related = (relatedResult?.data ?? []).filter(p => p.code !== product.code).slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(product)) }}
      />
    <div className="wrap">
      <section className="sec">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            ...(product.deptName && product.deptCode
              ? [{ label: product.deptName, href: `/products?dept=${product.deptCode}` }]
              : []),
            ...(product.categoryName && product.parentCategoryCode
              ? [{ label: product.categoryName, href: `/category/${product.parentCategoryCode}` }]
              : product.categoryName
              ? [{ label: product.categoryName }]
              : []),
            ...(product.subcategoryName && product.categoryCode
              ? [{ label: product.subcategoryName, href: `/category/${product.categoryCode}` }]
              : product.subcategoryName
              ? [{ label: product.subcategoryName }]
              : []),
            { label: product.name },
          ]}
        />

        <div className="product-layout">
          {/* Left — image */}
          <div className="product-image-wrap">
            <ProductImage
              imageUrl={product.imageUrl}
              alt={product.name}
            />
          </div>

          {/* Right — details */}
          <div className="product-detail-col">
            {(product.categoryName || product.subcategoryName) && (
              <p className="product-meta">
                {[product.categoryName, product.subcategoryName]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <h1 style={{ flex: 1, margin: 0 }}>{product.name}</h1>
              <WishlistButton
                code={product.code}
                name={product.name}
                imageUrl={product.imageUrl}
                fromPrice={product.fromPrice}
                categoryName={product.categoryName ?? undefined}
                size="lg"
              />
            </div>

            {/* ── Size / variant picker (same product, different pack sizes) ── */}
            {product.groupVariants && product.groupVariants.length > 1 && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                  Size
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {product.groupVariants.map(v => {
                    const isCurrent = v.code === product.code;
                    return (
                      <a
                        key={v.code}
                        href={`/product/${v.code}`}
                        style={{
                          display:       'inline-flex',
                          flexDirection: 'column',
                          alignItems:    'center',
                          gap:           '2px',
                          padding:       '6px 14px',
                          borderRadius:  '10px',
                          border:        isCurrent ? '2px solid var(--saffron-deep)' : '1.5px solid var(--line)',
                          background:    isCurrent ? 'var(--paper-2, #F3E8CF)' : 'var(--paper, #FFFBF4)',
                          textDecoration: 'none',
                          opacity:       v.inStock ? 1 : 0.5,
                          cursor:        v.inStock ? 'pointer' : 'default',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isCurrent ? 'var(--saffron-deep)' : 'var(--ink)' }}>
                          {v.label}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>
                          ₹{v.fromPrice % 1 === 0 ? String(v.fromPrice) : v.fromPrice.toFixed(2)}
                        </span>
                        {!v.inStock && (
                          <span style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.3px' }}>Out of stock</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="packs-heading">
              {product.packs.length === 1 ? 'Available pack' : 'Available packs'}
            </p>

            <div className="packs-list">
              {product.packs.map(pack => (
                <div
                  key={pack.pluBarcode}
                  className={`pack-row${!pack.inStock ? ' pack-out-row' : ''}`}
                >
                  <div className="pack-info">
                    <div className="pack-label">{pack.packLabel}</div>
                    <div className="pack-pricing">
                      <span className="pack-price">₹{formatPrice(pack.price)}</span>
                      {pack.mrp !== null && pack.mrp > pack.price && (
                        <span className="pack-mrp">MRP ₹{formatPrice(pack.mrp)}</span>
                      )}
                    </div>
                  </div>

                  <div className="pack-actions">
                    <span
                      className={`pack-stock-dot ${pack.inStock ? 'in' : 'out'}`}
                      title={pack.inStock ? 'In stock' : 'Out of stock'}
                    />
                    {pack.inStock ? (
                      <a
                        href={buildWhatsAppUrl(product.name, pack.packLabel, pack.price)}
                        className="pack-order-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z" />
                        </svg>
                        Order on WhatsApp
                      </a>
                    ) : (
                      <span className="pack-out-label">Out of stock</span>
                    )}
                    <ProductDetailListButton
                      code={pack.pluBarcode}
                      name={product.name}
                      packLabel={pack.packLabel}
                      sellingPrice={pack.price}
                      imageUrl={product.imageUrl}
                      inStock={pack.inStock}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Description ────────────────────────────────────────────── */}
        {product.description && (
          <div style={{
            marginTop: '40px',
            padding: '24px 28px',
            background: 'var(--paper-2, #F3E8CF)',
            borderRadius: '14px',
            maxWidth: '720px',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px', color: 'var(--ink)' }}>
              About this product
            </h2>
            <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--ink-soft)', whiteSpace: 'pre-line' }}>
              {product.description}
            </p>
          </div>
        )}

        {/* ── Related products ────────────────────────────────────────── */}
        <RelatedProducts products={related} categoryCode={product.categoryCode} />
      </section>
    </div>
    </>
  );
}

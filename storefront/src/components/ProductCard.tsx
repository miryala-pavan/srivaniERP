'use client';

import Link from 'next/link';
import type { ShopProduct } from '@/lib/shop';
import ProductImage from './ProductImage';
import AddToListButton from './AddToListButton';
import WishlistButton from './WishlistButton';

const TRIVIAL_LABELS = new Set(['', '1 unit', 'default', 'pcs', '1']);

function fmtPrice(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

interface Props {
  product: ShopProduct;
}

export default function ProductCard({ product }: Props) {
  const inStock = product.packs.some(p => p.inStock);

  // cheapest in-stock pack first, otherwise any cheapest pack
  const sorted   = [...product.packs].sort((a, b) => a.price - b.price);
  const bestPack = sorted.find(p => p.inStock) ?? sorted[0];

  const sp         = bestPack?.price ?? product.fromPrice;
  const mrp        = bestPack?.mrp ?? null;
  const packLabel  = bestPack?.packLabel ?? '';
  const showBadge  = !TRIVIAL_LABELS.has(packLabel.toLowerCase().trim());
  const hasDisc    = mrp !== null && mrp > sp;
  const savings    = hasDisc ? Math.round(mrp! - sp) : 0;
  const pctOff     = hasDisc ? Math.round(((mrp! - sp) / mrp!) * 100) : 0;

  // Low stock warning: show when online-available qty is 1–10
  const availableQty = bestPack?.availableQty ?? 0;
  const showLowStock = inStock && availableQty > 0 && availableQty <= 10;

  return (
    <Link
      href={`/product/${product.code}`}
      className={`group flex flex-col rounded-2xl border bg-paper2 overflow-hidden
        hover:shadow-md transition-all duration-200
        ${inStock ? 'border-line hover:border-saffron' : 'border-line'}`}
    >
      {/* ── Image ─────────────────────────────────────────────── */}
      <div className="aspect-square w-full overflow-hidden bg-cream relative">
        <ProductImage
          imageUrl={product.imageUrl}
          alt={product.name}
          className={`w-full h-full object-contain p-3 transition-transform duration-300
            ${inStock ? 'group-hover:scale-105' : 'opacity-60'}`}
        />

        {/* Wishlist heart — top-left */}
        <div
          onClick={e => e.preventDefault()}
          style={{ position: 'absolute', top: '6px', left: '6px', zIndex: 1 }}
        >
          <WishlistButton
            code={product.code}
            name={product.name}
            imageUrl={product.imageUrl}
            fromPrice={product.fromPrice}
            categoryName={product.categoryName ?? undefined}
          />
        </div>

        {/* Pack size badge — top-right */}
        {showBadge && (
          <span style={{
            position:   'absolute',
            top:        '7px',
            right:      '7px',
            fontSize:   '9px',
            fontWeight: 600,
            background: 'rgba(44,27,16,0.09)',
            color:      'var(--ink-soft)',
            borderRadius: '5px',
            padding:    '2px 6px',
            letterSpacing: '0.2px',
          }}>
            {packLabel}
          </span>
        )}

        {/* Low stock badge */}
        {showLowStock && (
          <div style={{
            position:    'absolute',
            bottom:      0,
            left:        0,
            right:       0,
            background:  'rgba(234, 88, 12, 0.88)',
            padding:     '4px 0',
            textAlign:   'center',
            fontSize:    '9.5px',
            fontWeight:  700,
            letterSpacing: '0.5px',
            color:       '#fff',
          }}>
            Only {availableQty} left online!
          </div>
        )}

        {/* Out of Stock overlay — bottom strip */}
        {!inStock && (
          <div style={{
            position:       'absolute',
            bottom:         0,
            left:           0,
            right:          0,
            background:     'rgba(0,0,0,0.54)',
            padding:        '5px 0',
            textAlign:      'center',
            fontSize:       '9.5px',
            fontWeight:     700,
            letterSpacing:  '1.2px',
            textTransform:  'uppercase',
            color:          '#fff',
          }}>
            Out of Stock
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col flex-1" style={{ gap: '3px' }}>
        {product.categoryName && (
          <span className="text-ink-soft uppercase tracking-wide"
            style={{ fontSize: '10px', fontFamily: 'var(--font-hanken), sans-serif' }}>
            {product.categoryName}
          </span>
        )}

        <p className="font-heading text-ink font-semibold leading-tight line-clamp-2"
          style={{ fontSize: '13px' }}>
          {product.name}
        </p>

        {/* Product code */}
        <span style={{
          display:       'inline-block',
          fontSize:      '10px',
          color:         '#5a4a3a',
          fontFamily:    'monospace',
          letterSpacing: '0.5px',
          fontWeight:    600,
          background:    'rgba(44,27,16,0.07)',
          borderRadius:  '4px',
          padding:       '1px 5px',
        }}>
          {product.code}
        </span>

        {/* Pricing + Add to list */}
        <div className="mt-auto" style={{ paddingTop: '8px' }}>
          <div className="flex items-baseline flex-wrap" style={{ gap: '6px', marginBottom: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-fraunces), serif',
              fontWeight: 700,
              fontSize:   '15px',
              color:      'var(--saffron-deep)',
            }}>
              &#8377;{fmtPrice(sp)}
            </span>

            {hasDisc && (
              <span style={{
                fontSize:       '12px',
                color:          '#bbb',
                textDecoration: 'line-through',
              }}>
                &#8377;{fmtPrice(mrp!)}
              </span>
            )}

            {savings > 0 && (
              <span style={{
                fontSize:   '9px',
                fontWeight: 700,
                color:      '#2d7a2d',
                background: 'rgba(45,122,45,0.10)',
                borderRadius: '4px',
                padding:    '1px 5px',
              }}>
                {pctOff > 0 ? `${pctOff}% off` : `Save ₹${savings}`}
              </span>
            )}
          </div>
          <div onClick={e => e.preventDefault()}>
            <AddToListButton
              code={bestPack?.pluBarcode ?? product.code}
              name={product.name}
              packLabel={packLabel || product.packs[0]?.unit || ''}
              sellingPrice={sp}
              imageUrl={product.imageUrl}
              disabled={!inStock}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

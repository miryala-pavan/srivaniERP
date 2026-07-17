import Link from 'next/link';
import type { ShopCategory } from '@/lib/shop';

const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE ?? 'http://localhost:4001';

interface Props {
  category: ShopCategory;
}

// A "basket" mosaic built from real product photos already in the category —
// there's no dedicated category image in the system, so this stands in for one.
export default function CategoryTile({ category }: Props) {
  const images = (category.sampleImages ?? []).slice(0, 4);

  return (
    <Link
      href={`/category/${category.code}`}
      className="group flex flex-col rounded-2xl border border-line bg-paper2 overflow-hidden hover:border-saffron hover:shadow-md transition-all duration-200"
    >
      <div className="aspect-square w-full bg-cream p-2">
        {images.length > 0 ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-1.5 w-full h-full">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-lg overflow-hidden bg-white flex items-center justify-center">
                {images[i] ? (
                  <img
                    src={`${IMG_BASE}${images[i]}`}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-cream" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full rounded-lg bg-cream flex items-center justify-center">
            <span className="font-heading text-saffron-deep font-bold text-3xl opacity-40">
              {(category.label || category.name).charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col" style={{ gap: '2px' }}>
        <p className="font-heading text-ink font-semibold leading-tight line-clamp-2" style={{ fontSize: '13px' }}>
          {category.label || category.name}
        </p>
        <span className="text-ink-soft" style={{ fontSize: '11px' }}>
          {category.productCount} item{category.productCount !== 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  );
}

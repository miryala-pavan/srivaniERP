import { ShopProduct } from '@/lib/shop';
import ProductCard from './ProductCard';
import EmptyState from './EmptyState';

interface EmptyAction {
  label: string;
  href: string;
}

interface Props {
  products: ShopProduct[];
  emptyMessage?: string;
  emptyHeading?: string;
  emptyActions?: EmptyAction[];
  emptyIcon?: string;
}

export default function ProductGrid({
  products,
  emptyMessage = 'No products found.',
  emptyHeading = 'Nothing here yet',
  emptyActions,
  emptyIcon,
}: Props) {
  if (products.length > 0) {
    return (
      <div className="products-grid">
        {products.map(product => (
          <ProductCard key={product.code} product={product} />
        ))}
      </div>
    );
  }

  const defaultActions: EmptyAction[] = emptyActions ?? [
    { label: 'Browse All Products', href: '/products' },
    { label: 'View Deals', href: '/deals' },
  ];

  return (
    <div className="products-grid">
      <EmptyState
        icon={emptyIcon}
        heading={emptyHeading}
        body={emptyMessage}
        actions={defaultActions}
      />
    </div>
  );
}

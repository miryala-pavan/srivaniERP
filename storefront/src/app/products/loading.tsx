import ProductGridSkeleton from '@/components/ProductGridSkeleton';

export default function ProductsLoading() {
  return (
    <div className="browse-wrap">
      <div className="browse-layout">
        {/* Sidebar skeleton */}
        <aside className="browse-sidebar" aria-hidden="true">
          <div style={{ height: 24, width: 120, background: 'rgba(44,27,16,.07)', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 14, width: 80, background: 'rgba(44,27,16,.05)', borderRadius: 4, marginBottom: 24 }} />
          {[120, 100, 140, 110, 90, 130].map((w, i) => (
            <div key={i} style={{ height: 13, width: w, background: 'rgba(44,27,16,.06)', borderRadius: 4, marginBottom: 10 }} />
          ))}
        </aside>

        <div>
          <div style={{ height: 20, width: 220, background: 'rgba(44,27,16,.07)', borderRadius: 4, marginBottom: 24 }} />
          <ProductGridSkeleton count={12} />
        </div>
      </div>
    </div>
  );
}

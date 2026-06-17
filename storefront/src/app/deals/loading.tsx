import ProductGridSkeleton from '@/components/ProductGridSkeleton';

export default function DealsLoading() {
  return (
    <div className="wrap">
      <div className="sec">
        <div style={{ height: 14, width: 160, background: 'rgba(44,27,16,.06)', borderRadius: 4, marginBottom: 20 }} />
        <div style={{ height: 28, width: 200, background: 'rgba(44,27,16,.08)', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 14, width: 280, background: 'rgba(44,27,16,.05)', borderRadius: 4, marginBottom: 32 }} />
        <ProductGridSkeleton count={12} />
      </div>
    </div>
  );
}

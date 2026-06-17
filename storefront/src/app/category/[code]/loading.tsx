import ProductGridSkeleton from '@/components/ProductGridSkeleton';

export default function CategoryLoading() {
  return (
    <div className="wrap">
      <div className="sec">
        <div style={{ height: 14, width: 200, background: 'rgba(44,27,16,.06)', borderRadius: 4, marginBottom: 20 }} />
        <div style={{ height: 11, width: 100, background: 'rgba(44,27,16,.05)', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 32, width: 240, background: 'rgba(44,27,16,.08)', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 14, width: 100, background: 'rgba(44,27,16,.05)', borderRadius: 4, marginBottom: 28 }} />
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}

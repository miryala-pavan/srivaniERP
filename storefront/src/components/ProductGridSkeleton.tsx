interface Props {
  count?: number;
}

export default function ProductGridSkeleton({ count = 12 }: Props) {
  return (
    <div className="products-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="sk-img" />
          <div className="sk-body">
            <div className="sk-line sk-short" style={{ width: '40%', marginBottom: 4 }} />
            <div className="sk-line" />
            <div className="sk-line" style={{ width: '75%' }} />
            <div className="sk-line sk-price" style={{ marginTop: 10 }} />
            <div className="sk-line sk-short" style={{ width: '50%', height: 8, marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

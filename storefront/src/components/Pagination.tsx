import Link from 'next/link';

interface Props {
  page: number;
  totalPages: number;
  baseHref: string;
}

function pageHref(baseHref: string, page: number): string {
  const sep = baseHref.includes('?') ? '&' : '?';
  return `${baseHref}${sep}page=${page}`;
}

export default function Pagination({ page, totalPages, baseHref }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      {page > 1 ? (
        <Link href={pageHref(baseHref, page - 1)} className="page-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Prev
        </Link>
      ) : (
        <span className="page-btn disabled">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Prev
        </span>
      )}

      <span className="page-info">Page {page} of {totalPages}</span>

      {page < totalPages ? (
        <Link href={pageHref(baseHref, page + 1)} className="page-btn">
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      ) : (
        <span className="page-btn disabled">
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      )}
    </div>
  );
}

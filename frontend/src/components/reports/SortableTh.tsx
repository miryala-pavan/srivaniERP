'use client';

interface Props {
  column: string;
  label: string;
  sort: string | null;
  dir: 'asc' | 'desc';
  onSort: (col: string) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export default function SortableTh({
  column, label, sort, dir, onSort, align = 'left', className = '',
}: Props) {
  const active = sort === column;

  return (
    <th
      onClick={() => onSort(column)}
      className={`px-4 py-2.5 font-medium cursor-pointer select-none group text-${align} ${className}`}
      title={`Sort by ${label}`}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && (
          <span className={`text-[10px] transition-opacity ${active ? 'opacity-100 text-[#1B4F8A]' : 'opacity-0 group-hover:opacity-40'}`}>
            {active && dir === 'desc' ? '↑' : '↓'}
          </span>
        )}
        <span className={active ? 'text-[#1B4F8A]' : ''}>{label}</span>
        {align !== 'right' && (
          <span className={`text-[10px] transition-opacity ${active ? 'opacity-100 text-[#1B4F8A]' : 'opacity-0 group-hover:opacity-40'}`}>
            {active && dir === 'desc' ? '↑' : '↓'}
          </span>
        )}
      </span>
    </th>
  );
}

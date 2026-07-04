'use client';

import { useState, useRef, useEffect } from 'react';
import { Columns3 } from 'lucide-react';

interface ColDef { key: string; label: string; }

interface Props {
  columns: ColDef[];
  isVisible: (key: string) => boolean;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}

export default function ColumnToggle({ columns, isVisible, onToggle, onShowAll }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hiddenCount = columns.filter(c => !isVisible(c.key)).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
          hiddenCount > 0
            ? 'border-[#1B4F8A] text-[#1B4F8A] bg-blue-50'
            : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
        }`}
        title="Show / hide columns"
      >
        <Columns3 className="w-3.5 h-3.5" />
        Columns{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[180px]">
          <div className="px-3 pb-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Columns</span>
            <button onClick={onShowAll} className="text-[11px] text-[#1B4F8A] hover:underline">Show all</button>
          </div>
          {columns.map(col => (
            <label key={col.key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible(col.key)}
                onChange={() => onToggle(col.key)}
                className="rounded border-gray-300 text-[#1B4F8A] focus:ring-[#1B4F8A]"
              />
              <span className="text-sm text-gray-700">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

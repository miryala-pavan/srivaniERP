'use client';
import { useState, useRef, useEffect } from 'react';
import { CalendarRange, ChevronDown, RotateCcw, Lock } from 'lucide-react';
import { useFY } from '@/context/FYContext';
import Link from 'next/link';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FYSwitcher() {
  const { activeFY, selectedFY, allFYs, isHistorical, setSelectedFY, resetToActive } = useFY();
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!selectedFY || allFYs.length === 0) return null;

  return (
    <div className={`w-full border-b px-4 py-1.5 flex items-center gap-3 text-xs transition-colors
      ${isHistorical
        ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-gray-100'}`}>

      {/* FY selector */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 font-semibold rounded-full px-3 py-1 transition-colors
            ${isHistorical
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          <CalendarRange className="w-3.5 h-3.5" />
          FY {selectedFY.fyCode}
          {selectedFY.isClosed && <Lock className="w-3 h-3 ml-0.5 text-red-500" />}
          <ChevronDown className="w-3 h-3" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[240px] py-1">
            {allFYs.map(fy => (
              <button key={fy.id}
                onClick={() => { setSelectedFY(fy); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors
                  ${selectedFY.id === fy.id ? 'bg-indigo-50' : ''}`}>
                <div>
                  <p className={`font-semibold text-xs ${selectedFY.id === fy.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                    FY {fy.fyCode}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {fmtDate(fy.startDate)} – {fmtDate(fy.endDate)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {fy.isActive && !fy.isClosed && (
                    <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                  {fy.isClosed && (
                    <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Closed
                    </span>
                  )}
                  {selectedFY.id === fy.id && (
                    <span className="text-[10px] text-indigo-500">● viewing</span>
                  )}
                </div>
              </button>
            ))}

            <div className="border-t border-gray-100 mt-1 pt-1 px-2 pb-1">
              <Link href="/dashboard/settings/financial-year"
                className="block text-[11px] text-indigo-600 hover:text-indigo-800 font-medium px-1 py-1">
                ⚙ Manage Financial Years →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Period text */}
      <span className={`hidden sm:inline ${isHistorical ? 'text-amber-700' : 'text-gray-400'}`}>
        {fmtDate(selectedFY.startDate)} – {fmtDate(selectedFY.endDate)}
      </span>

      {/* Historical mode warning */}
      {isHistorical && (
        <>
          <span className="text-amber-700 font-semibold">
            📂 Viewing historical year — read-only
          </span>
          <button onClick={resetToActive}
            className="flex items-center gap-1 text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-full px-2 py-0.5 font-semibold transition-colors ml-auto">
            <RotateCcw className="w-3 h-3" />
            Back to {activeFY?.fyCode}
          </button>
        </>
      )}

      {/* Active FY — show manage link subtly */}
      {!isHistorical && (
        <Link href="/dashboard/settings/financial-year"
          className="ml-auto text-gray-400 hover:text-indigo-600 text-[11px] transition-colors hidden md:block">
          Manage FY
        </Link>
      )}
    </div>
  );
}

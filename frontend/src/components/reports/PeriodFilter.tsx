'use client';

import { type Period, type DateRange, PERIOD_OPTIONS, periodDates, today, monthStart } from '@/lib/report-format';

interface Props {
  period: Period;
  from: string;
  to: string;
  onChange: (period: Period, range: DateRange) => void;
  className?: string;
}

export default function PeriodFilter({ period, from, to, onChange, className = '' }: Props) {
  function select(p: Period) {
    onChange(p, periodDates(p, { from, to }));
  }

  function setFrom(val: string) {
    onChange('custom', { from: val, to });
  }

  function setTo(val: string) {
    onChange('custom', { from, to: val });
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => select(opt.value)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              period === opt.value
                ? 'bg-white text-[#1B4F8A] shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={from}
            max={to}
            onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#1B4F8A]"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#1B4F8A]"
          />
        </div>
      )}
    </div>
  );
}

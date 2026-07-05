'use client';

// DeltaBadge — small ▲/▼ % badge for "vs previous period" comparison on summary cards.
// goodWhenUp: true for revenue-like metrics (green when rising), false for cost-like
// metrics (expenses rising shows red even though the arrow points up).

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function DeltaBadge({
  delta,
  goodWhenUp = true,
  title,
}: {
  delta: number | null;
  goodWhenUp?: boolean;
  title?: string;
}) {
  if (delta === null) {
    return (
      <span title={title ?? 'No data in the previous period to compare against'}
        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
        <Minus className="w-2.5 h-2.5" /> n/a
      </span>
    );
  }
  const up = delta > 0;
  const flat = delta === 0;
  const good = flat ? true : up === goodWhenUp;
  const color = flat
    ? 'text-gray-500 bg-gray-50'
    : good ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50';

  return (
    <span title={title ?? `Change vs the previous period of equal length`}
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      {flat ? <Minus className="w-2.5 h-2.5" /> : up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{delta}%
    </span>
  );
}

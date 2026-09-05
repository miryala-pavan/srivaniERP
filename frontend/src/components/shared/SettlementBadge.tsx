const LABELS: Record<string, { pending: string; settled: string }> = {
  ADJUST_BALANCE: { pending: 'Balance Adjusted', settled: 'Balance Adjusted' },
  REPLACEMENT:    { pending: 'Awaiting Replacement', settled: 'Replacement Received' },
  REFUND:         { pending: 'Awaiting Refund', settled: 'Refunded' },
};

export function SettlementBadge({ type, status }: { type?: string | null; status?: string | null }) {
  const t = type ?? 'ADJUST_BALANCE';
  const isPending = status === 'PENDING' && t !== 'ADJUST_BALANCE';
  const label = LABELS[t]?.[isPending ? 'pending' : 'settled'] ?? t;
  const cls = isPending
    ? 'bg-amber-50 text-amber-700'
    : t === 'ADJUST_BALANCE'
      ? 'bg-gray-100 text-gray-500'
      : 'bg-green-50 text-green-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cls}`}>{label}</span>;
}

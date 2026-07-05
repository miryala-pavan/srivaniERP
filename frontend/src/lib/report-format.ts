// Shared formatters and date helpers for all report pages.
// Import from here instead of defining locally in each report.

export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const inr0 = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtDay = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

export const fmtMonth = (month: number, year: number) => {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

// ─── Date range helpers ──────────────────────────────────────────────────────

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function monthStart(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset, 1);
  return d.toISOString().split('T')[0];
}

export function monthEnd(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset + 1, 0);
  return d.toISOString().split('T')[0];
}

// ─── Period types ────────────────────────────────────────────────────────────

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

export interface DateRange { from: string; to: string; }

export function periodDates(period: Period, custom: DateRange): DateRange {
  switch (period) {
    case 'today':     return { from: today(),       to: today() };
    case 'yesterday': return { from: daysAgo(1),    to: daysAgo(1) };
    case 'week':      return { from: daysAgo(6),    to: today() };
    case 'month':     return { from: monthStart(),  to: today() };
    case 'lastMonth': return { from: monthStart(1), to: monthEnd(1) };
    case 'custom':    return custom;
  }
}

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week',      label: 'This Week' },
  { value: 'month',     label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom',    label: 'Custom' },
];

// ─── Comparison helpers ──────────────────────────────────────────────────────

/** The equal-length window immediately before the given range (for "vs previous period"). */
export function prevRange(range: DateRange): DateRange {
  const from = new Date(range.from + 'T00:00:00');
  const to   = new Date(range.to   + 'T00:00:00');
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo   = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(prevFrom), to: iso(prevTo) };
}

/** % change from prev to curr; null when prev is 0/absent (no meaningful base). */
export function pctDelta(curr: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

// ─── Excel blob download ─────────────────────────────────────────────────────

export async function downloadExcel(
  apiGet: (url: string, cfg: any) => Promise<any>,
  url: string,
  params: object,
  filename: string,
) {
  const res = await apiGet(url, { params, responseType: 'blob' });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

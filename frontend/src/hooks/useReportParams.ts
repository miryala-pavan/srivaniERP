'use client';

// Syncs report filter state to the browser URL without triggering a full
// Next.js navigation. This makes reports shareable and browser-back safe.
// Uses window.history.replaceState so no Suspense wrapper is needed.

export function useReportParams() {
  function get(key: string, fallback = ''): string {
    if (typeof window === 'undefined') return fallback;
    return new URLSearchParams(window.location.search).get(key) ?? fallback;
  }

  function getAll(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const out: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => { out[k] = v; });
    return out;
  }

  function set(updates: Record<string, string | null>) {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    });
    const qs = sp.toString();
    window.history.replaceState(
      {},
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }

  return { get, getAll, set };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function elapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60)  return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function useLastUpdated(autoRefreshMs = 0) {
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [label, setLabel]               = useState('');
  const [refreshKey, setRefreshKey]     = useState(0);
  const labelTimer                      = useRef<ReturnType<typeof setInterval>>();

  // Recompute the "X min ago" label every 30 seconds
  useEffect(() => {
    function tick() {
      if (!lastUpdated) { setLabel(''); return; }
      setLabel(elapsed(Date.now() - lastUpdated.getTime()));
    }
    tick();
    labelTimer.current = setInterval(tick, 30_000);
    return () => clearInterval(labelTimer.current);
  }, [lastUpdated]);

  // Optional auto-refresh on interval
  useEffect(() => {
    if (!autoRefreshMs) return;
    const id = setInterval(() => setRefreshKey((k) => k + 1), autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs]);

  const markUpdated = useCallback(() => setLastUpdated(new Date()), []);
  const refresh     = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { lastUpdated, label, refreshKey, markUpdated, refresh };
}

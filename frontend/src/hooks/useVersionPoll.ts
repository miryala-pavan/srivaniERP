'use client';

import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// Health endpoint lives on the backend, same origin as API calls
const HEALTH_URL = `${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001').replace(/\/api\/?$/, '')}/api/health`;

export function useVersionPoll() {
  const baseline  = useRef<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res  = await fetch(HEALTH_URL, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const v: string = data.version ?? '';
        if (!v) return;

        if (baseline.current === null) {
          baseline.current = v;
        } else if (baseline.current !== v) {
          setUpdateAvailable(true);
        }
      } catch {
        // Network error or backend unreachable — ignore silently
      }
    }

    check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  function dismiss() { setUpdateAvailable(false); }

  return { updateAvailable, dismiss };
}

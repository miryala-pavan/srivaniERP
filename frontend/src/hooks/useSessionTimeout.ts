import { useCallback, useEffect, useRef, useState } from 'react';
import { logout } from '@/lib/auth';

const WARNING_MS = 5 * 60 * 1000; // warn 5 min before timeout

export function useSessionTimeout(
  timeoutMs: number, // 0 = disabled / unlimited
  onTimeout?: () => void,
): { showWarning: boolean } {
  const [showWarning, setShowWarning] = useState(false);
  const timerRef     = useRef<ReturnType<typeof setTimeout>>();
  const warnRef      = useRef<ReturnType<typeof setTimeout>>();
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const enabled = timeoutMs > 0;

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    setShowWarning(false);

    if (timeoutMs > WARNING_MS) {
      warnRef.current = setTimeout(() => setShowWarning(true), timeoutMs - WARNING_MS);
    }
    timerRef.current = setTimeout(() => {
      if (onTimeoutRef.current) {
        onTimeoutRef.current();
      } else {
        logout();
      }
    }, timeoutMs);
  }, [enabled, timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      setShowWarning(false);
      return;
    }

    const events = [
      'mousedown', 'mousemove', 'keypress',
      'scroll', 'touchstart', 'click', 'keydown',
    ];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [enabled, resetTimer]);

  return { showWarning };
}

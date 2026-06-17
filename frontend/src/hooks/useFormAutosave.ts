'use client';

import { useEffect, useRef } from 'react';

const EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

interface SavedEntry<T> {
  data: T;
  savedAt: number;
}

function hasAnyValue(obj: object): boolean {
  return Object.values(obj).some((v) => {
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'boolean') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === 'object') return hasAnyValue(v as object);
    return false;
  });
}

export function useFormAutosave<T extends object>(
  key: string,
  data: T,
  options?: { enabled?: boolean; delay?: number },
) {
  const enabled    = options?.enabled ?? true;
  const delay      = options?.delay ?? 30_000;
  const storageKey = `form_autosave_${key}`;
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef    = useRef(data);

  dataRef.current = data;

  useEffect(() => {
    if (!enabled) {
      (window as any).__erpHasUnsavedChanges = false;
      return;
    }

    if (hasAnyValue(dataRef.current)) {
      (window as any).__erpHasUnsavedChanges = true;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!hasAnyValue(dataRef.current)) return;
      const entry: SavedEntry<T> = { data: dataRef.current, savedAt: Date.now() };
      try {
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch {
        // storage full or unavailable — silently skip
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      (window as any).__erpHasUnsavedChanges = false;
    };
  }, [data, enabled, delay, storageKey]);

  function getSaved(): SavedEntry<T> | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const entry = JSON.parse(raw) as SavedEntry<T>;
      if (Date.now() - entry.savedAt > EXPIRY_MS) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  function clearSaved() {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }

  function hasSaved(): boolean {
    return getSaved() !== null;
  }

  return { getSaved, clearSaved, hasSaved };
}

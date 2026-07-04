'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type PopupEntityType = 'product' | 'grn' | 'supplier';

export interface PopupEntry {
  type: PopupEntityType;
  id: string;
  label: string;
}

interface PopupContextValue {
  stack: PopupEntry[];
  push: (entry: PopupEntry) => void;
  pop: () => void;
  popAll: () => void;
  top: PopupEntry | null;
}

const PopupContext = createContext<PopupContextValue | null>(null);

export function PopupProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<PopupEntry[]>([]);

  const push = useCallback((entry: PopupEntry) => {
    setStack(prev => {
      // Already showing this entity — no-op
      if (prev.length > 0 && prev[prev.length - 1].id === entry.id) return prev;
      // At the 2-level limit: replace the top, keep the base
      if (prev.length >= 2) return [prev[0], entry];
      return [...prev, entry];
    });
  }, []);

  const pop = useCallback(() => setStack(prev => prev.slice(0, -1)), []);
  const popAll = useCallback(() => setStack([]), []);

  // Escape key closes top popup
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') pop();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pop]);

  const top = stack.length > 0 ? stack[stack.length - 1] : null;

  return (
    <PopupContext.Provider value={{ stack, push, pop, popAll, top }}>
      {children}
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const ctx = useContext(PopupContext);
  if (!ctx) throw new Error('usePopup must be used within PopupProvider');
  return ctx;
}

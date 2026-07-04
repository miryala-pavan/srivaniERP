'use client';

import { useState, useCallback } from 'react';

export function useColumnToggle(allColumns: string[], defaultHidden: string[] = []) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(defaultHidden));

  const isVisible  = useCallback((col: string) => !hidden.has(col), [hidden]);
  const visible    = allColumns.filter(c => !hidden.has(c));

  const toggle = useCallback((col: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  }, []);

  const showAll = useCallback(() => setHidden(new Set()), []);

  return { isVisible, visible, toggle, showAll, hidden };
}

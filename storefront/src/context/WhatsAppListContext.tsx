'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface ListItem {
  code: string;
  name: string;
  packLabel: string;
  sellingPrice: number;
  qty: number;
  imageUrl?: string | null;
}

interface WhatsAppListCtx {
  items: ListItem[];
  addItem: (item: Omit<ListItem, 'qty'>) => void;
  removeItem: (code: string) => void;
  updateQty: (code: string, qty: number) => void;
  clearAll: () => void;
  has: (code: string) => boolean;
}

const Ctx = createContext<WhatsAppListCtx | null>(null);

const LS_KEY = 'svn_wa_list';

function load(): ListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ListItem[]) : [];
  } catch { return []; }
}

export function WhatsAppListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Don't persist until the initial load-from-storage above has run —
    // otherwise this effect can fire first (with the empty initial state)
    // and clobber the real list before it's ever read back.
    if (!hydrated) return;
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<ListItem, 'qty'>) => {
    setItems(prev => {
      if (prev.some(i => i.code === item.code)) return prev;
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((code: string) => {
    setItems(prev => prev.filter(i => i.code !== code));
  }, []);

  const updateQty = useCallback((code: string, qty: number) => {
    setItems(prev =>
      prev.map(i => (i.code === code ? { ...i, qty: Math.max(1, qty) } : i)),
    );
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const has = useCallback((code: string) => items.some(i => i.code === code), [items]);

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clearAll, has }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWhatsAppList() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWhatsAppList must be used inside WhatsAppListProvider');
  return ctx;
}

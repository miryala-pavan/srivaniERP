'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface CartItem {
  code: string;        // pluBarcode — unique key per pack
  name: string;
  packLabel: string;
  sellingPrice: number;
  qty: number;
  imageUrl?: string | null;
}

interface CartCtx {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (code: string) => void;
  updateQty: (code: string, qty: number) => void;
  clearAll: () => void;
  has: (code: string) => boolean;
  totalItems: number;   // sum of all qtys
  subtotal: number;     // sum of price × qty
}

const Ctx = createContext<CartCtx | null>(null);

const LS_KEY = 'svn_cart';

function load(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as CartItem[];
    // one-time migration from the old WA list key
    const legacy = localStorage.getItem('svn_wa_list');
    if (legacy) return JSON.parse(legacy) as CartItem[];
    return [];
  } catch { return []; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => { setItems(load()); }, []);
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(items)); }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'qty'>) => {
    setItems(prev => {
      if (prev.some(i => i.code === item.code)) return prev;
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((code: string) => {
    setItems(prev => prev.filter(i => i.code !== code));
  }, []);

  const updateQty = useCallback((code: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.code !== code));
      return;
    }
    setItems(prev => prev.map(i => i.code === code ? { ...i, qty } : i));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);
  const has = useCallback((code: string) => items.some(i => i.code === code), [items]);
  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const subtotal   = items.reduce((s, i) => s + i.sellingPrice * i.qty, 0);

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clearAll, has, totalItems, subtotal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

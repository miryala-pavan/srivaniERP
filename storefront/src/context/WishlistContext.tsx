'use client';

import {
  createContext, useCallback, useContext,
  useEffect, useState, type ReactNode,
} from 'react';

export interface WishlistItem {
  code: string;
  name: string;
  imageUrl?: string | null;
  fromPrice: number;
  categoryName?: string;
}

interface WishlistCtx {
  items: WishlistItem[];
  toggle: (item: WishlistItem) => void;
  has: (code: string) => boolean;
  count: number;
}

const Ctx = createContext<WishlistCtx | null>(null);
const LS_KEY = 'svn_wishlist';

function load(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); }
  catch { return []; }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => { setItems(load()); }, []);
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(items)); }, [items]);

  const toggle = useCallback((item: WishlistItem) => {
    setItems(prev =>
      prev.some(i => i.code === item.code)
        ? prev.filter(i => i.code !== item.code)
        : [...prev, item],
    );
  }, []);

  const has = useCallback((code: string) => items.some(i => i.code === code), [items]);

  return (
    <Ctx.Provider value={{ items, toggle, has, count: items.length }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}

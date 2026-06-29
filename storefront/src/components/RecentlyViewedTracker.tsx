'use client';

import { useEffect } from 'react';

export interface RecentProduct {
  code: string;
  name: string;
  imageUrl: string | null;
  fromPrice: number;
  categoryName: string | null;
  viewedAt: number; // epoch ms
}

const LS_KEY = 'svn_recently_viewed';
const MAX_ITEMS = 10;

export function saveRecentlyViewed(product: Omit<RecentProduct, 'viewedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list: RecentProduct[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(p => p.code !== product.code);
    filtered.unshift({ ...product, viewedAt: Date.now() });
    localStorage.setItem(LS_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch { /* ignore */ }
}

export function loadRecentlyViewed(): RecentProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

interface Props {
  code: string;
  name: string;
  imageUrl: string | null;
  fromPrice: number;
  categoryName: string | null;
}

export default function RecentlyViewedTracker({ code, name, imageUrl, fromPrice, categoryName }: Props) {
  useEffect(() => {
    saveRecentlyViewed({ code, name, imageUrl, fromPrice, categoryName });
  }, [code, name, imageUrl, fromPrice, categoryName]);

  return null;
}

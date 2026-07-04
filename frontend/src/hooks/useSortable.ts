'use client';

import { useState, useMemo } from 'react';

export type SortDir = 'asc' | 'desc';

export function useSortable<T>(
  data: T[],
  defaultSort?: keyof T,
  defaultDir: SortDir = 'asc',
) {
  const [sort, setSort]   = useState<keyof T | null>(defaultSort ?? null);
  const [dir,  setDir]    = useState<SortDir>(defaultDir);

  function handleSort(col: keyof T) {
    if (sort === col) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setDir('asc'); }
  }

  const sorted = useMemo(() => {
    if (!sort) return data;
    return [...data].sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === 'number' && typeof bv === 'number')
        return dir === 'asc' ? av - bv : bv - av;
      return dir === 'asc'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''));
    });
  }, [data, sort, dir]);

  return { sorted, sort, dir, handleSort };
}

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

interface StoreConfigCtx {
  /** True when the admin has switched the store to browse-only mode —
   *  prices hidden, cart/checkout/WhatsApp ordering all disabled. */
  catalogueMode: boolean;
  /** False until the first fetch resolves. Defaults catalogueMode to
   *  false during this window so the common case (shopping enabled)
   *  never flashes a hidden-price state. */
  loaded: boolean;
}

const Ctx = createContext<StoreConfigCtx>({ catalogueMode: false, loaded: false });

export function StoreConfigProvider({ children }: { children: ReactNode }) {
  const [catalogueMode, setCatalogueMode] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/shop/store-config`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        setCatalogueMode(!!data?.catalogueMode);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  return <Ctx.Provider value={{ catalogueMode, loaded }}>{children}</Ctx.Provider>;
}

export function useStoreConfig(): StoreConfigCtx {
  return useContext(Ctx);
}

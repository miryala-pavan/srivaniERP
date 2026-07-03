'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { findEntry } from '@/lib/help-content';

interface AssistantCtx {
  isOpen:       boolean;
  open:         () => void;
  close:        () => void;
  toggle:       () => void;
  hasContent:   boolean;  // current page has a help entry
  hasNewContent: boolean; // help entry exists and user hasn't read this version yet
}

const Ctx = createContext<AssistantCtx>({
  isOpen: false, open: () => {}, close: () => {}, toggle: () => {},
  hasContent: false, hasNewContent: false,
});

export function useAssistant() { return useContext(Ctx); }

const SEEN_PREFIX = 'erp_assist_seen_';

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);
  const pathname = usePathname() ?? '';
  const entry    = findEntry(pathname);
  const hasContent = !!entry;

  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  // Recompute "new" flag whenever route changes
  useEffect(() => {
    if (!entry || typeof window === 'undefined') { setHasNewContent(false); return; }
    const seen = localStorage.getItem(`${SEEN_PREFIX}${entry.id}`);
    setHasNewContent(seen !== entry.version);
  }, [entry?.id, entry?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear "new" flag when drawer opens
  useEffect(() => {
    if (isOpen && entry && typeof window !== 'undefined') {
      localStorage.setItem(`${SEEN_PREFIX}${entry.id}`, entry.version);
      setHasNewContent(false);
    }
  }, [isOpen, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to the erp:help CustomEvent already dispatched by layout.tsx on ?
  useEffect(() => {
    window.addEventListener('erp:help', toggle as EventListener);
    return () => window.removeEventListener('erp:help', toggle as EventListener);
  }, [toggle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <Ctx.Provider value={{ isOpen, open, close, toggle, hasContent, hasNewContent }}>
      {children}
    </Ctx.Provider>
  );
}

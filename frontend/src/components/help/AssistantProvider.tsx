'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AssistantCtx {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
}

const Ctx = createContext<AssistantCtx>({
  isOpen: false, open: () => {}, close: () => {}, toggle: () => {},
});

export function useAssistant() { return useContext(Ctx); }

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

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
    <Ctx.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

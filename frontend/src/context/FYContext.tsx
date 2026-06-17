'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

interface FY {
  id: string;
  fyCode: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
}

interface FYContextValue {
  activeFY:    FY | null;   // The currently OPEN year (business is operating in this)
  selectedFY:  FY | null;   // The year the user is VIEWING (may differ for historical browsing)
  allFYs:      FY[];
  isHistorical: boolean;     // true when viewing a past/different year
  setSelectedFY: (fy: FY) => void;
  resetToActive: () => void;
  reload:      () => void;
}

const FYContext = createContext<FYContextValue>({
  activeFY:    null,
  selectedFY:  null,
  allFYs:      [],
  isHistorical: false,
  setSelectedFY: () => {},
  resetToActive: () => {},
  reload:      () => {},
});

export function FYProvider({ children }: { children: ReactNode }) {
  const [activeFY,   setActiveFY]   = useState<FY | null>(null);
  const [selectedFY, setSelectedFYState] = useState<FY | null>(null);
  const [allFYs,     setAllFYs]     = useState<FY[]>([]);

  async function load() {
    try {
      const res = await api.get('/financial-year');
      const fys: FY[] = res.data;
      setAllFYs(fys);

      const active = fys.find(f => f.isActive && !f.isClosed) ?? fys[0] ?? null;
      setActiveFY(active);

      // Restore previously selected FY from localStorage (for historical viewing)
      const saved = localStorage.getItem('selectedFyId');
      const restored = saved ? fys.find(f => f.id === saved) : null;
      setSelectedFYState(restored ?? active);
    } catch {
      // Not logged in yet — ignore
    }
  }

  useEffect(() => { load(); }, []);

  function setSelectedFY(fy: FY) {
    setSelectedFYState(fy);
    localStorage.setItem('selectedFyId', fy.id);
  }

  function resetToActive() {
    if (activeFY) {
      setSelectedFYState(activeFY);
      localStorage.removeItem('selectedFyId');
    }
  }

  const isHistorical = !!(selectedFY && activeFY && selectedFY.id !== activeFY.id);

  return (
    <FYContext.Provider value={{ activeFY, selectedFY, allFYs, isHistorical, setSelectedFY, resetToActive, reload: load }}>
      {children}
    </FYContext.Provider>
  );
}

export function useFY() { return useContext(FYContext); }

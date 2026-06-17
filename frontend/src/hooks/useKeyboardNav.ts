import { useCallback } from 'react';

interface UseKeyboardNavOptions {
  count: number;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onSelect: (i: number) => void;
  onClose?: () => void;
}

export function useKeyboardNav({
  count,
  activeIndex,
  setActiveIndex,
  onSelect,
  onClose,
}: UseKeyboardNavOptions) {
  return useCallback(
    (e: React.KeyboardEvent) => {
      if (count === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(activeIndex < count - 1 ? activeIndex + 1 : 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(activeIndex > 0 ? activeIndex - 1 : count - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0) onSelect(activeIndex);
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    },
    [count, activeIndex, setActiveIndex, onSelect, onClose],
  );
}

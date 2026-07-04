'use client';

import { usePopup } from '@/context/PopupContext';

interface Props {
  id: string;
  name: string;
  className?: string;
}

export function LinkedProduct({ id, name, className = '' }: Props) {
  const { push } = usePopup();

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click → new tab (let default anchor handle it, but we need to open it)
      window.open(`/dashboard/products/${id}`, '_blank');
      e.preventDefault();
      return;
    }
    e.preventDefault();
    push({ type: 'product', id, label: name });
  }

  return (
    <a
      href={`/dashboard/products/${id}`}
      onClick={handleClick}
      className={`text-[#1B4F8A] hover:underline cursor-pointer ${className}`}
      title="Click to preview · Ctrl+click to open"
    >
      {name}
    </a>
  );
}

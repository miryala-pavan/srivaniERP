'use client';

import { usePopup } from '@/context/PopupContext';

interface Props {
  id: string;
  name: string;
  className?: string;
}

export function LinkedSupplier({ id, name, className = '' }: Props) {
  const { push } = usePopup();

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      window.open(`/dashboard/suppliers/${id}`, '_blank');
      e.preventDefault();
      return;
    }
    e.preventDefault();
    push({ type: 'supplier', id, label: name });
  }

  return (
    <a
      href={`/dashboard/suppliers/${id}`}
      onClick={handleClick}
      className={`text-[#1B4F8A] hover:underline cursor-pointer ${className}`}
      title="Click to preview · Ctrl+click to open"
    >
      {name}
    </a>
  );
}

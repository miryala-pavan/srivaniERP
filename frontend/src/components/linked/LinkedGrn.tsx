'use client';

import { usePopup } from '@/context/PopupContext';

interface Props {
  id: string;
  label: string; // grnNumber or invoiceNumber
  className?: string;
}

export function LinkedGrn({ id, label, className = '' }: Props) {
  const { push } = usePopup();

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      window.open(`/dashboard/grn/${id}`, '_blank');
      e.preventDefault();
      return;
    }
    e.preventDefault();
    push({ type: 'grn', id, label });
  }

  return (
    <a
      href={`/dashboard/grn/${id}`}
      onClick={handleClick}
      className={`text-[#1B4F8A] hover:underline cursor-pointer font-mono text-sm ${className}`}
      title="Click to preview · Ctrl+click to open"
    >
      {label}
    </a>
  );
}

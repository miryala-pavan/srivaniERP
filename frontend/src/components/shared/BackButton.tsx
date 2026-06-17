'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function BackButton({
  fallbackHref = '/dashboard',
  className = '',
}: {
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className={`inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 ${className}`}
      aria-label="Back"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
}

'use client';

import { RefreshCw } from 'lucide-react';

interface Props {
  label: string;       // "Updated 3m ago" | ""
  loading?: boolean;
  onRefresh: () => void;
  className?: string;
}

export function RefreshBar({ label, loading = false, onRefresh, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-xs text-gray-400">
          Updated {label}
        </span>
      )}
      <button
        onClick={onRefresh}
        disabled={loading}
        title="Refresh data"
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

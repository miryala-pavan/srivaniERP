'use client';

import { RefreshCw, Zap } from 'lucide-react';

interface Props {
  onDismiss: () => void;
}

export function UpdateBanner({ onDismiss }: Props) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1B4F8A] text-white text-sm px-5 py-3 rounded-xl shadow-2xl border border-blue-400/40 animate-in slide-in-from-bottom-4">
      <Zap className="w-4 h-4 text-yellow-300 shrink-0" />
      <span>A new version is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3 py-1 bg-white text-[#1B4F8A] font-semibold rounded-lg hover:bg-blue-50 transition-colors text-xs"
      >
        <RefreshCw className="w-3 h-3" />
        Refresh now
      </button>
      <button
        onClick={onDismiss}
        className="text-blue-300 hover:text-white text-xs ml-1"
      >
        Later
      </button>
    </div>
  );
}

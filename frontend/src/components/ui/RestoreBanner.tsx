'use client';

interface RestoreBannerProps {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

function timeAgo(ts: number): string {
  const diffMs  = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

export function RestoreBanner({ savedAt, onRestore, onDiscard }: RestoreBannerProps) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span className="flex-1">
        Unsaved form data found from {timeAgo(savedAt)}.
      </span>
      <button
        type="button"
        onClick={onRestore}
        className="font-semibold underline underline-offset-2 hover:text-amber-900"
      >
        Restore
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="text-amber-600 hover:text-amber-800"
      >
        Discard
      </button>
    </div>
  );
}

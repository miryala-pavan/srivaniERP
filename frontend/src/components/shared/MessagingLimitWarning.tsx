'use client';

import { AlertTriangle } from 'lucide-react';
import type { MessagingLimits } from '@/lib/waMessagingLimits';

/** Warns before a bulk/broadcast send exceeds Meta's current 24-hour messaging-tier cap for this WhatsApp number. */
export function MessagingLimitWarning({ count, limits }: { count: number; limits: MessagingLimits | null }) {
  if (!limits?.limit || count <= limits.limit) return null;
  return (
    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <span>
        Sending to <strong>{count.toLocaleString('en-IN')}</strong> customers — above your WhatsApp account&apos;s current 24-hour limit of{' '}
        <strong>{limits.limit.toLocaleString('en-IN')}</strong>
        {limits.qualityRating ? ` (quality rating: ${limits.qualityRating})` : ''}. Sends beyond the limit will likely fail — consider smaller batches.
      </span>
    </div>
  );
}

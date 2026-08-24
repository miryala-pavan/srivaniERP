import api from '@/lib/api';

// Must match PERSONALIZE_NAME_TOKEN in backend/src/notifications/whatsapp.service.ts —
// sent as a literal template param value, substituted server-side per recipient.
export const PERSONALIZE_NAME_TOKEN = '{{customer.name}}';

export interface MessagingLimits {
  qualityRating: string | null;
  tier: string | null;
  limit: number | null;
}

export const TIER_LABELS: Record<string, string> = {
  TIER_50: '50/24h',
  TIER_250: '250/24h',
  TIER_1K: '1,000/24h',
  TIER_10K: '10,000/24h',
  TIER_100K: '100,000/24h',
};

export async function fetchMessagingLimits(): Promise<MessagingLimits | null> {
  try {
    const { data } = await api.get('/notifications/whatsapp/messaging-limits');
    if (!data || data.error) return null;
    return data as MessagingLimits;
  } catch {
    return null;
  }
}

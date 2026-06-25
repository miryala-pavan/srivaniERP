'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

const DISMISS_KEY = 'gst_health_banner_dismissed';

export function GstHealthBanner() {
  const router  = useRouter();
  const [mounted, setMounted]     = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const ts = sessionStorage.getItem(DISMISS_KEY);
      if (ts) setDismissed(true);
    } catch {}
  }, []);

  const user = mounted ? getUser<{ role: string }>() : null;
  const role = user?.role ?? '';
  const canSee = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'].includes(role);

  const { data } = useQuery({
    queryKey: ['gst-health-banner'],
    queryFn:  async () => {
      const { data } = await api.get('/reports/gst-health');
      return data as { summary: { criticalCount: number; highCount: number } };
    },
    enabled:   mounted && canSee && !dismissed,
    staleTime: 30 * 60 * 1000,
    retry:     false,
  });

  if (!mounted || !canSee || dismissed) return null;
  if (!data) return null;

  const { criticalCount, highCount } = data.summary;
  if (criticalCount === 0 && highCount === 0) return null;

  const isCritical = criticalCount > 0;
  const label = [
    criticalCount > 0 ? `${criticalCount} critical` : '',
    highCount     > 0 ? `${highCount} high-risk` : '',
  ].filter(Boolean).join(', ');

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  }

  return (
    <div className={`flex items-center justify-between px-6 py-1.5 text-xs text-white ${isCritical ? 'bg-red-600' : 'bg-orange-500'}`}>
      <span className="flex items-center gap-2">
        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
        <strong>GST Alert:</strong>&nbsp;{label} issue{(criticalCount + highCount) > 1 ? 's' : ''} found that need your attention before next filing.
      </span>
      <div className="flex items-center gap-4 ml-4">
        <button
          onClick={() => router.push('/dashboard/reports/gst-health')}
          className="font-semibold underline underline-offset-2 hover:opacity-80 whitespace-nowrap"
        >
          View GST Health →
        </button>
        <button onClick={dismiss} className="hover:opacity-80">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

const dismissKey = (period: string) => `gst_2b_reminder_dismissed:${period}`;

// Monthly nudge to download GSTR-2B from the GST portal and upload it for
// reconciliation. The portal generates the 2B on the 14th; this shows from the
// 15th until a reconciliation run has been uploaded, and stays dismissed for
// that return period once closed (it comes back next month).
export function Gst2bReminderBanner() {
  const router = useRouter();
  const [mounted, setMounted]     = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const user   = mounted ? getUser<{ role: string }>() : null;
  const canSee = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'].includes(user?.role ?? '');

  const { data } = useQuery({
    queryKey: ['gst-2b-reminder'],
    queryFn: async () => {
      const { data } = await api.get('/reports/gst/2b-reminder');
      return data as { due: boolean; periodLabel: string | null };
    },
    enabled:   mounted && canSee,
    staleTime: 60 * 60 * 1000,
    retry:     false,
  });

  useEffect(() => {
    if (!data?.periodLabel) return;
    try { setDismissed(localStorage.getItem(dismissKey(data.periodLabel))); } catch {}
  }, [data?.periodLabel]);

  if (!mounted || !canSee || !data?.due || !data.periodLabel || dismissed) return null;
  const period = data.periodLabel;

  function dismiss() {
    try { localStorage.setItem(dismissKey(period), '1'); } catch {}
    setDismissed('1');
  }

  return (
    <div className="flex items-center justify-between px-6 py-1.5 text-xs text-white bg-blue-600">
      <span
        className="flex items-center gap-2"
        title="The GST portal generates GSTR-2B for a return period on the 14th of the next month. Download it (JSON or Excel) from Returns Dashboard → GSTR-2B, then upload it here to match it against your purchases and see which input tax credit is safe to claim in GSTR-3B."
      >
        <FileDown className="w-3.5 h-3.5 flex-shrink-0" />
        <strong>GSTR-2B ready:</strong>&nbsp;the {period} GSTR-2B is now on the GST portal. Download it and upload it here to check your input tax credit.
      </span>
      <div className="flex items-center gap-4 ml-4">
        <button
          onClick={() => router.push('/dashboard/reports/gst-reconciliation')}
          className="font-semibold underline underline-offset-2 hover:opacity-80 whitespace-nowrap"
        >
          Upload GSTR-2B →
        </button>
        <button onClick={dismiss} className="hover:opacity-80" title="Hide until next month's reminder">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

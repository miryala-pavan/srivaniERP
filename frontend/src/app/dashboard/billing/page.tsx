'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, CalendarClock, Sparkles, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { fmtDate } from '@/lib/report-format';

interface PlanInfo {
  plan: string;
  planStatus: string;
  planStartedAt?: string;
  planExpiresAt: string | null;
  trialEndsAt?: string | null;
  onboardingStatus?: string;
  daysLeft?: number | null;
  note?: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  ACTIVE:    { badge: 'bg-green-100 text-green-700',  label: 'Active' },
  TRIAL:     { badge: 'bg-blue-100 text-blue-700',    label: 'Trial' },
  EXPIRED:   { badge: 'bg-red-100 text-red-600',      label: 'Expired' },
  SUSPENDED: { badge: 'bg-amber-100 text-amber-700',  label: 'Suspended' },
  CANCELLED: { badge: 'bg-gray-100 text-gray-500',    label: 'Cancelled' },
};

export default function BillingPage() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PlanInfo>('/billing/plan')
      .then(r => setInfo(r.data))
      .catch(err => toast.error(getErrorMessage(err, 'Failed to load plan')))
      .finally(() => setLoading(false));
  }, []);

  const status = STATUS_STYLE[info?.planStatus ?? 'ACTIVE'] ?? STATUS_STYLE.ACTIVE;
  const expiringSoon = info?.daysLeft != null && info.daysLeft <= 30 && info.daysLeft > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Subscription & Billing" />
      <div className="max-w-3xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Billing' }]} />
        <div className="mt-2 mb-4"><BackButton /></div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">Loading…</div>
        ) : info && (
          <>
            {/* Plan card */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Current Plan</p>
                  <p className="text-3xl font-bold text-[#1B4F8A] mt-1">{info.plan}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${status.badge}`}>{status.label}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                {info.planStartedAt && (
                  <div>
                    <p className="text-xs text-gray-500">Started</p>
                    <p className="text-sm font-medium text-gray-800">{fmtDate(info.planStartedAt)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> Expires
                    <span title="Annual plans renew yearly. No expiry date means a perpetual plan." className="cursor-help text-gray-400">ⓘ</span>
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {info.planExpiresAt ? fmtDate(info.planExpiresAt) : 'Never (perpetual)'}
                    {info.daysLeft != null && info.daysLeft > 0 && (
                      <span className={`ml-2 text-xs ${expiringSoon ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                        {info.daysLeft} days left
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Expiry warning */}
            {expiringSoon && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  Your plan expires in <strong>{info.daysLeft} days</strong>. Renew before expiry to avoid interruption —
                  once expired, access is blocked until renewal (your data stays safe).
                </p>
              </div>
            )}
            {info.planStatus === 'EXPIRED' && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">
                  Your subscription has expired. Contact your platform administrator to renew — all data is preserved
                  and access is restored instantly on renewal.
                </p>
              </div>
            )}

            {/* Explainer */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                <ShieldCheck className="w-4 h-4 text-[#1B4F8A]" /> How subscription works
              </h3>
              <ul className="text-xs text-gray-500 space-y-2 leading-relaxed list-disc pl-4">
                <li><strong>Annual plans</strong> renew yearly; expiry is enforced automatically at the API level.</li>
                <li>On expiry, sign-in is blocked with a renewal notice — <strong>your data is never deleted</strong>.</li>
                <li>Renewal restores access instantly, no re-setup needed.</li>
                <li>{info.note ?? 'Plan upgrades and payment options are managed by your platform administrator.'}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

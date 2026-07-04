'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ExternalLink, Sparkles } from 'lucide-react';

export interface GstinInfo {
  found: boolean;
  gstin: string;
  tradeName?: string;
  legalName?: string;
  taxpayerType?: string;
  status?: string;
  registeredDate?: string;
  stateName?: string;
  stateCode?: string;
  address?: string;
  pincode?: string;
  businessNature?: string;
}

interface Props {
  gstin: string;
  /** Called when user clicks "Auto-fill" — parent fills whatever fields it wants */
  onAutoFill?: (info: GstinInfo) => void;
}

const STATUS_COLOR: Record<string, string> = {
  Active:    'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
  Suspended: 'bg-amber-100 text-amber-700',
};

function buildAddress(addr: Record<string, string>): string {
  return [addr.bno, addr.bnm, addr.flno, addr.st, addr.loc, addr.dst]
    .filter(Boolean).join(', ');
}

export default function GstinVerify({ gstin, onAutoFill }: Props) {
  const [info, setInfo]           = useState<GstinInfo | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [lastGstin, setLastGstin] = useState('');

  // Reset whenever the GSTIN field changes
  if (gstin !== lastGstin) {
    setInfo(null);
    setError(null);
    setLastGstin(gstin);
  }

  async function verify() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      // Call the GST portal directly from the browser — our VPS IP is WAF-blocked by the portal.
      // The user's browser IP is a residential/office IP and goes through fine.
      const res = await fetch(
        `https://services.gst.gov.in/services/api/search/taxpayerDetails?gstin=${gstin}`,
        { headers: { Accept: 'application/json, text/plain, */*' } },
      );

      let body: any = null;
      try { body = await res.json(); } catch { /* non-JSON */ }

      if (!res.ok || body?.errorCode || !body?.taxpayerInfo) {
        setInfo({ found: false, gstin });
        return;
      }

      const t    = body.taxpayerInfo;
      const addr = t.pradr?.addr ?? {};

      setInfo({
        found:          true,
        gstin:          t.gstin       ?? gstin,
        tradeName:      t.tradeNam    ?? '',
        legalName:      t.lgnm        ?? '',
        taxpayerType:   t.dty         ?? '',
        status:         t.sts         ?? '',
        registeredDate: t.rgdt        ?? '',
        stateCode:      gstin.slice(0, 2),
        stateName:      addr.stcd     ?? '',
        address:        buildAddress(addr),
        pincode:        addr.pncd     ?? '',
        businessNature: t.pradr?.ntr  ?? '',
      });
    } catch {
      setError('Could not reach the GST portal — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!gstin || gstin.length !== 15) return null;

  return (
    <div className="mt-1.5 space-y-2">
      {!info && !loading && (
        <button
          type="button"
          onClick={verify}
          className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6b] font-medium transition-colors"
        >
          <ExternalLink size={12} />
          Verify on GST Portal
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          Checking GST portal…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <XCircle size={12} />
          {error}
          <button type="button" onClick={verify} className="underline ml-1">Retry</button>
        </div>
      )}

      {info && !info.found && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <XCircle size={13} />
          GSTIN not found on the GST portal — verify the number is correct.
        </div>
      )}

      {info?.found && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 space-y-2">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-green-600 shrink-0 mt-0.5" />
              <span className="text-xs font-semibold text-gray-800">
                {info.tradeName || info.legalName || 'Verified'}
              </span>
            </div>
            {info.status && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[info.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {info.status}
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
            {info.legalName && info.legalName !== info.tradeName && (
              <><span className="font-medium text-gray-600">Legal Name</span><span>{info.legalName}</span></>
            )}
            {info.taxpayerType && (
              <><span className="font-medium text-gray-600">Type</span><span>{info.taxpayerType}</span></>
            )}
            {info.businessNature && (
              <><span className="font-medium text-gray-600">Nature</span><span>{info.businessNature}</span></>
            )}
            {info.stateName && (
              <><span className="font-medium text-gray-600">State</span><span>{info.stateName}</span></>
            )}
            {info.registeredDate && (
              <><span className="font-medium text-gray-600">Registered</span><span>{info.registeredDate}</span></>
            )}
            {info.address && (
              <>
                <span className="font-medium text-gray-600">Address</span>
                <span>{info.address}{info.pincode ? ` – ${info.pincode}` : ''}</span>
              </>
            )}
          </div>

          {/* Auto-fill button */}
          {onAutoFill && (
            <button
              type="button"
              onClick={() => onAutoFill(info)}
              className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6b] font-medium transition-colors mt-1 pt-1 border-t border-blue-200 w-full"
            >
              <Sparkles size={11} />
              Auto-fill form from GST portal data
            </button>
          )}
        </div>
      )}
    </div>
  );
}

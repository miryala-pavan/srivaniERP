'use client';

import { useEffect, useState } from 'react';
import { Building2, Phone, FileText, BadgeIndianRupee } from 'lucide-react';
import api from '@/lib/api';
import { usePopup } from '@/context/PopupContext';
import { inr, fmtDate } from '@/lib/report-format';

interface SupplierDetail {
  id: string; name: string; gstin?: string | null;
  phone?: string | null; email?: string | null;
  address?: string | null; state?: string | null;
  isActive: boolean;
}
interface BalanceData { balance: number }
interface GrnSummary {
  id: string; grnNumber: string | null; invoiceNumber: string;
  invoiceDate: string; grandTotal: number | string; status: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:            'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED:         'bg-green-100 text-green-700',
  REJECTED:         'bg-red-100 text-red-700',
  CANCELLED:        'bg-gray-100 text-gray-400',
};

export default function SupplierPanel({ id }: { id: string }) {
  const { push } = usePopup();
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [balance,  setBalance]  = useState<number | null>(null);
  const [grns,     setGrns]     = useState<GrnSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');

    Promise.all([
      api.get<SupplierDetail>(`/suppliers/${id}`),
      api.get<BalanceData>(`/suppliers/${id}/balance`).catch(() => null),
      api.get<{ data: GrnSummary[] }>(`/suppliers/${id}/grns`, { params: { limit: 5, status: 'APPROVED' } }).catch(() => null),
    ]).then(([supRes, balRes, grnRes]) => {
      if (cancelled) return;
      setSupplier(supRes.data);
      if (balRes) setBalance(Number(balRes.data.balance));
      if (grnRes) setGrns(grnRes.data?.data ?? []);
    }).catch(() => {
      if (!cancelled) setError('Failed to load supplier');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PanelSkeleton />;
  if (error || !supplier) return <PanelError msg={error || 'Not found'} />;

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-amber-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{supplier.name}</h2>
          {supplier.gstin && <p className="text-sm text-gray-400 font-mono">{supplier.gstin}</p>}
          <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${supplier.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {supplier.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Contact */}
      <Section title="Contact">
        {supplier.phone && (
          <Row icon={<Phone />} label="Phone">
            <a href={`tel:${supplier.phone}`} className="text-sm text-[#1B4F8A] hover:underline">{supplier.phone}</a>
          </Row>
        )}
        {supplier.state && <Row icon={<Building2 />} label="State"><span className="text-sm text-gray-700">{supplier.state}</span></Row>}
        {supplier.address && <Row icon={<Building2 />} label="Address"><span className="text-sm text-gray-700 line-clamp-2">{supplier.address}</span></Row>}
        {!supplier.phone && !supplier.state && !supplier.address && (
          <p className="text-sm text-gray-400">No contact details on file</p>
        )}
      </Section>

      {/* Balance */}
      {balance !== null && (
        <Section title="Balance">
          <div className={`rounded-xl p-4 flex items-center gap-3 ${balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <BadgeIndianRupee className={`w-6 h-6 ${balance > 0 ? 'text-red-500' : 'text-green-600'}`} />
            <div>
              <p className="text-xs text-gray-500">{balance > 0 ? 'Amount Payable' : balance < 0 ? 'Advance / Overpaid' : 'Settled'}</p>
              <p className={`text-xl font-bold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                ₹{inr(Math.abs(balance))}
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* Recent GRNs */}
      {grns.length > 0 && (
        <Section title="Recent GRNs">
          <div className="divide-y divide-gray-50 -mx-1">
            {grns.map(g => (
              <div key={g.id} className="px-1 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <button
                    className="text-sm font-medium text-[#1B4F8A] hover:underline text-left truncate block max-w-[200px]"
                    onClick={() => push({ type: 'grn', id: g.id, label: g.grnNumber ?? g.invoiceNumber })}
                  >
                    {g.grnNumber ?? g.invoiceNumber}
                  </button>
                  <p className="text-xs text-gray-400">
                    {fmtDate(g.invoiceDate)}
                    {' · '}
                    <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[g.status] ?? 'bg-gray-100 text-gray-500'}`}>{g.status}</span>
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-800 flex-shrink-0">₹{inr(Number(g.grandTotal))}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-300 w-3.5 h-3.5 flex-shrink-0 mt-0.5 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
      <span className="text-xs text-gray-500 w-16 flex-shrink-0 mt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg" />)}
    </div>
  );
}

function PanelError({ msg }: { msg: string }) {
  return <div className="p-8 text-center text-sm text-red-500">{msg}</div>;
}

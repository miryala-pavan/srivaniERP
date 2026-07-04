'use client';

import { useEffect, useState } from 'react';
import { FileText, Building2, Calendar, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { usePopup } from '@/context/PopupContext';
import { inr, fmtDate } from '@/lib/report-format';

type GrnStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface GrnItem {
  id: string; productName: string; productCode?: string | null;
  quantity: number | string; unitPrice: number | string;
  totalAmount: number | string; hsnCode?: string | null;
  gstRatePercent: number | string;
  product?: { id?: string };
}

interface GrnDetail {
  id: string; grnNumber: string | null;
  invoiceNumber: string; invoiceDate: string; status: GrnStatus;
  taxableAmount: number | string; totalTaxAmount: number | string;
  grandTotal: number | string;
  supplier: { id: string; name: string; phone?: string | null; gstin?: string | null };
  items: GrnItem[];
  approvedByName?: string | null; approvedAt?: string | null;
  notes?: string | null;
}

const STATUS_CONFIG: Record<GrnStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:            { label: 'Draft',            color: 'bg-gray-100 text-gray-600',  icon: <FileText className="w-3 h-3" /> },
  PENDING_APPROVAL: { label: 'Pending',           color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" /> },
  APPROVED:         { label: 'Approved',          color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  REJECTED:         { label: 'Rejected',          color: 'bg-red-100 text-red-700',    icon: <XCircle className="w-3 h-3" /> },
  CANCELLED:        { label: 'Cancelled',         color: 'bg-gray-100 text-gray-500',  icon: <AlertCircle className="w-3 h-3" /> },
};

export default function GrnPanel({ id }: { id: string }) {
  const { push } = usePopup();
  const [data, setData] = useState<GrnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    api.get<GrnDetail>(`/grn/${id}`)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setError('Failed to load GRN'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PanelSkeleton />;
  if (error || !data) return <PanelError msg={error || 'Not found'} />;

  const st = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.DRAFT;

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-green-700" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{data.grnNumber ?? 'Draft GRN'}</h2>
          <p className="text-sm text-gray-400">Invoice: {data.invoiceNumber}</p>
          <div className="flex gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
              {st.icon}{st.label}
            </span>
          </div>
        </div>
      </div>

      {/* Supplier + date */}
      <Section title="Details">
        <div className="space-y-1">
          <Row
            icon={<Building2 />} label="Supplier"
            value={
              <button
                className="text-[#1B4F8A] hover:underline text-sm font-medium text-left"
                onClick={() => push({ type: 'supplier', id: data.supplier.id, label: data.supplier.name })}
              >
                {data.supplier.name}
              </button>
            }
          />
          {data.supplier.gstin && <Row icon={<Building2 />} label="GSTIN" value={<span className="text-sm font-medium text-gray-800">{data.supplier.gstin}</span>} />}
          <Row icon={<Calendar />} label="Invoice Date" value={<span className="text-sm font-medium text-gray-800">{fmtDate(data.invoiceDate)}</span>} />
          {data.approvedByName && (
            <Row icon={<CheckCircle2 />} label="Approved By" value={<span className="text-sm text-gray-700">{data.approvedByName}</span>} />
          )}
        </div>
      </Section>

      {/* Totals */}
      <Section title="Totals">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-400">Taxable</p>
            <p className="text-sm font-bold text-gray-800">₹{inr(Number(data.taxableAmount))}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-400">Tax</p>
            <p className="text-sm font-bold text-gray-800">₹{inr(Number(data.totalTaxAmount))}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-[#1B4F8A]">Grand Total</p>
            <p className="text-sm font-bold text-[#1B4F8A]">₹{inr(Number(data.grandTotal))}</p>
          </div>
        </div>
      </Section>

      {/* Items */}
      <Section title={`Items (${data.items.length})`}>
        <div className="divide-y divide-gray-50 -mx-1">
          {data.items.map((item, i) => (
            <div key={item.id ?? i} className="px-1 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                <p className="text-xs text-gray-400">
                  {Number(item.quantity)} × ₹{inr(Number(item.unitPrice))}
                  {item.hsnCode ? ` · HSN ${item.hsnCode}` : ''}
                  {Number(item.gstRatePercent) > 0 ? ` · GST ${item.gstRatePercent}%` : ''}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-800 flex-shrink-0">
                ₹{inr(Number(item.totalAmount))}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {data.notes && (
        <Section title="Notes">
          <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-3">{data.notes}</p>
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

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-300 w-3.5 h-3.5 flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className="flex-1 min-w-0">{value}</span>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
    </div>
  );
}

function PanelError({ msg }: { msg: string }) {
  return <div className="p-8 text-center text-sm text-red-500">{msg}</div>;
}

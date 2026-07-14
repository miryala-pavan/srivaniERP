'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Undo2, Ban, Package } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { EntityLink } from '@/components/shared/EntityLink';

const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function DebitNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: dn, isLoading } = useQuery({
    queryKey: ['debit-note', id],
    queryFn: () => api.get(`/grn/debit-notes/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/grn/debit-notes/${id}/cancel`),
    onSuccess: () => {
      toast.success('Debit note cancelled — supplier balance restored');
      qc.invalidateQueries({ queryKey: ['debit-note', id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to cancel debit note'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Debit Note" />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!dn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Debit Note" />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">Debit note not found</div>
      </div>
    );
  }

  const active = dn.status === 'ISSUED';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Debit Note" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center gap-3 flex-wrap">
          <BackButton fallbackHref="/dashboard/suppliers" />
          <span className="text-gray-300">|</span>
          <Breadcrumbs items={[
            { label: 'Suppliers', href: '/dashboard/suppliers' },
            ...(dn.supplier ? [{ label: dn.supplier.name, href: `/dashboard/suppliers/${dn.supplier.id}` }] : []),
            { label: dn.debitNoteNumber },
          ]} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <Undo2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-gray-900 font-mono tracking-tight">{dn.debitNoteNumber}</h1>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {dn.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{fmtDate(dn.debitNoteDate)} · {dn.reason}</p>
              </div>
            </div>
            {active && (
              <button
                onClick={() => { if (confirm(`Cancel debit note ${dn.debitNoteNumber}? This restores Rs. ${inr(n(dn.totalAmount))} to the supplier's outstanding balance.`)) cancelMutation.mutate(); }}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" /> {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Debit Note'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Supplier</p>
            {dn.supplier ? (
              <EntityLink type="supplier" id={dn.supplier.id} className="text-sm font-medium">{dn.supplier.name}</EntityLink>
            ) : <p className="text-sm text-gray-400">—</p>}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Original GRN</p>
            {dn.grn ? (
              <EntityLink type="grn" id={dn.grn.id} className="text-sm font-medium font-mono">
                {dn.grn.grnNumber ?? dn.grn.invoiceNumber}
              </EntityLink>
            ) : <p className="text-sm text-gray-400">Not linked to a GRN</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-gray-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Returned Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left py-2 font-medium">Product</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">GST</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(dn.items ?? []).map((it: any) => (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-800">{it.productName}</td>
                    <td className="py-2.5 text-right text-gray-600">{n(it.quantity)}</td>
                    <td className="py-2.5 text-right text-gray-600">Rs. {inr(n(it.unitPrice))}</td>
                    <td className="py-2.5 text-right text-gray-500 text-xs">{n(it.gstRate)}%</td>
                    <td className="py-2.5 text-right font-medium text-gray-800">Rs. {inr(n(it.totalAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Taxable Amount</dt>
              <dd className="text-gray-800">Rs. {inr(n(dn.taxableAmount))}</dd>
            </div>
            {n(dn.cgstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">CGST</dt>
                <dd className="text-gray-800">Rs. {inr(n(dn.cgstAmount))}</dd>
              </div>
            )}
            {n(dn.sgstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">SGST</dt>
                <dd className="text-gray-800">Rs. {inr(n(dn.sgstAmount))}</dd>
              </div>
            )}
            {n(dn.igstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">IGST</dt>
                <dd className="text-gray-800">Rs. {inr(n(dn.igstAmount))}</dd>
              </div>
            )}
            {n(dn.cessAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Cess</dt>
                <dd className="text-gray-800">Rs. {inr(n(dn.cessAmount))}</dd>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <dt className="text-gray-700 font-medium">Total</dt>
              <dd className="text-gray-900 font-semibold">Rs. {inr(n(dn.totalAmount))}</dd>
            </div>
          </dl>
          {dn.supplierCnNumber && (
            <p className="text-xs text-gray-400 mt-3">Supplier's own reference: {dn.supplierCnNumber}</p>
          )}
          {dn.itcReversal && (
            <p className="text-xs text-amber-600 mt-1">ITC reversal applies to this debit note</p>
          )}
          {dn.notes && (
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">{dn.notes}</p>
          )}
        </div>

      </div>
    </div>
  );
}

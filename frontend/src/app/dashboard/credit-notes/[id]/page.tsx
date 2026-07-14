'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Receipt, Ban, FileText } from 'lucide-react';
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

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: cn, isLoading } = useQuery({
    queryKey: ['credit-note', id],
    queryFn: () => api.get(`/grn/credit-notes/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/grn/credit-notes/${id}/cancel`),
    onSuccess: () => {
      toast.success('Credit note cancelled — supplier balance restored');
      qc.invalidateQueries({ queryKey: ['credit-note', id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to cancel credit note'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Credit Note" />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!cn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Credit Note" />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">Credit note not found</div>
      </div>
    );
  }

  const active = cn.status === 'ACTIVE';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Credit Note" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center gap-3 flex-wrap">
          <BackButton fallbackHref="/dashboard/suppliers" />
          <span className="text-gray-300">|</span>
          <Breadcrumbs items={[
            { label: 'Suppliers', href: '/dashboard/suppliers' },
            ...(cn.supplier ? [{ label: cn.supplier.name, href: `/dashboard/suppliers/${cn.supplier.id}` }] : []),
            { label: cn.scnNumber },
          ]} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-gray-900 font-mono tracking-tight">{cn.scnNumber}</h1>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {cn.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{fmtDate(cn.cnDate)} · {cn.reason}</p>
              </div>
            </div>
            {active && (
              <button
                onClick={() => { if (confirm(`Cancel credit note ${cn.scnNumber}? This restores Rs. ${inr(n(cn.totalAmount))} to the supplier's outstanding balance.`)) cancelMutation.mutate(); }}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" /> {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Credit Note'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Supplier</p>
            {cn.supplier ? (
              <EntityLink type="supplier" id={cn.supplier.id} className="text-sm font-medium">{cn.supplier.name}</EntityLink>
            ) : <p className="text-sm text-gray-400">—</p>}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Original GRN</p>
            {cn.grn ? (
              <EntityLink type="grn" id={cn.grn.id} className="text-sm font-medium font-mono">
                {cn.grn.grnNumber ?? cn.grn.invoiceNumber}
              </EntityLink>
            ) : <p className="text-sm text-gray-400">Not linked to a GRN</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-gray-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Amount Breakdown</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Taxable Amount</dt>
              <dd className="text-gray-800">Rs. {inr(n(cn.taxableAmount))}</dd>
            </div>
            {n(cn.cgstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">CGST</dt>
                <dd className="text-gray-800">Rs. {inr(n(cn.cgstAmount))}</dd>
              </div>
            )}
            {n(cn.sgstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">SGST</dt>
                <dd className="text-gray-800">Rs. {inr(n(cn.sgstAmount))}</dd>
              </div>
            )}
            {n(cn.igstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">IGST</dt>
                <dd className="text-gray-800">Rs. {inr(n(cn.igstAmount))}</dd>
              </div>
            )}
            {n(cn.cessAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Cess</dt>
                <dd className="text-gray-800">Rs. {inr(n(cn.cessAmount))}</dd>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <dt className="text-gray-700 font-medium">Total</dt>
              <dd className="text-gray-900 font-semibold">Rs. {inr(n(cn.totalAmount))}</dd>
            </div>
          </dl>
          {cn.supplierCnNumber && (
            <p className="text-xs text-gray-400 mt-3">Supplier's own reference: {cn.supplierCnNumber}</p>
          )}
          {cn.itcReversal && (
            <p className="text-xs text-amber-600 mt-1">ITC reversal applies to this credit note</p>
          )}
          {cn.notes && (
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">{cn.notes}</p>
          )}
        </div>

      </div>
    </div>
  );
}

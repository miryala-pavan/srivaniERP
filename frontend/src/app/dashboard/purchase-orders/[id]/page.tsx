'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowLeft, Send, MessageCircle, CheckCircle2, XCircle,
  Bot, Package, Edit2, Check, X, ClipboardCheck,
} from 'lucide-react';

interface POItem {
  id: string; productName: string; pluCode: string | null;
  qtyOrdered: number; qtyReceived: number; unitCost: number | null; notes: string | null;
}

interface PO {
  id: string; poNumber: string; supplierName: string; status: string; source: string;
  createdAt: string; sentAt: string | null; expectedDate: string | null;
  createdByName: string | null; notes: string | null;
  supplier: { id: string; name: string; phone: string | null; email: string | null; gstin: string | null };
  items: POItem[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:               'bg-gray-100 text-gray-700',
  SENT:                'bg-blue-100 text-blue-700',
  PARTIALLY_RECEIVED:  'bg-amber-100 text-amber-700',
  RECEIVED:            'bg-green-100 text-green-700',
  CANCELLED:           'bg-red-100 text-red-700',
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [showReceivePanel, setShowReceivePanel] = useState(false);
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate]   = useState(new Date().toISOString().split('T')[0]);

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => api.get(`/purchase-orders/${id}`).then(r => r.data as PO),
  });

  const sendMut = useMutation({
    mutationFn: (via: string) => api.post(`/purchase-orders/${id}/send`, { via }),
    onSuccess: () => { toast.success('PO marked as sent'); qc.invalidateQueries({ queryKey: ['purchase-order', id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const receiveMut = useMutation({
    mutationFn: ({ itemId, qtyReceived }: { itemId: string; qtyReceived: number }) =>
      api.patch(`/purchase-orders/${id}/items/${itemId}/received`, { qtyReceived }),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['purchase-order', id] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setEditingItem(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => { toast.success('PO cancelled'); router.push('/dashboard/purchase-orders'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const createGrnMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/create-grn`, {
      invoiceNumber: invNumber.trim(),
      invoiceDate:   invDate,
    }),
    onSuccess: (res) => {
      toast.success(`GRN ${res.data.grnNumber} created — pending approval`);
      router.push(`/dashboard/grn/${res.data.grnId}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create GRN'),
  });

  async function sendWhatsApp() {
    try {
      const { data } = await api.get(`/purchase-orders/${id}/whatsapp-text`);
      const phone = po?.supplier.phone?.replace(/\D/g, '');
      const url = `https://wa.me/${phone ? '91' + phone : ''}?text=${encodeURIComponent(data.text)}`;
      window.open(url, '_blank');
      await sendMut.mutateAsync('WHATSAPP');
    } catch (e: any) {
      toast.error('Failed to open WhatsApp');
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!po) return <div className="p-8 text-center text-gray-400">PO not found</div>;

  const canSend       = ['DRAFT', 'SENT'].includes(po.status);
  const canReceive    = ['SENT', 'PARTIALLY_RECEIVED'].includes(po.status);
  const canCreateGrn  = !['RECEIVED', 'CANCELLED'].includes(po.status);
  const canCancel     = !['RECEIVED', 'CANCELLED'].includes(po.status);
  const totalItems = po.items.length;
  const doneItems  = po.items.filter(i => Number(i.qtyReceived) >= Number(i.qtyOrdered)).length;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/purchase-orders" className="p-2 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{po.poNumber}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {po.status.replace(/_/g, ' ')}
            </span>
            {po.source === 'AUTO_REORDER' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Auto-generated
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(po.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {po.createdByName && ` · ${po.createdByName}`}
          </p>
        </div>
      </div>

      {/* Actions */}
      {(canSend || canCreateGrn || canCancel) && (
        <div className="flex gap-2 flex-wrap">
          {canSend && (
            <button onClick={sendWhatsApp}
              disabled={sendMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              <MessageCircle className="w-4 h-4" />
              Send via WhatsApp
            </button>
          )}
          {canSend && (
            <button onClick={() => sendMut.mutate('EMAIL')}
              disabled={sendMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Send className="w-4 h-4" />
              Mark as Sent
            </button>
          )}
          {canCreateGrn && (
            <button onClick={() => setShowReceivePanel(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <ClipboardCheck className="w-4 h-4" />
              Receive Goods → GRN
            </button>
          )}
          {canCancel && (
            <button onClick={() => { if (confirm('Cancel this PO?')) cancelMut.mutate(); }}
              disabled={cancelMut.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
              <XCircle className="w-4 h-4" />
              Cancel PO
            </button>
          )}
        </div>
      )}

      {/* Receive Goods panel */}
      {showReceivePanel && canCreateGrn && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-indigo-900 mb-0.5">Create GRN from this PO</h3>
            <p className="text-xs text-indigo-700">
              Items and quantities will be pre-filled from PO. Enter the supplier's invoice details.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Supplier Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={invNumber}
                onChange={e => setInvNumber(e.target.value)}
                placeholder="e.g. INV-2024-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={invDate}
                onChange={e => setInvDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="bg-white border border-indigo-100 rounded-lg px-4 py-3 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700">What gets created:</p>
            <p>• GRN with {po.items.length} item{po.items.length !== 1 ? 's' : ''} pre-filled from this PO</p>
            <p>• Status: Pending Approval — approve to update stock</p>
            <p>• You can adjust quantities and prices on the GRN page</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!invNumber.trim()) { toast.error('Enter supplier invoice number'); return; }
                if (!invDate) { toast.error('Enter invoice date'); return; }
                createGrnMut.mutate();
              }}
              disabled={createGrnMut.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              <ClipboardCheck className="w-4 h-4" />
              {createGrnMut.isPending ? 'Creating…' : 'Create GRN'}
            </button>
            <button
              onClick={() => setShowReceivePanel(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Supplier card */}
      <div className="bg-white border rounded-xl p-4 space-y-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</p>
        <p className="font-semibold text-gray-900">{po.supplier.name}</p>
        {po.supplier.phone && <p className="text-sm text-gray-600">{po.supplier.phone}</p>}
        {po.supplier.gstin && <p className="text-sm text-gray-500">GSTIN: {po.supplier.gstin}</p>}
        {po.expectedDate && (
          <p className="text-sm text-gray-600">
            Expected delivery: <span className="font-medium">{new Date(po.expectedDate).toLocaleDateString('en-IN')}</span>
          </p>
        )}
        {po.sentAt && (
          <p className="text-sm text-gray-500">
            Sent on {new Date(po.sentAt).toLocaleDateString('en-IN')}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {totalItems > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Received</span>
            <span className="text-gray-500">{doneItems} / {totalItems} items</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-500" />
            Items ({po.items.length})
          </h2>
        </div>
        <div className="divide-y">
          {po.items.map(item => {
            const received = Number(item.qtyReceived);
            const ordered  = Number(item.qtyOrdered);
            const done     = received >= ordered;
            const isEditing = editingItem === item.id;

            return (
              <div key={item.id} className={`px-4 py-3 ${done ? 'bg-green-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {done && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                      <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                      {item.pluCode && <span className="text-xs text-gray-400">{item.pluCode}</span>}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>Ordered: <span className="font-medium text-gray-700">{ordered}</span></span>
                      <span>Received: <span className={`font-medium ${done ? 'text-green-700' : received > 0 ? 'text-amber-700' : 'text-gray-700'}`}>{received}</span></span>
                      {item.unitCost && <span>Cost: ₹{Number(item.unitCost).toFixed(2)}</span>}
                    </div>
                  </div>
                  {canReceive && !done && !isEditing && (
                    <button onClick={() => { setEditingItem(item.id); setEditQty(String(ordered)); }}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Qty received:</span>
                    <input type="number" min="0" max={ordered} value={editQty}
                      onChange={e => setEditQty(e.target.value)}
                      className="w-20 px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={() => receiveMut.mutate({ itemId: item.id, qtyReceived: parseFloat(editQty) || 0 })}
                      disabled={receiveMut.isPending}
                      className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingItem(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {po.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <span className="font-medium">Notes: </span>{po.notes}
        </div>
      )}
    </div>
  );
}

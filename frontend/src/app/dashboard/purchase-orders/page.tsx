'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { ShoppingCart, Plus, RefreshCw, Filter, Clock, Send, CheckCircle2, XCircle, PackageCheck, Bot } from 'lucide-react';

interface PO {
  id: string; poNumber: string; supplierName: string; status: string; source: string;
  createdAt: string; sentAt: string | null; expectedDate: string | null;
  supplier: { id: string; name: string; phone: string | null };
  items: { id: string; productName: string; qtyOrdered: number; qtyReceived: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:               'bg-gray-100 text-gray-700',
  SENT:                'bg-blue-100 text-blue-700',
  PARTIALLY_RECEIVED:  'bg-amber-100 text-amber-700',
  RECEIVED:            'bg-green-100 text-green-700',
  CANCELLED:           'bg-red-100 text-red-700',
};

const STATUS_ICON: Record<string, any> = {
  DRAFT:               Clock,
  SENT:                Send,
  PARTIALLY_RECEIVED:  PackageCheck,
  RECEIVED:            CheckCircle2,
  CANCELLED:           XCircle,
};

function statusLabel(s: string) {
  return s.replace('_', ' ').replace('_', ' ');
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const { data: pos = [], isLoading, refetch } = useQuery({
    queryKey: ['purchase-orders', statusFilter, sourceFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      return api.get(`/purchase-orders?${params}`).then(r => r.data as PO[]);
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => { toast.success('PO cancelled'); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const counts = {
    all:    pos.length,
    draft:  pos.filter(p => p.status === 'DRAFT').length,
    sent:   pos.filter(p => p.status === 'SENT').length,
    partial: pos.filter(p => p.status === 'PARTIALLY_RECEIVED').length,
    done:   pos.filter(p => p.status === 'RECEIVED').length,
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-sm text-gray-500">Manual and auto-generated POs from reorder alerts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 text-gray-500 hover:text-gray-700 border rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/dashboard/purchase-orders/new"
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> New PO
          </Link>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: '', label: 'All', count: counts.all },
          { key: 'DRAFT', label: 'Draft', count: counts.draft },
          { key: 'SENT', label: 'Sent', count: counts.sent },
          { key: 'PARTIALLY_RECEIVED', label: 'Partial', count: counts.partial },
          { key: 'RECEIVED', label: 'Received', count: counts.done },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
          </button>
        ))}
        <button onClick={() => setSourceFilter(s => s === 'AUTO_REORDER' ? '' : 'AUTO_REORDER')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            sourceFilter === 'AUTO_REORDER' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}>
          <Bot className="w-3.5 h-3.5" /> Auto-generated
        </button>
      </div>

      {/* PO list */}
      {isLoading && <div className="text-center py-12 text-gray-400">Loading…</div>}
      {!isLoading && pos.length === 0 && (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No purchase orders yet</p>
          <p className="text-sm mt-1">Auto-generated POs appear here when stock drops below reorder level</p>
        </div>
      )}

      <div className="space-y-2">
        {pos.map(po => {
          const Icon = STATUS_ICON[po.status] ?? Clock;
          const totalItems = po.items.length;
          const receivedItems = po.items.filter(i => Number(i.qtyReceived) >= Number(i.qtyOrdered)).length;
          return (
            <div key={po.id} className="bg-white border rounded-xl p-4 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${STATUS_COLORS[po.status]?.replace('text-', 'bg-').replace('bg-', 'bg-').split(' ')[0]} bg-opacity-20`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/dashboard/purchase-orders/${po.id}`}
                        className="font-semibold text-gray-900 hover:text-indigo-600 text-sm">
                        {po.poNumber}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel(po.status)}
                      </span>
                      {po.source === 'AUTO_REORDER' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Bot className="w-3 h-3" /> Auto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{po.supplierName}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                      {po.status !== 'DRAFT' && <span>{receivedItems}/{totalItems} received</span>}
                      <span>{new Date(po.createdAt).toLocaleDateString('en-IN')}</span>
                      {po.expectedDate && <span>Expected: {new Date(po.expectedDate).toLocaleDateString('en-IN')}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Link href={`/dashboard/purchase-orders/${po.id}`}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                    View
                  </Link>
                  {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
                    <button onClick={() => { if (confirm('Cancel this PO?')) cancelMut.mutate(po.id); }}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

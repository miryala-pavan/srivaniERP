'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Truck, AlertTriangle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Tabs } from '@/components/shared/Tabs';
import PlaceSearchBox from '@/components/maps/PlaceSearchBox';

const PinPicker = dynamic(() => import('@/components/maps/PinPicker'), { ssr: false });

type DeliveryStatus = 'BROADCASTING' | 'ASSIGNED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
type TabKey = 'ALL' | DeliveryStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'BROADCASTING', label: 'Broadcasting' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_BADGE: Record<DeliveryStatus, string> = {
  BROADCASTING: 'bg-amber-100 text-amber-700',
  ASSIGNED:     'bg-blue-100 text-blue-700',
  DELIVERED:    'bg-green-100 text-green-700',
  FAILED:       'bg-red-100 text-red-700',
  CANCELLED:    'bg-gray-100 text-gray-500',
};

interface DeliveryRow {
  id: string;
  status: DeliveryStatus;
  createdAt: string;
  deliveryAddressText: string | null;
  codAmount: number | string | null;
  escalatedAt: string | null;
  customer: { name: string; phone: string | null };
  assignedTo: { name: string; phone: string; vehicleNumber: string | null } | null;
}

const DEFAULT_CENTER = { lat: 17.6274, lng: 78.0982 }; // Sangareddy — starting pin, staff drags to the real spot

export default function DeliveriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connected } = useWebSocket();

  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [search, activeTab]);

  function sortArrow(col: string) {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#1B4F8A]" />
      : <ArrowDown className="w-3 h-3 text-[#1B4F8A]" />;
  }
  function toggleSort(col: string) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['deliveries', { tab: activeTab, page, search, sortBy, sortDir }],
    queryFn: async () => {
      const res = await api.get('/deliveries', {
        params: {
          page, limit: 20,
          status: activeTab === 'ALL' ? undefined : activeTab,
          search: search || undefined,
          sortBy, sortDir,
        },
      });
      return res.data as { rows: DeliveryRow[]; total: number; page: number; limit: number };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  useWebSocketEvent('delivery.broadcast', invalidate);
  useWebSocketEvent('delivery.assigned', invalidate);
  useWebSocketEvent('delivery.escalated', invalidate);
  useWebSocketEvent('delivery.delivered', invalidate);
  useWebSocketEvent('delivery.failed', invalidate);
  useWebSocketEvent('delivery.cancelled', invalidate);

  return (
    <>
      <Header
        title="Deliveries"
        actions={
          <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        }
      />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{total} deliver{total === 1 ? 'y' : 'ies'}</span>
          <div className="ml-auto">
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
            >
              <Plus className="w-4 h-4" /> New Delivery
            </button>
          </div>
        </div>

        <Tabs tabs={TABS} active={activeTab} onChange={(t) => setActiveTab(t as TabKey)} variant="pill" />

        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search customer name or phone…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No deliveries found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    <button onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 hover:text-[#1B4F8A]">
                      Date {sortArrow('date')}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    <button onClick={() => toggleSort('customer')} className="inline-flex items-center gap-1 hover:text-[#1B4F8A]">
                      Customer {sortArrow('customer')}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Address</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rider</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    <button onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-[#1B4F8A] mx-auto">
                      Status {sortArrow('status')}
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">COD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/dashboard/deliveries/${d.id}`)}
                    className={`cursor-pointer hover:bg-gray-50 ${d.escalatedAt ? 'bg-red-50/60' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.customer.name}</p>
                      <p className="text-xs text-gray-400">{d.customer.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">{d.deliveryAddressText ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.assignedTo?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[d.status]}`}>
                        {d.escalatedAt && <AlertTriangle className="w-3 h-3" />}
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{d.codAmount != null ? `₹${d.codAmount}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">Prev</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">Next</button>
          </div>
        )}
      </main>

      {showNewModal && (
        <NewDeliveryModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => { setShowNewModal(false); invalidate(); router.push(`/dashboard/deliveries/${id}`); }}
        />
      )}
    </>
  );
}

function NewDeliveryModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  useEscapeKey(onClose, true);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [useManual, setUseManual] = useState(false);

  const [addressText, setAddressText] = useState('');
  const [coords, setCoords] = useState(DEFAULT_CENTER);
  const [codAmount, setCodAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (useManual || !customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(() => {
      api.get('/customers', { params: { search: customerSearch.trim(), limit: 8 } })
        .then((res) => setCustomerResults(res.data?.data ?? []))
        .catch(() => setCustomerResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch, useManual]);

  const createMutation = useMutation({
    mutationFn: () => {
      const base = {
        deliveryLat: coords.lat,
        deliveryLng: coords.lng,
        deliveryAddressText: addressText.trim() || undefined,
        codAmount: codAmount ? Number(codAmount) : undefined,
      };
      const body = selectedCustomer
        ? { ...base, customerId: selectedCustomer.id }
        : { ...base, customerName: manualName.trim(), customerPhone: manualPhone.trim() };
      return api.post('/deliveries', body).then((r) => r.data);
    },
    onSuccess: (delivery) => { toast.success('Delivery broadcast to available riders'); onCreated(delivery.id); },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Could not create delivery'),
  });

  function handleSubmit() {
    setError('');
    if (!selectedCustomer && (!manualName.trim() || !/^[6-9]\d{9}$/.test(manualPhone.trim()))) {
      setError('Pick a customer or enter a valid name + 10-digit phone number');
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Delivery</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</label>
            {!useManual ? (
              <div className="mt-1.5 space-y-1.5">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                    <span className="text-sm font-medium">{selectedCustomer.name}</span>
                    <button onClick={() => setSelectedCustomer(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                  </div>
                ) : (
                  <>
                    <input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by name or phone…"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    />
                    {customerResults.length > 0 && (
                      <div className="border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-100">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerResults([]); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            {c.name} <span className="text-gray-400">— {c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <button onClick={() => setUseManual(true)} className="text-xs text-[#1B4F8A] hover:underline">
                  Customer not found — enter name &amp; phone manually
                </button>
              </div>
            ) : (
              <div className="mt-1.5 space-y-2">
                <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Customer name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
                <input value={manualPhone} onChange={(e) => setManualPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit phone"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
                <button onClick={() => setUseManual(false)} className="text-xs text-gray-400 hover:underline">Search existing customer instead</button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery address (optional note)</label>
            <input value={addressText} onChange={(e) => setAddressText(e.target.value)} placeholder="e.g. Flat 4B, Green Park"
              className="mt-1.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search or drag to set the exact location</label>
            <div className="mt-1.5">
              <PlaceSearchBox onSelect={(r) => { setCoords({ lat: r.lat, lng: r.lng }); if (!addressText) setAddressText(r.label); }} />
            </div>
            <div className="mt-2 h-56 rounded-lg overflow-hidden border border-gray-200">
              <PinPicker lat={coords.lat} lng={coords.lng} onMove={setCoords} label="Delivery location" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">COD amount (leave blank if prepaid)</label>
            <input value={codAmount} onChange={(e) => setCodAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0"
              className="mt-1.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e] disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Broadcast to Riders'}
          </button>
        </div>
      </div>
    </div>
  );
}

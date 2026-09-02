'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, X, Bike, Wallet } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface DeliveryBoy {
  id: string;
  name: string;
  phone: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  status: 'OFFLINE' | 'AVAILABLE' | 'BUSY';
  active: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  BUSY:      'bg-amber-100 text-amber-700',
  OFFLINE:   'bg-gray-100 text-gray-500',
};

export default function DeliveryBoysPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [payoutRider, setPayoutRider] = useState<DeliveryBoy | null>(null);

  const { data: riders, isLoading } = useQuery({
    queryKey: ['delivery-boys'],
    queryFn: () => api.get('/delivery-boys').then((r) => r.data as DeliveryBoy[]),
  });

  return (
    <>
      <Header title="Delivery Boys" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{riders?.length ?? 0} rider{riders?.length === 1 ? '' : 's'}</span>
          <div className="ml-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Rider
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : !riders?.length ? (
            <div className="p-12 text-center">
              <Bike className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No delivery boys added yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Vehicle</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Payouts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {riders.map((r) => (
                  <tr key={r.id} className={!r.active ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.phone}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {r.vehicleType ?? '—'} {r.vehicleNumber ? `· ${r.vehicleNumber}` : ''}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setPayoutRider(r)} className="inline-flex items-center gap-1 text-xs text-[#1B4F8A] hover:underline">
                        <Wallet className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showAdd && (
        <AddRiderModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['delivery-boys'] }); }}
        />
      )}
      {payoutRider && <PayoutModal rider={payoutRider} onClose={() => setPayoutRider(null)} />}
    </>
  );
}

function AddRiderModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  useEscapeKey(onClose, true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('Bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => api.post('/delivery-boys', {
      name: name.trim(), phone: phone.trim(),
      vehicleType: vehicleType.trim() || undefined,
      vehicleNumber: vehicleNumber.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Rider added'); onAdded(); },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Could not add rider'),
  });

  function handleSubmit() {
    setError('');
    if (!name.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Enter a name and a valid 10-digit phone number');
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add Delivery Boy</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit phone (used for login)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
          <input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Vehicle type (e.g. Bike)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
          <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="Vehicle number (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e] disabled:opacity-50">
            {createMutation.isPending ? 'Adding…' : 'Add Rider'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PayoutModal({ rider, onClose }: { rider: DeliveryBoy; onClose: () => void }) {
  useEscapeKey(onClose, true);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-boy-payouts', rider.id],
    queryFn: () => api.get(`/delivery-boys/${rider.id}/payouts`).then((r) => r.data as {
      entries: { id: string; amount: number | string; settled: boolean; createdAt: string }[];
      owedToRider: number;
      cashInHand: number;
    }),
  });

  const settleMutation = useMutation({
    mutationFn: () => api.post(`/delivery-boys/${rider.id}/payouts/settle`),
    onSuccess: () => { toast.success('Payouts marked as settled'); queryClient.invalidateQueries({ queryKey: ['delivery-boy-payouts', rider.id] }); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{rider.name} — Payouts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Owed to rider</p>
                  <p className="text-lg font-semibold text-[#1B4F8A]">₹{data?.owedToRider ?? 0}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Cash in hand (COD)</p>
                  <p className="text-lg font-semibold text-orange-600">₹{data?.cashInHand ?? 0}</p>
                </div>
              </div>

              {(data?.owedToRider ?? 0) > 0 && (
                <button
                  onClick={() => settleMutation.mutate()}
                  disabled={settleMutation.isPending}
                  className="w-full px-4 py-2 text-sm font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e] disabled:opacity-50"
                >
                  {settleMutation.isPending ? 'Settling…' : 'Mark as Settled (paid rider)'}
                </button>
              )}

              <div className="space-y-1">
                {(data?.entries ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">{new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span className={e.settled ? 'text-gray-400' : 'text-gray-900 font-medium'}>₹{e.amount} {e.settled ? '(settled)' : ''}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  Users, Clock, CheckCircle2, AlertTriangle, Banknote,
  Smartphone, CreditCard, Loader2, TrendingUp, XCircle,
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';

interface Shift {
  id: string;
  cashierId: string;
  cashierName: string | null;
  status: 'OPEN' | 'CLOSED' | 'SUSPENDED';
  startTime: string;
  endTime: string | null;
  openingCash: string;
  closingCash: string | null;
  expectedCash: string | null;
  cashDiff: string | null;
  totalSales: string;
  totalBills: number;
  totalCash: string;
  totalUpi: string;
  totalCard: string;
  notes: string | null;
  counter: { id: string; name: string; code: string };
  cashier: { id: string; fullName: string; username: string };
}

const inr = (n: string | number | null | undefined) =>
  `₹${Number(n ?? 0).toFixed(2)}`;

function duration(start: string, end?: string | null) {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'OPEN') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      Open
    </span>
  );
  if (status === 'SUSPENDED') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      Suspended
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
      Closed
    </span>
  );
}

export default function ShiftsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const queryClient   = useQueryClient();
  const { connected } = useWebSocket();

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', date],
    queryFn: async () => {
      const res = await api.get<Shift[]>('/pos/shifts/today', { params: { date } });
      return res.data ?? [];
    },
  });

  useWebSocketEvent('shift.opened', () => {
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
  });

  useWebSocketEvent('shift.closed', () => {
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
  });

  const forceCloseMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const res = await api.put(`/pos/shifts/${shiftId}/force-close`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift force-closed');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to force close shift';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    },
  });

  function handleForceClose(shift: Shift) {
    if (!confirm(`Force close ${shift.cashierName ?? shift.cashier.fullName}'s shift on ${shift.counter.name}? This cannot be undone.`)) return;
    forceCloseMutation.mutate(shift.id);
  }

  const openShifts   = shifts.filter((s) => s.status === 'OPEN');
  const closedShifts = shifts.filter((s) => s.status === 'CLOSED');
  const totalSales   = shifts.reduce((sum, s) => sum + Number(s.totalSales), 0);
  const totalBills   = shifts.reduce((sum, s) => sum + s.totalBills, 0);
  const totalCash    = shifts.reduce((sum, s) => sum + Number(s.totalCash), 0);
  const totalUpi     = shifts.reduce((sum, s) => sum + Number(s.totalUpi), 0);
  const totalCard    = shifts.reduce((sum, s) => sum + Number(s.totalCard), 0);

  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <>
      <Header
        title="Shift Management"
        actions={
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-[#1B4F8A]"
            />
            <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
              {connected ? '● Live' : '○ Offline'}
            </span>
          </div>
        }
      />

      <main className="flex-1 p-6 space-y-6 max-w-6xl mx-auto">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Open Shifts</p>
              <p className="text-xl font-bold text-gray-900">{openShifts.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Closed Shifts</p>
              <p className="text-xl font-bold text-gray-900">{closedShifts.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Sales</p>
              <p className="text-base font-bold text-gray-900">{inr(totalSales)}</p>
              <p className="text-xs text-gray-400">{totalBills} bills</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cash</p>
              <p className="text-base font-bold text-gray-900">{inr(totalCash)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">UPI + Card</p>
              <p className="text-base font-bold text-gray-900">{inr(totalUpi + totalCard)}</p>
            </div>
          </div>
        </div>

        {/* Open shifts warning */}
        {isToday && openShifts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              {openShifts.length} shift{openShifts.length > 1 ? 's' : ''} currently active
            </p>
          </div>
        )}

        {/* Shifts table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-[#1B4F8A] animate-spin" />
          </div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No shifts found for this date</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cashier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Counter</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Time
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Opening</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Bills</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">
                    <Banknote className="w-3.5 h-3.5 inline mr-1" />
                    Cash
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">
                    <Smartphone className="w-3.5 h-3.5 inline mr-1" />
                    UPI
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">
                    <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                    Card
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Cash Diff</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shifts.map((shift) => {
                  const name      = shift.cashierName ?? shift.cashier.fullName ?? shift.cashier.username;
                  const diff      = shift.cashDiff !== null ? Number(shift.cashDiff) : null;
                  const isForcing = forceCloseMutation.isPending && forceCloseMutation.variables === shift.id;
                  return (
                    <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{name}</p>
                        <p className="text-xs text-gray-400">{shift.cashier.username}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-700">{shift.counter.name}</p>
                        <p className="text-xs text-gray-400">{shift.counter.code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={shift.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p>{fmt(shift.startTime)} — {shift.endTime ? fmt(shift.endTime) : <span className="text-green-600 font-medium">Active</span>}</p>
                        <p className="text-xs text-gray-400">{duration(shift.startTime, shift.endTime)}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{inr(shift.openingCash)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{shift.totalBills}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{inr(shift.totalCash)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{inr(shift.totalUpi)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{inr(shift.totalCard)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{inr(shift.totalSales)}</td>
                      <td className="px-4 py-3 text-right">
                        {diff !== null ? (
                          <span className={`font-semibold text-xs ${Math.abs(diff) < 0.01 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {diff >= 0 ? '+' : ''}{inr(diff)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {shift.status === 'OPEN' && (
                          <button
                            onClick={() => handleForceClose(shift)}
                            disabled={isForcing}
                            title="Force close this shift"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {isForcing
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <XCircle className="w-3.5 h-3.5" />}
                            Force Close
                          </button>
                        )}
                        {shift.notes && shift.status === 'CLOSED' && (
                          <span className="text-xs text-gray-400 max-w-32 truncate block" title={shift.notes}>
                            {shift.notes}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              {shifts.length > 1 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Day Total ({shifts.length} shifts)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{totalBills}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{inr(totalCash)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{inr(totalUpi)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{inr(totalCard)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#1B4F8A]">{inr(totalSales)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </main>
    </>
  );
}

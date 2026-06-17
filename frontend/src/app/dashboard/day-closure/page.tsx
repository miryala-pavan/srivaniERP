'use client';

import { useState, useEffect } from 'react';
import {
  CalendarCheck, CheckCircle2, AlertTriangle, Clock,
  TrendingUp, Banknote, Smartphone, CreditCard,
  Loader2, ClipboardList, PlayCircle, Users,
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';

interface DayData {
  totalBills: number;
  totalSales: number;
  totalCash: number;
  totalUpi: number;
  totalCard: number;
  openingCash: number;
  systemCash: number;
  actualCash: number | null;
  cashDifference: number | null;
  grnsPending: number;
  stockAlerts: number;
  openShifts: number;
  status: string | null;
  closedAt: string | null;
  notes: string | null;
  closureDate: string;
}

interface HistoryItem {
  id: string;
  closureDate: string;
  status: string;
  totalBills: number;
  totalSales: string;
  totalCash: string;
  totalUpi: string;
  totalCard: string;
  actualCash: string | null;
  cashDifference: string | null;
  closedAt: string | null;
  notes: string | null;
}

const inr = (n: number | string | null | undefined) =>
  `₹${Number(n ?? 0).toFixed(2)}`;

function SummaryCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CheckRow({
  label, ok, detail,
}: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-green-100' : 'bg-red-100'}`}>
        {ok
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
      </div>
      <div className="flex-1">
        <span className={`text-sm font-medium ${ok ? 'text-gray-700' : 'text-red-600'}`}>{label}</span>
        {detail && <span className="text-xs text-gray-400 ml-2">{detail}</span>}
      </div>
      <span className={`text-xs font-semibold ${ok ? 'text-green-600' : 'text-red-500'}`}>
        {ok ? 'OK' : 'Pending'}
      </span>
    </div>
  );
}

export default function DayClosurePage() {
  const [actualCash, setActualCash]     = useState('');
  const [notes, setNotes]               = useState('');
  const [initialized, setInitialized]   = useState(false);

  const queryClient   = useQueryClient();
  const { connected } = useWebSocket();

  const { data: today, isLoading } = useQuery({
    queryKey: ['day-closure', 'today'],
    queryFn: async () => {
      const res = await api.get<DayData>('/day-closure/today');
      return res.data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['day-closure', 'history'],
    queryFn: async () => {
      const res = await api.get<HistoryItem[]>('/day-closure/history');
      return res.data ?? [];
    },
  });

  // Pre-populate form fields from server on first successful load only
  useEffect(() => {
    if (!today || initialized) return;
    if (today.actualCash !== null) setActualCash(String(today.actualCash));
    if (today.notes) setNotes(today.notes);
    setInitialized(true);
  }, [today, initialized]);

  // Invalidate both queries on any event that changes day totals or status
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['day-closure'] });
  useWebSocketEvent('day.opened',   invalidate);
  useWebSocketEvent('day.closed',   invalidate);
  useWebSocketEvent('bill.created', invalidate);
  useWebSocketEvent('bill.voided',  invalidate);
  useWebSocketEvent('shift.closed', invalidate);

  const openDayMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/day-closure/open');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-closure'] });
      toast.success('Day opened successfully');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to open day';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const forceCloseShiftsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ closed: number }>('/day-closure/force-close-shifts');
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['day-closure'] });
      toast.success(`${res.closed} shift(s) force-closed`);
    },
    onError: () => {
      toast.error('Failed to force close shifts');
    },
  });

  const closeDayMutation = useMutation({
    mutationFn: async ({ cash, notesVal }: { cash: number; notesVal?: string }) => {
      const res = await api.post('/day-closure/close', { actualCash: cash, notes: notesVal || undefined });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-closure'] });
      window.dispatchEvent(new CustomEvent('dayClosed'));
      toast.success('Day closed successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to close day';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    },
  });

  function handleOpen() {
    openDayMutation.mutate();
  }

  function handleForceCloseShifts() {
    if (!confirm(`Force close all ${openShifts} open shift(s)? This cannot be undone.`)) return;
    forceCloseShiftsMutation.mutate();
  }

  function handleClose() {
    const cash = parseFloat(actualCash);
    if (isNaN(cash) || cash < 0) return toast.error('Enter a valid cash amount');
    closeDayMutation.mutate({ cash, notesVal: notes || undefined });
  }

  const isClosed   = today?.status === 'COMPLETED';
  const isOpen     = today?.status === 'PENDING';
  const openShifts = today?.openShifts ?? 0;
  const cashDiff   = today && actualCash
    ? Number(actualCash) - (today.systemCash ?? 0)
    : null;

  const opening     = openDayMutation.isPending;
  const forceClosing = forceCloseShiftsMutation.isPending;
  const closing     = closeDayMutation.isPending;

  return (
    <>
      <Header
        title="Day Closure"
        actions={
          <div className="flex items-center gap-3">
            {!isOpen && !isClosed && !isLoading && (
              <button
                onClick={handleOpen}
                disabled={opening}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B4F8A] hover:bg-[#163f6e] disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                {opening ? 'Opening...' : 'Open New Day'}
              </button>
            )}
            <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
              {connected ? '● Live' : '○ Offline'}
            </span>
          </div>
        }
      />
      <main className="flex-1 p-6 space-y-6 max-w-4xl mx-auto">

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-[#1B4F8A] animate-spin" />
          </div>
        ) : today ? (
          <>
            {/* Status banner */}
            {isClosed ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Today&apos;s day has been closed</p>
                  {today.closedAt && (
                    <p className="text-xs text-green-600">
                      Closed at {new Date(today.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ) : isOpen ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Day is open — closure pending</p>
                  <p className="text-xs text-amber-600">Complete the checklist and close the day before end of business</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Day not opened yet</p>
                  <p className="text-xs text-gray-500">Open the day to enable billing at POS counters</p>
                </div>
                <button
                  onClick={handleOpen}
                  disabled={opening}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#1B4F8A] hover:bg-[#163f6e] text-white text-xs font-medium rounded-lg"
                >
                  {opening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  Open Day
                </button>
              </div>
            )}

            {/* Today's Summary */}
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Today&apos;s Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                  label="Total Bills"
                  value={String(today.totalBills)}
                  sub={`Sales: ${inr(today.totalSales)}`}
                  icon={ClipboardList}
                  color="bg-blue-50 text-blue-600"
                />
                <SummaryCard
                  label="Cash Sales"
                  value={inr(today.totalCash)}
                  icon={Banknote}
                  color="bg-green-50 text-green-600"
                />
                <SummaryCard
                  label="UPI Sales"
                  value={inr(today.totalUpi)}
                  icon={Smartphone}
                  color="bg-purple-50 text-purple-600"
                />
                <SummaryCard
                  label="Card Sales"
                  value={inr(today.totalCard)}
                  icon={CreditCard}
                  color="bg-orange-50 text-orange-600"
                />
              </div>
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Cash Reconciliation */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-600" />
                  Cash Reconciliation
                </h2>
                <div className="space-y-2.5">
                  <ReconRow label="Opening Cash" value={inr(today.openingCash)} />
                  <ReconRow label="Cash Sales" value={inr(today.totalCash)} />
                  <div className="border-t border-gray-100 pt-2">
                    <ReconRow label="System Cash" value={inr(today.systemCash)} bold />
                  </div>
                  <div className="pt-1">
                    <label className="text-xs text-gray-500 mb-1.5 block">Actual Cash Counted (₹)</label>
                    <input
                      type="number"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      disabled={isClosed}
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#1B4F8A] disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  {cashDiff !== null && actualCash && (
                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${Math.abs(cashDiff) < 0.01 ? 'bg-green-50 border-green-200' : cashDiff > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                      <span className="text-sm font-medium text-gray-700">Difference</span>
                      <span className={`text-base font-bold ${Math.abs(cashDiff) < 0.01 ? 'text-green-600' : cashDiff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {cashDiff >= 0 ? '+' : ''}{inr(cashDiff)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Checklist + Notes */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    End-of-Day Checklist
                  </h2>
                  <div className="divide-y divide-gray-100">
                    <CheckRow
                      label="Cash counted"
                      ok={!!actualCash && !isNaN(parseFloat(actualCash))}
                      detail={actualCash ? inr(parseFloat(actualCash)) : undefined}
                    />
                    <CheckRow
                      label="GRNs pending approval"
                      ok={today.grnsPending === 0}
                      detail={today.grnsPending > 0 ? `${today.grnsPending} pending` : undefined}
                    />
                    <CheckRow
                      label="Stock alerts reviewed"
                      ok={today.stockAlerts === 0}
                      detail={today.stockAlerts > 0 ? `${today.stockAlerts} unread` : undefined}
                    />
                    <CheckRow
                      label="Sales recorded"
                      ok={today.totalBills > 0}
                      detail={`${today.totalBills} bill${today.totalBills !== 1 ? 's' : ''} today`}
                    />
                    <CheckRow
                      label="All shifts closed"
                      ok={openShifts === 0}
                      detail={openShifts > 0 ? `${openShifts} shift${openShifts > 1 ? 's' : ''} still open` : undefined}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isClosed}
                    rows={3}
                    placeholder="Any remarks for today's closure…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1B4F8A] resize-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Close button */}
            {!isClosed && (
              <div className="space-y-3">
                {openShifts > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3.5 flex items-center gap-3">
                    <Users className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-orange-800">
                        {openShifts} shift{openShifts > 1 ? 's' : ''} still open
                      </p>
                      <p className="text-xs text-orange-600">All cashier shifts must be closed before closing the day</p>
                    </div>
                    <button
                      onClick={handleForceCloseShifts}
                      disabled={forceClosing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      {forceClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                      {forceClosing ? 'Closing…' : 'Force Close All'}
                    </button>
                  </div>
                )}
                <button
                  onClick={handleClose}
                  disabled={closing || openShifts > 0 || !actualCash || isNaN(parseFloat(actualCash))}
                  className="w-full py-3.5 bg-[#1B4F8A] hover:bg-[#163f6e] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {closing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                  {closing ? 'Closing Day…' : 'Close Today\'s Day'}
                </button>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Recent Closures</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Date</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Bills</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Sales</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Cash Diff</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Closed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => {
                        const diff = Number(h.cashDifference ?? 0);
                        return (
                          <tr key={h.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {new Date(h.closureDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{h.totalBills}</td>
                            <td className="px-4 py-3 text-right text-gray-800 font-medium">{inr(h.totalSales)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${Math.abs(diff) < 0.01 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                              {diff >= 0 ? '+' : ''}{inr(diff)}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {h.closedAt
                                ? new Date(h.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No data available</p>
          </div>
        )}
      </main>
    </>
  );
}

function ReconRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

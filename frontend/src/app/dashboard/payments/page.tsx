'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Check, Trash2, Search } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
}

interface Payment {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  referenceNumber?: string;
  notes?: string;
  createdByName: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  purchase?: { id: string; grnNumber?: string; invoiceNumber: string; grandTotal: number } | null;
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'NEFT', 'RTGS'];

const fmt = (v: number | string) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(v));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PaymentsPage() {
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [suppSearch, setSuppSearch] = useState('');

  // summary
  const [thisMonthTotal, setThisMonthTotal]   = useState(0);
  const [allTimeTotal, setAllTimeTotal]       = useState(0);
  const [outstandingTotal, setOutstandingTotal] = useState(0);

  // add payment modal
  const [showModal, setShowModal]   = useState(false);
  const [selSupplier, setSelSupplier] = useState('');
  const [suppGrns, setSuppGrns]     = useState<{ id: string; grnNumber?: string; invoiceNumber: string; grandTotal: number }[]>([]);
  const [payForm, setPayForm]       = useState({
    purchaseId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: '',
    paymentMode: 'CASH',
    referenceNumber: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEscapeKey(() => setShowModal(false), showModal);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all suppliers, then aggregate payments
      const suppRes = await api.get('/suppliers', { params: { limit: 100 } });
      const suppList: Supplier[] = suppRes.data.data;
      setSuppliers(suppList);

      const allPayments: Payment[] = [];
      const payResults = await Promise.allSettled(
        suppList.map((s) => api.get(`/suppliers/${s.id}/payments`, { params: { limit: 100 } })),
      );
      payResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const data: Payment[] = r.value.data.data;
          data.forEach((p) => { p.supplier = suppList[i]; allPayments.push(p); });
        }
      });
      allPayments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
      setPayments(allPayments);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let monthTotal = 0;
      let total = 0;
      allPayments.forEach((p) => {
        total += Number(p.amount);
        if (new Date(p.paymentDate) >= monthStart) monthTotal += Number(p.amount);
      });
      setThisMonthTotal(monthTotal);
      setAllTimeTotal(total);

      // outstanding: sum of dynamically computed balanceDue per supplier (positive = we owe them)
      let outstanding = 0;
      suppList.forEach((s: any) => { outstanding += Number(s.balanceDue ?? 0); });
      setOutstandingTotal(outstanding);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  async function loadSuppGrns(supplierId: string) {
    if (!supplierId) { setSuppGrns([]); return; }
    try {
      const res = await api.get('/grn', { params: { supplierId, status: 'APPROVED', limit: 50 } });
      setSuppGrns(res.data.data.map((g: any) => ({
        id: g.id,
        grnNumber: g.grnNumber,
        invoiceNumber: g.invoiceNumber,
        grandTotal: g.grandTotal,
      })));
    } catch {
      setSuppGrns([]);
    }
  }

  function openModal() {
    setSelSupplier('');
    setSuppGrns([]);
    setPayForm({
      purchaseId: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: '',
      paymentMode: 'CASH',
      referenceNumber: '',
      notes: '',
    });
    setShowModal(true);
  }

  async function submitPayment() {
    if (!selSupplier) { toast.error('Select a supplier'); return; }
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const selectedGrn = suppGrns.find((g) => g.id === payForm.purchaseId);
      await api.post(`/suppliers/${selSupplier}/payments`, {
        purchaseId:       payForm.purchaseId || undefined,
        invoiceReference: selectedGrn?.invoiceNumber,
        paymentDate:      payForm.paymentDate,
        amount:           amt,
        paymentMode:      payForm.paymentMode,
        referenceNumber:  payForm.referenceNumber || undefined,
        notes:            payForm.notes || undefined,
      });
      toast.success('Payment recorded');
      setShowModal(false);
      loadPayments();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(p: Payment) {
    if (!confirm('Delete this payment?')) return;
    try {
      await api.delete(`/suppliers/${p.supplierId}/payments/${p.id}`);
      toast.success('Payment deleted');
      loadPayments();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    }
  }

  const filteredPayments = suppSearch
    ? payments.filter((p) =>
        p.supplier?.name.toLowerCase().includes(suppSearch.toLowerCase()),
      )
    : payments;

  return (
    <>
      <Header title="Supplier Payments" />
      <main className="flex-1 p-6 space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-xl font-bold text-gray-800">Rs.{fmt(thisMonthTotal)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">All Time Paid</p>
            <p className="text-xl font-bold text-green-700">Rs.{fmt(allTimeTotal)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Outstanding (approx)</p>
            <p className={`text-xl font-bold ${outstandingTotal > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              Rs.{fmt(outstandingTotal)}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={suppSearch}
              onChange={(e) => setSuppSearch(e.target.value)}
              placeholder="Filter by supplier…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            />
          </div>
          <span className="text-sm text-gray-400 ml-auto">{filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}</span>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e]"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>

        {/* Payments table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No payments recorded yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">GRN / Invoice</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mode</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                      {p.purchase
                        ? `${p.purchase.grnNumber ?? ''} / ${p.purchase.invoiceNumber}`
                        : p.referenceNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        {p.paymentMode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      Rs.{fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deletePayment(p)}
                        className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Add Payment modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Record Payment</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Supplier *</label>
                <select
                  value={selSupplier}
                  onChange={(e) => {
                    setSelSupplier(e.target.value);
                    setPayForm((f) => ({ ...f, purchaseId: '' }));
                    loadSuppGrns(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                >
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {suppGrns.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Link to GRN (optional)</label>
                  <select
                    value={payForm.purchaseId}
                    onChange={(e) => {
                      const grn = suppGrns.find((g) => g.id === e.target.value);
                      setPayForm((f) => ({
                        ...f,
                        purchaseId: e.target.value,
                        amount: grn ? String(Number(grn.grandTotal).toFixed(2)) : f.amount,
                      }));
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  >
                    <option value="">— Not linked to a specific GRN —</option>
                    {suppGrns.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.grnNumber ?? 'GRN'} / {g.invoiceNumber} — Rs.{fmt(g.grandTotal)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Payment Date</label>
                  <input
                    type="date"
                    value={payForm.paymentDate}
                    onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Amount (Rs.) *</label>
                  <input
                    type="number"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="0.00"
                    min={0}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Payment Mode</label>
                <select
                  value={payForm.paymentMode}
                  onChange={(e) => setPayForm({ ...payForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>{m.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Reference / UTR / Cheque No.</label>
                <input
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={saving}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

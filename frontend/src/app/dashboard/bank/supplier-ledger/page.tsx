'use client';
import { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronUp, CheckCircle, Clock, Plus } from 'lucide-react';
import api from '@/lib/api';

interface GRN {
  id: string; grnNumber: string | null; invoiceNumber: string;
  invoiceDate: string; grandTotal: number; amountPayable: number;
  paidAmount: number; balanceAmount: number;
}
interface Payment {
  id: string; paymentDate: string; amount: number;
  paymentMode: string; referenceNumber: string | null;
  matchedFromStatement: boolean; purchaseId: string | null;
}
interface SupplierLedger {
  id: string; name: string; phone: string | null;
  totalBilled: number; totalPaid: number; totalOutstanding: number;
  purchases: GRN[]; payments: Payment[];
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.abs(n));
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function SupplierLedgerPage() {
  const [suppliers, setSuppliers]     = useState<SupplierLedger[]>([]);
  const [filtered, setFiltered]       = useState<SupplierLedger[]>([]);
  const [search, setSearch]           = useState('');
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showOnlyDues, setShowOnlyDues] = useState(false);
  const [payModal, setPayModal]       = useState<SupplierLedger | null>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let s = suppliers;
    if (showOnlyDues) s = s.filter(x => x.totalOutstanding > 0.5);
    if (search) s = s.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
    setFiltered(s);
  }, [suppliers, search, showOnlyDues]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/bank/supplier-ledger');
      setSuppliers(res.data);
    } finally { setLoading(false); }
  }

  const totalOutstanding = suppliers.reduce((s, x) => s + x.totalOutstanding, 0);

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Supplier Ledger</h1>
          <p className="text-xs text-gray-500 mt-0.5">All GRN bills vs payments</p>
        </div>
        {totalOutstanding > 0 && (
          <div className="text-right">
            <div className="text-xs text-gray-500">Total Outstanding</div>
            <div className="text-xl font-bold text-orange-600">₹{fmt(totalOutstanding)}</div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search supplier..."
            className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showOnlyDues} onChange={e => setShowOnlyDues(e.target.checked)}
            className="rounded" />
          Show only with dues
        </label>
        <span className="text-xs text-gray-500">{filtered.length} suppliers</span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isOpen = expanded === s.id;
            const hasDue = s.totalOutstanding > 0.5;
            return (
              <div key={s.id} className={`bg-white border rounded-xl overflow-hidden ${hasDue ? 'border-orange-200' : ''}`}>
                {/* Header row */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 text-sm">{s.name}</span>
                      {hasDue && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                          Due
                        </span>
                      )}
                    </div>
                    {s.phone && <div className="text-xs text-gray-400">{s.phone}</div>}
                  </div>
                  <div className="hidden sm:flex gap-6 text-right text-xs">
                    <div>
                      <div className="text-gray-500">Billed</div>
                      <div className="font-medium text-gray-800">₹{fmt(s.totalBilled)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Paid</div>
                      <div className="font-medium text-green-600">₹{fmt(s.totalPaid)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Outstanding</div>
                      <div className={`font-bold ${hasDue ? 'text-orange-600' : 'text-gray-400'}`}>
                        ₹{fmt(s.totalOutstanding)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasDue && (
                      <button
                        onClick={e => { e.stopPropagation(); setPayModal(s); }}
                        className="flex items-center gap-1 px-2.5 py-1 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700">
                        <Plus className="w-3 h-3" /> Pay
                      </button>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t bg-gray-50 p-3 space-y-3">
                    {/* GRNs */}
                    {s.purchases.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 mb-1.5">GRN Bills</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b">
                                <th className="text-left py-1 pr-3">GRN#</th>
                                <th className="text-left py-1 pr-3">Invoice</th>
                                <th className="text-left py-1 pr-3">Date</th>
                                <th className="text-right py-1 pr-3">Bill Amt</th>
                                <th className="text-right py-1 pr-3">Paid</th>
                                <th className="text-right py-1">Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.purchases.map(g => (
                                <tr key={g.id} className="border-b last:border-0">
                                  <td className="py-1 pr-3 font-mono text-gray-600">{g.grnNumber ?? '—'}</td>
                                  <td className="py-1 pr-3 text-gray-700">{g.invoiceNumber}</td>
                                  <td className="py-1 pr-3 text-gray-500">{fmtDate(g.invoiceDate)}</td>
                                  <td className="py-1 pr-3 text-right font-medium">₹{fmt(Number(g.amountPayable))}</td>
                                  <td className="py-1 pr-3 text-right text-green-600">₹{fmt(Number(g.paidAmount))}</td>
                                  <td className={`py-1 text-right font-bold ${Number(g.balanceAmount) > 0.5 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {Number(g.balanceAmount) > 0.5 ? `₹${fmt(Number(g.balanceAmount))}` : '✓ Paid'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Payments */}
                    {s.payments.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 mb-1.5">Payments Made</h4>
                        <div className="space-y-1">
                          {s.payments.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-gray-600">{fmtDate(p.paymentDate)}</span>
                                <span className="text-gray-500">{p.paymentMode}</span>
                                {p.referenceNumber && <span className="font-mono text-gray-400">{p.referenceNumber.slice(0, 20)}</span>}
                                {p.matchedFromStatement && (
                                  <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-xs">Auto-matched</span>
                                )}
                              </div>
                              <span className="font-semibold text-green-700">₹{fmt(Number(p.amount))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.purchases.length === 0 && s.payments.length === 0 && (
                      <div className="text-center text-gray-400 text-xs py-3">No GRNs or payments yet</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No suppliers found</div>
          )}
        </div>
      )}

      {/* Quick Pay Modal */}
      {payModal && (
        <QuickPayModal
          supplier={payModal}
          onClose={() => setPayModal(null)}
          onSaved={() => { setPayModal(null); load(); }}
        />
      )}
    </div>
  );
}

function QuickPayModal({ supplier, onClose, onSaved }: {
  supplier: SupplierLedger;
  onClose: () => void;
  onSaved: () => void;
}) {
  const unpaid = supplier.purchases.filter(g => Number(g.balanceAmount) > 0.5);
  const [selected, setSelected]     = useState<Record<string, number>>(
    Object.fromEntries(unpaid.map(g => [g.id, Number(g.balanceAmount)]))
  );
  const [payDate, setPayDate]       = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode]             = useState('NEFT');
  const [ref, setRef]               = useState('');
  const [accounts, setAccounts]     = useState<{ id: string; accountName: string }[]>([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState('');

  useEffect(() => {
    api.get('/bank/accounts').then((r: any) => {
      const a = r.data;
      setAccounts(a);
      if (a.length > 0) setBankAccountId(a[0].id);
    });
  }, []);

  const totalPaying = Object.values(selected).reduce((s, a) => s + a, 0);

  async function save() {
    const purchaseIds = Object.keys(selected).filter(id => selected[id] > 0);
    const amounts     = purchaseIds.map(id => selected[id]);
    if (purchaseIds.length === 0 || totalPaying === 0) {
      setToast('Select at least one GRN to pay'); return;
    }
    setSaving(true);
    try {
      await api.post('/bank/payments', {
        supplierId:      supplier.id,
        purchaseIds,
        amounts,
        paymentDate:     payDate,
        paymentMode:     mode,
        referenceNumber: ref || undefined,
        bankAccountId:   bankAccountId || undefined,
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Record Payment — {supplier.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        {toast && <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{toast}</div>}

        {/* GRN selection */}
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Select GRNs to pay</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {unpaid.map(g => (
              <div key={g.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <input type="checkbox"
                  checked={selected[g.id] > 0}
                  onChange={e => setSelected(s => ({ ...s, [g.id]: e.target.checked ? Number(g.balanceAmount) : 0 }))}
                  className="rounded" />
                <div className="flex-1 text-xs">
                  <span className="font-medium">{g.invoiceNumber}</span>
                  <span className="text-gray-400 ml-1">{new Date(g.invoiceDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="text-xs text-orange-600 font-medium mr-2">Due: ₹{new Intl.NumberFormat('en-IN').format(Number(g.balanceAmount))}</div>
                <input type="number" value={selected[g.id] || ''}
                  onChange={e => setSelected(s => ({ ...s, [g.id]: parseFloat(e.target.value) || 0 }))}
                  className="w-24 border rounded px-2 py-1 text-xs text-right" />
              </div>
            ))}
          </div>
        </div>

        {/* Payment details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payment Date</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payment Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm">
              <option value="NEFT">NEFT</option>
              <option value="UPI">UPI</option>
              <option value="RTGS">RTGS</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bank Account</label>
            <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">UTR / Reference No.</label>
            <input value={ref} onChange={e => setRef(e.target.value)}
              placeholder="UTR number"
              className="w-full border rounded-lg px-2 py-1.5 text-sm" />
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between bg-orange-50 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-gray-700">Total Paying</span>
          <span className="text-lg font-bold text-orange-700">
            ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalPaying)}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving || totalPaying === 0}
            className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

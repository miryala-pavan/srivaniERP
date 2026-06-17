'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, MinusCircle, Link2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { cleanDesc } from '@/lib/bank-utils';

const ADJ_REASONS = [
  { value: 'BANK_CHARGE',  label: 'Bank charge' },
  { value: 'TDS',          label: 'TDS deducted' },
  { value: 'CASH_DISCOUNT',label: 'Cash discount' },
  { value: 'ROUNDING',     label: 'Rounding' },
  { value: 'SHORT_PAYMENT',label: 'Short payment' },
];

interface GrnAllocation {
  allocatedAmount: number;
  purchase: {
    id: string;
    grnNumber: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    amountPayable: number;
  };
}
interface Txn {
  id: string; txnDate: string; description: string; refNumber: string;
  debitAmount: number | null; creditAmount: number | null; balance: number | null;
  txnType: string; matchStatus: string; notes: string | null;
  bankAccount: { accountName: string; bankName: string };
  supplierPayment: {
    supplier: { name: string };
    allocations: GrnAllocation[];
  } | null;
}
interface Account { id: string; accountName: string; }

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

const TXN_TYPES = [
  { value: '',                     label: 'All Types' },
  { value: 'SALES_PHONEPE',        label: 'PhonePe' },
  { value: 'SALES_PINELABS',       label: 'Pine Labs' },
  { value: 'SALES_UPI',            label: 'UPI Credit' },
  { value: 'CASH_DEPOSIT',         label: 'Cash Deposit' },
  { value: 'SUPPLIER_PAYMENT',     label: 'Supplier Payment' },
  { value: 'EXPENSE_RENT',         label: 'Rent' },
  { value: 'EXPENSE_OTHER',        label: 'Other Expense' },
  { value: 'INTER_ACCOUNT',        label: 'Own Transfer' },
  { value: 'CREDIT_CARD_PAYMENT',  label: 'Credit Card' },
  { value: 'BANK_CHARGE',          label: 'Bank Charge' },
  { value: 'UNCATEGORIZED',        label: 'Uncategorized' },
];

const TYPE_BADGE: Record<string, string> = {
  SALES_PHONEPE:       'bg-purple-100 text-purple-700',
  SALES_PINELABS:      'bg-blue-100   text-blue-700',
  SALES_UPI:           'bg-cyan-100   text-cyan-700',
  CASH_DEPOSIT:        'bg-emerald-100 text-emerald-700',
  SUPPLIER_PAYMENT:    'bg-orange-100 text-orange-700',
  EXPENSE_RENT:        'bg-rose-100   text-rose-700',
  EXPENSE_OTHER:       'bg-red-100    text-red-600',
  INTER_ACCOUNT:       'bg-gray-100   text-gray-600',
  CREDIT_CARD_PAYMENT: 'bg-pink-100   text-pink-700',
  BANK_CHARGE:         'bg-slate-100  text-slate-600',
  UNCATEGORIZED:       'bg-yellow-100 text-yellow-700',
};

export default function TransactionsPage() {
  const searchParams  = useSearchParams();
  const [txns, setTxns]         = useState<Txn[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [filters, setFilters]   = useState({
    bankAccountId: searchParams.get('bankAccountId') ?? '',
    txnType:       '',
    matchStatus:   '',
    fromDate:      '',
    toDate:        '',
  });

  // ── Reconcile (match-group) state ──
  const [reconcileMode, setReconcileMode] = useState(false);
  const [selTxns, setSelTxns]   = useState<Record<string, Txn>>({});
  const [matchOpen, setMatchOpen] = useState(false);

  useEffect(() => { api.get('/bank/accounts').then(r => setAccounts(r.data)); }, []);
  useEffect(() => { load(); }, [filters, page]);

  function toggleTxn(t: Txn) {
    setSelTxns(prev => {
      const next = { ...prev };
      if (next[t.id]) delete next[t.id]; else next[t.id] = t;
      return next;
    });
  }
  const selectedTxnList = Object.values(selTxns);
  const selectedTxnTotal = selectedTxnList.reduce((s, t) => s + Number(t.debitAmount ?? 0), 0);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '50' });
      Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
      const res = await api.get(`/bank/transactions?${q}`);
      setTxns(res.data.items);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  }

  function setFilter(key: string, value: string) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  }

  async function markIgnored(id: string) {
    await api.patch(`/bank/transactions/${id}`, { matchStatus: 'IGNORED' });
    load();
  }
  async function setTxnType(id: string, txnType: string) {
    await api.patch(`/bank/transactions/${id}`, { txnType });
    load();
  }

  const totalPages    = Math.ceil(total / 50);
  const pageCredits   = txns.reduce((s, t) => s + (Number(t.creditAmount) || 0), 0);
  const pageDebits    = txns.reduce((s, t) => s + (Number(t.debitAmount)  || 0), 0);

  return (
    /* Full viewport width minus sidebar — no max-w cap */
    <div className="flex flex-col h-full p-3 gap-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Bank Transactions</h1>
          <p className="text-xs text-gray-500">{total} total transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setReconcileMode(m => !m); setSelTxns({}); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
              reconcileMode ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]' : 'hover:bg-gray-50'
            }`}>
            <Link2 className="w-3.5 h-3.5" /> {reconcileMode ? 'Exit Reconcile' : 'Reconcile'}
          </button>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center">
        <select value={filters.bankAccountId} onChange={e => setFilter('bankAccountId', e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-sm min-w-40">
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName}</option>)}
        </select>

        <select value={filters.txnType} onChange={e => setFilter('txnType', e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-sm">
          {TXN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select value={filters.matchStatus} onChange={e => setFilter('matchStatus', e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-sm">
          <option value="">All Status</option>
          <option value="MATCHED">✓ Matched</option>
          <option value="UNMATCHED">⏳ Unmatched</option>
          <option value="IGNORED">— Ignored</option>
        </select>

        <input type="date" value={filters.fromDate} onChange={e => setFilter('fromDate', e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-sm" />
        <span className="text-gray-400 text-xs">to</span>
        <input type="date" value={filters.toDate} onChange={e => setFilter('toDate', e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-sm" />

        {Object.values(filters).some(Boolean) && (
          <button onClick={() => { setFilters({ bankAccountId:'', txnType:'', matchStatus:'', fromDate:'', toDate:'' }); setPage(1); }}
            className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-50">
            ✕ Clear
          </button>
        )}

        {/* Running totals for current filter */}
        {txns.length > 0 && (
          <div className="ml-auto flex gap-5 text-sm font-semibold">
            <span className="text-green-700">↑ Credits: ₹{fmt(pageCredits)}</span>
            <span className="text-red-600" >↓ Debits:  ₹{fmt(pageDebits)}</span>
          </div>
        )}
      </div>

      {/* ── Table — full width, own scroll ── */}
      <div className="flex-1 overflow-auto rounded-xl border shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-sm">

          {/* Sticky header */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-700 text-white text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-left font-semibold w-72">Description</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Account</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Type</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Debit ↓</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Credit ↑</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Balance</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Status</th>
              <th className="px-3 py-3 w-8"></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-20 text-gray-400 bg-white">
                  Loading...
                </td>
              </tr>
            ) : txns.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-20 text-gray-400 bg-white">
                  No transactions found.
                </td>
              </tr>
            ) : txns.map((t) => {
              const isCredit  = !!t.creditAmount;
              const isMatched = t.matchStatus === 'MATCHED';
              const isIgnored = t.matchStatus === 'IGNORED';
              const badge     = TYPE_BADGE[t.txnType] ?? TYPE_BADGE.UNCATEGORIZED;
              const allocs    = t.supplierPayment?.allocations ?? [];

              /* Row background */
              const rowBg = isIgnored
                ? 'bg-gray-50 opacity-60'
                : isCredit
                  ? 'bg-green-50  border-l-4 border-l-green-400'
                  : 'bg-red-50    border-l-4 border-l-red-400';

              const hoverBg = isCredit ? 'hover:bg-green-100' : 'hover:bg-red-100';

              return [
                /* ── Main transaction row ── */
                <tr key={t.id}
                  className={`${rowBg} ${hoverBg} transition-colors ${allocs.length === 0 ? 'border-b border-gray-200' : ''}`}>

                  {/* Date */}
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-600">
                    <div className="flex items-center gap-2">
                      {reconcileMode && !isMatched && !isIgnored && !!t.debitAmount && (
                        <input type="checkbox" checked={!!selTxns[t.id]} onChange={() => toggleTxn(t)}
                          className="w-4 h-4 accent-[#1B4F8A] cursor-pointer" />
                      )}
                      {fmtDate(t.txnDate)}
                    </div>
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800 text-sm leading-tight">
                      {cleanDesc(t.description, t.refNumber)}
                    </div>
                    {t.supplierPayment && (
                      <div className="text-xs text-indigo-600 font-medium mt-0.5">
                        → {t.supplierPayment.supplier.name}
                      </div>
                    )}
                    {t.notes && !t.supplierPayment && (
                      <div className="text-xs text-blue-600 mt-0.5 leading-tight">{t.notes}</div>
                    )}
                  </td>

                  {/* Account */}
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {t.bankAccount.accountName}
                  </td>

                  {/* Type — editable dropdown */}
                  <td className="px-4 py-3">
                    <select value={t.txnType} onChange={e => setTxnType(t.id, e.target.value)}
                      className={`text-xs rounded-full px-2.5 py-1 border-0 font-semibold cursor-pointer appearance-none ${badge}`}>
                      {TXN_TYPES.filter(x => x.value).map(x => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Debit */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {t.debitAmount
                      ? <span className="font-bold text-red-700 text-sm">₹{fmt(Number(t.debitAmount))}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>

                  {/* Credit */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {t.creditAmount
                      ? <span className="font-bold text-green-700 text-sm">₹{fmt(Number(t.creditAmount))}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>

                  {/* Balance */}
                  <td className="px-4 py-3 text-right whitespace-nowrap text-xs">
                    {t.balance != null ? (
                      <span className={Number(t.balance) < 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {Number(t.balance) < 0 ? '−' : ''}₹{fmt(Math.abs(Number(t.balance)))}
                      </span>
                    ) : '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {isMatched ? (
                      <span className="inline-block bg-green-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        ✓ Matched
                      </span>
                    ) : isIgnored ? (
                      <span className="inline-block bg-gray-200 text-gray-500 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        — Ignored
                      </span>
                    ) : t.txnType.startsWith('SALES_') ? (
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        ~ Sales
                      </span>
                    ) : t.txnType === 'CASH_DEPOSIT' ? (
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        ~ Cash
                      </span>
                    ) : (
                      <span className="inline-block bg-yellow-100 text-yellow-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        ⏳ Unmatched
                      </span>
                    )}
                  </td>

                  {/* Ignore button */}
                  <td className="px-3 py-3 text-center">
                    {!isMatched && !isIgnored && !t.txnType.startsWith('SALES_') && (
                      <button onClick={() => markIgnored(t.id)}
                        title="Mark ignored (personal / non-business)"
                        className="text-gray-300 hover:text-red-400 transition-colors">
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>,

                /* ── Matched GRN sub-rows ── */
                ...allocs.map((alloc, ai) => (
                  <tr key={`${t.id}-grn-${ai}`}
                    className="bg-white border-b border-gray-200">
                    {/* indent spacer */}
                    <td className="pl-8 pr-2 py-1.5 text-xs text-gray-400 whitespace-nowrap">
                      {ai === 0 ? '└' : ' '}
                    </td>
                    <td colSpan={3} className="px-2 py-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">
                          {alloc.purchase.grnNumber}
                        </span>
                        {alloc.purchase.invoiceNumber && (
                          <span className="text-xs text-gray-500">
                            Inv: {alloc.purchase.invoiceNumber}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(alloc.purchase.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                        <span className="text-xs text-gray-400">
                          Bill: ₹{fmt(Number(alloc.purchase.amountPayable))}
                        </span>
                      </div>
                    </td>
                    {/* allocated amount aligns with Debit column */}
                    <td className="px-4 py-1.5 text-right whitespace-nowrap">
                      <span className="text-xs font-semibold text-red-600">
                        ₹{fmt(Number(alloc.allocatedAmount))}
                      </span>
                    </td>
                    <td colSpan={4} />
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* ── Reconcile action bar ── */}
      {reconcileMode && selectedTxnList.length > 0 && (
        <div className="bg-[#1B4F8A] text-white rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2 shadow-lg">
          <span className="text-sm font-medium">
            {selectedTxnList.length} payment{selectedTxnList.length > 1 ? 's' : ''} selected ·
            Total ₹{fmt(selectedTxnTotal)}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelTxns({})}
              className="px-3 py-1.5 text-sm rounded-lg border border-white/40 hover:bg-white/10">Clear</button>
            <button onClick={() => setMatchOpen(true)}
              className="px-4 py-1.5 text-sm rounded-lg bg-white text-[#1B4F8A] font-semibold hover:bg-blue-50">
              Match to bills →
            </button>
          </div>
        </div>
      )}

      {matchOpen && (
        <MatchGroupModal
          txns={selectedTxnList}
          bankTotal={selectedTxnTotal}
          onClose={() => setMatchOpen(false)}
          onDone={() => { setMatchOpen(false); setSelTxns({}); setReconcileMode(false); load(); }}
        />
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
            ← Prev
          </button>
          <span className="text-sm text-gray-600 px-3">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Match-group modal: pick a supplier's open bills, post the difference ───────
interface OpenBill { id: string; grnNumber: string | null; invoiceNumber: string | null; invoiceDate: string; balance: number; }
function MatchGroupModal({ txns, bankTotal, onClose, onDone }: {
  txns: Txn[]; bankTotal: number; onClose: () => void; onDone: () => void;
}) {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [bills, setBills] = useState<OpenBill[]>([]);
  const [selBills, setSelBills] = useState<Record<string, OpenBill>>({});
  const [reason, setReason] = useState('');
  const [loadingBills, setLoadingBills] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);

  useEffect(() => {
    // Pre-select supplier if all txns share one
    const sids = Array.from(new Set(txns.map(t => t.supplierPayment?.supplier?.name).filter(Boolean)));
    api.get('/suppliers?limit=500').then(r => {
      const list = (r.data?.data ?? r.data ?? []).map((s: any) => ({ id: s.id, name: s.name }));
      setSuppliers(list);
      if (sids.length === 1) { const m = list.find((s: any) => s.name === sids[0]); if (m) setSupplierId(m.id); }
    });
  }, []);

  useEffect(() => {
    if (!supplierId) { setBills([]); setSelBills({}); setSuggestion(null); return; }
    setLoadingBills(true);
    api.get(`/bank/open-payables?supplierId=${supplierId}`)
      .then(r => setBills(r.data))
      .finally(() => setLoadingBills(false));
    // Fetch smart suggestion for the bank total
    api.get(`/bank/match-suggestions?supplierId=${supplierId}&amount=${bankTotal}`)
      .then(r => setSuggestion(r.data?.suggestion ?? null))
      .catch(() => setSuggestion(null));
  }, [supplierId]);

  function applySuggestion() {
    if (!suggestion) return;
    const picked: Record<string, OpenBill> = {};
    for (const b of suggestion.bills) picked[b.id] = b;
    setSelBills(picked);
    if (suggestion.suggestedReason) setReason(suggestion.suggestedReason);
  }

  function toggleBill(b: OpenBill) {
    setSelBills(prev => { const n = { ...prev }; if (n[b.id]) delete n[b.id]; else n[b.id] = b; return n; });
  }

  const billList = Object.values(selBills);
  const billsTotal = billList.reduce((s, b) => s + b.balance, 0);
  const diff = Math.round((bankTotal - billsTotal) * 100) / 100;
  const needsReason = Math.abs(diff) > 0.01;

  async function submit() {
    if (billList.length === 0) { toast.error('Select at least one bill'); return; }
    if (needsReason && !reason) { toast.error('Choose a reason for the difference'); return; }
    setSaving(true);
    try {
      const res = await api.post('/bank/match-group', {
        bankTransactionIds: txns.map(t => t.id),
        grnIds: billList.map(b => b.id),
        adjustmentReason: needsReason ? reason : null,
      });
      toast.success(`Matched ${res.data.txnsMatched} payment(s) to ${res.data.billsSettled} bill(s)`);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Match failed');
    } finally { setSaving(false); }
  }

  const inr = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-800">Match {txns.length} payment(s) → bills</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Supplier</label>
            <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setSelBills({}); }}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {suggestion && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
              <span className="text-base leading-none">✨</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-indigo-800">
                  Suggested: settle {suggestion.bills.length} bill{suggestion.bills.length > 1 ? 's' : ''} (₹{inr(suggestion.billsTotal)})
                  {suggestion.exact
                    ? ' — exact match'
                    : ` · diff ${suggestion.difference > 0 ? '+' : ''}₹${inr(suggestion.difference)} (${ADJ_REASONS.find(r => r.value === suggestion.suggestedReason)?.label ?? 'adjust'})`}
                </p>
                <p className="text-[11px] text-indigo-600 mt-0.5 truncate">
                  {suggestion.bills.map((b: any) => b.grnNumber ?? b.invoiceNumber).join(', ')}
                </p>
              </div>
              <button onClick={applySuggestion}
                className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 shrink-0">
                Apply
              </button>
            </div>
          )}

          {supplierId && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Open bills (tick to settle)</label>
              {loadingBills ? <p className="text-sm text-gray-400">Loading…</p>
                : bills.length === 0 ? <p className="text-sm text-gray-400">No open bills for this supplier.</p>
                : <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                    {bills.map(b => (
                      <label key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={!!selBills[b.id]} onChange={() => toggleBill(b)}
                          className="w-4 h-4 accent-[#1B4F8A]" />
                        <span className="flex-1">
                          <span className="font-medium text-gray-700">{b.grnNumber ?? b.invoiceNumber}</span>
                          {b.invoiceNumber && b.grnNumber && <span className="text-gray-400"> · {b.invoiceNumber}</span>}
                          <span className="text-gray-400 text-xs ml-1">{new Date(b.invoiceDate).toLocaleDateString('en-IN')}</span>
                        </span>
                        <span className="font-semibold text-red-600">₹{inr(b.balance)}</span>
                      </label>
                    ))}
                  </div>}
            </div>
          )}

          {/* Difference summary */}
          <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Bank payments</span><span className="font-medium">₹{inr(bankTotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bills selected</span><span className="font-medium">₹{inr(billsTotal)}</span></div>
            <div className={`flex justify-between font-semibold ${needsReason ? 'text-amber-700' : 'text-green-700'}`}>
              <span>Difference</span>
              <span>{diff === 0 ? '₹0.00 — exact' : `${diff > 0 ? '+' : ''}₹${inr(diff)}`}</span>
            </div>
          </div>

          {needsReason && (
            <div>
              <label className="text-xs font-medium text-amber-700 block mb-1">Reason for difference *</label>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Choose reason…</option>
                {ADJ_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Bills are cleared in full; the {diff > 0 ? 'extra' : 'shortfall'} of ₹{inr(Math.abs(diff))} is recorded as {reason ? ADJ_REASONS.find(r=>r.value===reason)?.label : 'the chosen reason'}.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="flex-1 py-2 text-sm border rounded-xl hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || billList.length === 0}
            className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-50">
            {saving ? 'Matching…' : 'Confirm Match'}
          </button>
        </div>
      </div>
    </div>
  );
}

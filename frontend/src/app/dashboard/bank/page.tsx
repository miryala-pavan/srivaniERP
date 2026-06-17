'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, AlertCircle, Upload, ListOrdered, BookOpen, Plus, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { cleanDesc } from '@/lib/bank-utils';

interface BankAccount {
  id: string; accountName: string; bankName: string;
  accountNumber: string; accountType: string;
  currentBalance: number; isActive: boolean;
}
interface SupplierOut { id: string; name: string; outstanding: number; }
interface RecentTxn {
  id: string; txnDate: string; description: string; refNumber: string;
  debitAmount: number | null; creditAmount: number | null;
  txnType: string; matchStatus: string;
  bankAccount: { accountName: string };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

const TXN_LABELS: Record<string, { label: string; color: string }> = {
  SALES_PHONEPE:  { label: 'PhonePe',    color: 'text-purple-600 bg-purple-50' },
  SALES_PINELABS: { label: 'Pine Labs',  color: 'text-blue-600 bg-blue-50' },
  SALES_UPI:      { label: 'UPI Credit', color: 'text-green-600 bg-green-50' },
  CASH_DEPOSIT:   { label: 'Cash Dep',   color: 'text-emerald-600 bg-emerald-50' },
  SUPPLIER_PAYMENT:{ label: 'Supplier',  color: 'text-orange-600 bg-orange-50' },
  EXPENSE_RENT:   { label: 'Rent',       color: 'text-red-600 bg-red-50' },
  EXPENSE_OTHER:  { label: 'Expense',    color: 'text-red-500 bg-red-50' },
  UNCATEGORIZED:  { label: 'Unknown',    color: 'text-gray-500 bg-gray-100' },
};

export default function BankDashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState<{
    accounts: BankAccount[];
    recentTxns: RecentTxn[];
    supplierOutstanding: SupplierOut[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/bank/summary');
      const data = res.data;
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!summary) return null;

  const totalBalance = summary.accounts.reduce((s, a) => s + Number(a.currentBalance), 0);
  const totalOutstanding = summary.supplierOutstanding.reduce((s, x) => s + x.outstanding, 0);

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" /> Bank &amp; Accounts
        </h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/dashboard/bank/accounts')}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Add Account
          </button>
          <button onClick={load}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Upload Statement', icon: Upload, href: '/dashboard/bank/accounts', color: 'bg-blue-600' },
          { label: 'Transactions',     icon: ListOrdered, href: '/dashboard/bank/transactions', color: 'bg-indigo-600' },
          { label: 'Supplier Ledger',  icon: BookOpen, href: '/dashboard/bank/supplier-ledger', color: 'bg-orange-600' },
          { label: 'Bank Accounts',    icon: Building2, href: '/dashboard/bank/accounts', color: 'bg-gray-700' },
        ].map(q => (
          <button key={q.label} onClick={() => router.push(q.href)}
            className={`${q.color} text-white rounded-xl p-4 flex flex-col items-center gap-2 hover:opacity-90 transition`}>
            <q.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Bank Balance</div>
          <div className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
            ₹{fmt(Math.abs(totalBalance))}
          </div>
          {totalBalance < 0 && <div className="text-xs text-red-500 mt-1">Overdraft (CC account)</div>}
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Supplier Outstanding</div>
          <div className="text-2xl font-bold text-orange-600">₹{fmt(totalOutstanding)}</div>
          <div className="text-xs text-gray-400 mt-1">{summary.supplierOutstanding.length} suppliers with dues</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Bank Accounts</div>
          <div className="text-2xl font-bold text-gray-800">{summary.accounts.length}</div>
          <div className="text-xs text-gray-400 mt-1">{summary.accounts.filter(a => a.isActive).length} active</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bank Accounts */}
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 text-sm">Bank Accounts</h2>
            <button onClick={() => router.push('/dashboard/bank/accounts')}
              className="text-xs text-blue-600 hover:underline">Manage →</button>
          </div>
          {summary.accounts.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              No bank accounts yet.{' '}
              <button onClick={() => router.push('/dashboard/bank/accounts')} className="text-blue-600 hover:underline">
                Add one
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {summary.accounts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{a.accountName}</div>
                    <div className="text-xs text-gray-500">{a.bankName} · {a.accountType}</div>
                    <div className="text-xs text-gray-400">A/c: ****{a.accountNumber.slice(-4)}</div>
                  </div>
                  <div className={`text-right font-bold ${Number(a.currentBalance) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{fmt(Math.abs(Number(a.currentBalance)))}
                    {Number(a.currentBalance) < 0 && <div className="text-xs font-normal text-red-400">OD</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supplier Outstanding */}
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-orange-500" /> Supplier Dues
            </h2>
            <button onClick={() => router.push('/dashboard/bank/supplier-ledger')}
              className="text-xs text-blue-600 hover:underline">Full Ledger →</button>
          </div>
          {summary.supplierOutstanding.length === 0 ? (
            <div className="text-center py-6 text-green-500 text-sm">✓ No outstanding dues</div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {summary.supplierOutstanding.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{s.name}</span>
                  <span className="font-semibold text-orange-600 ml-2 whitespace-nowrap">
                    ₹{fmt(s.outstanding)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700 text-sm">Recent Transactions</h2>
          <button onClick={() => router.push('/dashboard/bank/transactions')}
            className="text-xs text-blue-600 hover:underline">View all →</button>
        </div>
        {summary.recentTxns.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No transactions yet. Upload a bank statement to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left py-1.5 pr-2">Date</th>
                  <th className="text-left py-1.5 pr-2">Description</th>
                  <th className="text-left py-1.5 pr-2">Type</th>
                  <th className="text-right py-1.5 pr-2 text-red-500">Debit</th>
                  <th className="text-right py-1.5 text-green-600">Credit</th>
                  <th className="text-left py-1.5 pl-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentTxns.map(t => {
                  const lbl = TXN_LABELS[t.txnType] ?? TXN_LABELS.UNCATEGORIZED;
                  return (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-gray-500">{fmtDate(t.txnDate)}</td>
                      <td className="py-1.5 pr-2 max-w-xs truncate text-gray-700">
                        {cleanDesc(t.description, t.refNumber)}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${lbl.color}`}>{lbl.label}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-red-600 font-medium">
                        {t.debitAmount ? `₹${fmt(t.debitAmount)}` : ''}
                      </td>
                      <td className="py-1.5 text-right text-green-600 font-medium">
                        {t.creditAmount ? `₹${fmt(t.creditAmount)}` : ''}
                      </td>
                      <td className="py-1.5 pl-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          t.matchStatus === 'MATCHED' ? 'bg-green-100 text-green-700' :
                          t.matchStatus === 'IGNORED' ? 'bg-gray-100 text-gray-500' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {t.matchStatus === 'MATCHED' ? '✓ Matched' :
                           t.matchStatus === 'IGNORED' ? 'Ignored' : 'Unmatched'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

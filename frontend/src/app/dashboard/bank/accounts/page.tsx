'use client';
import { useEffect, useState } from 'react';
import { Building2, Plus, Upload, CheckCircle, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface BankAccount {
  id: string; accountName: string; bankName: string;
  accountNumber: string; accountType: string; ifscCode: string;
  branchName: string; openingBalance: number; currentBalance: number; isActive: boolean;
}

const BANKS = ['State Bank of India', 'IDBI Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Other'];
const TYPES = [
  { value: 'CURRENT',  label: 'Current Account' },
  { value: 'SAVINGS',  label: 'Savings Account' },
  { value: 'CC',       label: 'Cash Credit (Overdraft)' },
  { value: 'OD',       label: 'Overdraft' },
];

const EMPTY = {
  accountName: '', bankName: 'State Bank of India', accountNumber: '',
  accountType: 'CURRENT', ifscCode: '', branchName: '', openingBalance: 0,
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

export default function BankAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts]         = useState<BankAccount[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY });
  const [saving, setSaving]             = useState(false);
  const [uploadFor, setUploadFor]       = useState<BankAccount | null>(null);
  const [uploadFile, setUploadFile]     = useState<File | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [toast, setToast]               = useState('');
  const [importResult, setImportResult] = useState<{
    txnCount: number; period: string; totalCredits: number;
    totalDebits: number; importId: string;
  } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await api.get('/bank/accounts');
    setAccounts(res.data);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function saveAccount() {
    if (!form.accountName || !form.bankName || !form.accountNumber) {
      showToast('Please fill account name, bank name and account number'); return;
    }
    setSaving(true);
    try {
      await api.post('/bank/accounts', form);
      setForm({ ...EMPTY });
      setShowForm(false);
      await load();
      showToast('Bank account added ✓');
    } finally { setSaving(false); }
  }

  async function uploadStatement() {
    if (!uploadFile || !uploadFor) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('bankAccountId', uploadFor.id);
      const res = await api.post('/bank/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadFor(null);
      setUploadFile(null);
      await load();
      setImportResult(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Import failed';
      if (msg.toLowerCase().includes('already imported')) {
        setUploadFor(null);
        setUploadFile(null);
        showToast('This statement was already imported. Click "View Transactions" to see the data.');
      } else {
        showToast(`Error: ${msg}`);
      }
    } finally { setUploading(false); }
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
          toast.toLowerCase().includes('error') || toast.toLowerCase().includes('fail')
            ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
        }`}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" /> Bank Accounts
        </h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> Add Account
        </button>
      </div>

      {/* Add Account Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">New Bank Account</h2>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account Nickname *</label>
              <input value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                placeholder="e.g. SBI CC Account" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bank Name *</label>
              <select value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account Number *</label>
              <input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder="00000036709678689" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account Type</label>
              <select value={form.accountType} onChange={e => setForm(f => ({ ...f, accountType: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">IFSC Code</label>
              <input value={form.ifscCode} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                placeholder="SBIN0003478" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Branch</label>
              <input value={form.branchName} onChange={e => setForm(f => ({ ...f, branchName: e.target.value }))}
                placeholder="Sangareddy" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Opening Balance (₹)</label>
              <input type="number" value={form.openingBalance}
                onChange={e => setForm(f => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))}
                placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-0.5">Enter negative for overdraft (e.g. -2206973)</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={saveAccount} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Account'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      {accounts.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bank accounts added yet.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-blue-600 text-sm hover:underline">
            Add your first bank account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(a => (
            <div key={a.id} className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{a.accountName}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {TYPES.find(t => t.value === a.accountType)?.label ?? a.accountType}
                    </span>
                    {!a.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactive</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{a.bankName} · {a.branchName}</div>
                  <div className="text-xs text-gray-400 font-mono">A/c: {a.accountNumber}</div>
                  {a.ifscCode && <div className="text-xs text-gray-400">IFSC: {a.ifscCode}</div>}
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${Number(a.currentBalance) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {Number(a.currentBalance) < 0 ? '-' : ''}₹{fmt(Math.abs(Number(a.currentBalance)))}
                  </div>
                  {Number(a.currentBalance) < 0 && <div className="text-xs text-red-400">Overdraft</div>}
                </div>
              </div>
              {/* Action buttons row */}
              <div className="flex gap-2 pt-1 border-t">
                <button
                  onClick={() => router.push(`/dashboard/bank/transactions?bankAccountId=${a.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 border rounded-lg text-sm hover:bg-gray-100">
                  <ArrowRight className="w-3.5 h-3.5" /> View Transactions
                </button>
                <button
                  onClick={() => setUploadFor(a)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100">
                  <Upload className="w-3.5 h-3.5" /> Upload Statement
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Statement Modal */}
      {uploadFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Upload Statement</h2>
              <button onClick={() => { setUploadFor(null); setUploadFile(null); }}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Account: <strong>{uploadFor.accountName}</strong> · {uploadFor.bankName}
            </div>
            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <strong>Supported formats:</strong><br/>
              • <strong>SBI</strong>: Download .xls from NetBanking → Account Statement → Export<br/>
              • <strong>IDBI</strong>: Download PDF from NetBanking → Statement of Account<br/>
              System auto-detects the bank from the file.
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Select Statement File (.xls)</label>
              <input type="file" accept=".xls,.xlsx,.txt,.csv,.pdf"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-blue-600 file:text-white file:rounded-lg file:cursor-pointer" />
              {uploadFile && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" /> {uploadFile.name}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={uploadStatement} disabled={!uploadFile || uploading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {uploading ? 'Importing...' : 'Import Statement'}
              </button>
              <button onClick={() => { setUploadFor(null); setUploadFile(null); }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Import Successful!</h2>
                <p className="text-sm text-gray-500">{importResult.period}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-gray-800">{importResult.txnCount}</div>
                <div className="text-xs text-gray-500 mt-0.5">Transactions</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-lg font-bold text-green-700">
                  ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(importResult.totalCredits)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Total Credits</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <div className="text-lg font-bold text-red-700">
                  ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(importResult.totalDebits)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Total Debits</div>
              </div>
            </div>

            <p className="text-sm text-gray-600 bg-blue-50 rounded-lg px-4 py-2">
              Supplier payments have been auto-matched where amounts exactly match open GRNs.
              Unmatched entries are flagged for your review.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setImportResult(null); router.push('/dashboard/bank/transactions'); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
                View Transactions <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setImportResult(null)}
                className="px-4 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

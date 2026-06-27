'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search, Edit2, Phone, Mail, MapPin, X, Check, AlertTriangle, Ban, Merge } from 'lucide-react';
import { toTitleCase, cleanSpaces, formatPhoneDisplay, validatePhone, validateGSTIN } from '@/lib/input-utils';
import { FieldHelp } from '@/components/ui/FieldHelp';
import { useFormAutosave } from '@/hooks/useFormAutosave';
import { RestoreBanner } from '@/components/ui/RestoreBanner';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { broadcastERP } from '@/hooks/useERPBroadcast';
import { openInNewWindow } from '@/lib/new-window';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { EntityLink } from '@/components/shared/EntityLink';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { BarcodeScannerInput } from '@/components/shared/BarcodeScannerInput';

interface Supplier {
  id: string;
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  stateCode?: string;
  paymentTermsDays: number;
  creditLimit: number | string;
  balanceDue?: number;
  openingBalance?: number | string;
  openingBalanceType?: string;
  openingBalanceDate?: string | null;
  openingBalanceNote?: string | null;
  isGstRegistered: boolean;
  isActive: boolean;
  supplierType?: string;
  bankAccountNumber?: string | null;
  bankIfscCode?: string | null;
  bankBankName?: string | null;
  bankBranchName?: string | null;
  bankAccounts?: BankAcc[];
}

interface BankAcc {
  id: string;
  accountNumber: string;
  bankName: string;
  branchName?: string | null;
  ifscCode?: string | null;
  isPrimary: boolean;
}

const EMPTY_BANK = { accountNumber: '', bankName: '', branchName: '', ifscCode: '', isPrimary: true };

const VENDOR_TYPE_META: Record<string, { label: string; color: string; accounting: string }> = {
  SUPPLIER:  { label: 'Supplier',          color: 'bg-blue-100 text-blue-700',    accounting: 'Trade Payable (AP)'      },
  LOAN:      { label: 'Bank / Lender',     color: 'bg-purple-100 text-purple-700', accounting: 'Loan / Liability'        },
  RENT:      { label: 'Landlord / Rent',   color: 'bg-orange-100 text-orange-700', accounting: 'Rent Expense'            },
  SERVICE:   { label: 'Service Provider',  color: 'bg-teal-100 text-teal-700',    accounting: 'Operating Expense'       },
  EXPENSE:   { label: 'One-time / Expense',color: 'bg-amber-100 text-amber-700',  accounting: 'Direct Expense'          },
  ONE_TIME:  { label: 'One-time Vendor',   color: 'bg-gray-100 text-gray-600',    accounting: 'Direct Expense'          },
  OTHER:     { label: 'Other',             color: 'bg-gray-100 text-gray-500',    accounting: 'Other Payable'           },
};

const EMPTY_FORM = {
  name: '',
  gstin: '',
  phone: '',
  email: '',
  address: '',
  stateCode: '36',
  paymentTermsDays: 0,
  creditLimit: 0,
  isGstRegistered: true,
  supplierType: 'SUPPLIER',
  openingBalance: 0,
  openingBalanceType: 'DEBIT',
  openingBalanceDate: '',
  openingBalanceNote: '',
};

export default function SuppliersPage() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const { connected } = useWebSocket();

  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [mergeSource, setMergeSource] = useState<{ id: string; name: string } | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [merging, setMerging] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [bankDupeHint, setBankDupeHint] = useState<{ supplierId: string; supplierName: string; bankName: string } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Supplier | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [showRestore, setShowRestore] = useState(false);

  // Bank accounts manager state
  const [bankAccounts, setBankAccounts] = useState<BankAcc[]>([]);
  const [bankForm, setBankForm]         = useState({ ...EMPTY_BANK });
  const [addingBank, setAddingBank]     = useState(false);
  const [savingBank, setSavingBank]     = useState(false);

  const autosave = useFormAutosave('supplier', form, { enabled: showModal && editing === null });

  useEscapeKey(() => setShowModal(false), showModal);

  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('erp:new', handler);
    return () => window.removeEventListener('erp:new', handler);
  }, []);

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedSearch(val), 350);
  };

  // ── Query ──────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', { page, search: debouncedSearch, showInactive, typeFilter }],
    queryFn:  async () => {
      const res = await api.get('/suppliers', {
        params: { page, limit: 50, search: debouncedSearch || undefined, isActive: showInactive ? 'all' : undefined, supplierType: typeFilter || undefined },
      });
      return res.data as { data: Supplier[]; meta: { totalPages: number; total: number } };
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (s: Supplier) => api.patch(`/suppliers/${s.id}/active`, { isActive: !s.isActive }),
    onSuccess: (_res, s) => {
      toast.success(s.isActive ? 'Supplier deactivated' : 'Supplier reactivated');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update supplier'),
  });

  const suppliers  = data?.data ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const total      = data?.meta.total ?? 0;

  // Duplicates query — only fetched when panel is opened
  const { data: dupData, isLoading: dupLoading, refetch: refetchDups } = useQuery({
    queryKey: ['supplier-duplicates'],
    queryFn: () => api.get('/suppliers/find-duplicates').then(r => r.data),
    enabled: showDuplicates,
    staleTime: 60_000,
  });

  // Real-time bank account duplicate check
  useEffect(() => {
    setBankDupeHint(null);
    const acct = bankForm.accountNumber.trim();
    if (acct.length < 4) return;
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/suppliers/bank-accounts/check-duplicate', {
          params: { accountNumber: acct, excludeSupplierId: editing?.id },
        });
        if (res.data) setBankDupeHint(res.data);
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [bankForm.accountNumber, editing?.id]);

  // ── WS listeners ──────────────────────────────────────
  useWebSocketEvent('supplier.payment-recorded', () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }));
  useWebSocketEvent('supplier.payment-deleted',  () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }));
  useWebSocketEvent('grn.approved',              () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }));

  // ── Mutation ──────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name:              form.name.trim(),
        gstin:             form.gstin.trim() || undefined,
        phone:             form.phone.trim() || undefined,
        email:             form.email.trim() || undefined,
        address:           form.address.trim() || undefined,
        stateCode:         form.stateCode.trim() || undefined,
        paymentTermsDays:  Number(form.paymentTermsDays),
        creditLimit:       Number(form.creditLimit),
        isGstRegistered:   form.isGstRegistered,
        supplierType:      form.supplierType,
      };
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, payload);
        if (Number(form.openingBalance) > 0 || editing.openingBalance) {
          await api.patch(`/suppliers/${editing.id}/opening-balance`, {
            openingBalance:     Number(form.openingBalance),
            openingBalanceType: form.openingBalanceType,
            openingBalanceDate: form.openingBalanceDate || undefined,
            openingBalanceNote: form.openingBalanceNote || undefined,
          });
        }
        return { action: 'edit' as const };
      } else {
        const res = await api.post('/suppliers', payload);
        if (bankForm.accountNumber.trim()) {
          await api.post(`/suppliers/${res.data.id}/bank-accounts`, {
            accountNumber: bankForm.accountNumber.trim(),
            bankName:      bankForm.bankName.trim() || 'Unknown',
            branchName:    bankForm.branchName.trim() || undefined,
            ifscCode:      bankForm.ifscCode.trim() || undefined,
            isPrimary:     true,
          });
        }
        if (Number(form.openingBalance) > 0) {
          await api.patch(`/suppliers/${res.data.id}/opening-balance`, {
            openingBalance:     Number(form.openingBalance),
            openingBalanceType: form.openingBalanceType,
            openingBalanceDate: form.openingBalanceDate || undefined,
            openingBalanceNote: form.openingBalanceNote || undefined,
          });
        }
        broadcastERP({ type: 'SUPPLIER_ADDED', id: res.data?.id, name: res.data?.name ?? form.name });
        autosave.clearSaved();
        return { action: 'add' as const };
      }
    },
    onSuccess: ({ action }) => {
      toast.success(action === 'edit' ? 'Supplier updated' : 'Supplier added');
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    },
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setBankAccounts([]);
    setBankForm({ ...EMPTY_BANK });
    setAddingBank(false);
    setPhoneError(null);
    setEmailError(false);
    setShowRestore(autosave.hasSaved());
    setShowModal(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setPhoneError(null);
    setEmailError(false);
    setBankAccounts([]);
    setBankForm({ ...EMPTY_BANK });
    setAddingBank(false);
    setForm({
      name:                s.name,
      gstin:               s.gstin ?? '',
      phone:               s.phone ?? '',
      email:               s.email ?? '',
      address:             s.address ?? '',
      stateCode:           s.stateCode ?? '36',
      paymentTermsDays:    s.paymentTermsDays,
      creditLimit:         Number(s.creditLimit),
      isGstRegistered:     s.isGstRegistered,
      supplierType:        s.supplierType ?? 'SUPPLIER',
      openingBalance:      Number(s.openingBalance ?? 0),
      openingBalanceType:  s.openingBalanceType ?? 'DEBIT',
      openingBalanceDate:  s.openingBalanceDate ? s.openingBalanceDate.slice(0, 10) : '',
      openingBalanceNote:  s.openingBalanceNote ?? '',
    });
    setShowModal(true);
    api.get(`/suppliers/${s.id}/bank-accounts`).then(r => setBankAccounts(r.data)).catch(() => {});
  }

  function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    saveMutation.mutate();
  }

  async function executeMerge() {
    if (!mergeSource || !mergeTarget) return;
    if (!confirm(`Merge "${mergeSource.name}" INTO the selected supplier?\n\nAll purchases, payments and advances from "${mergeSource.name}" will move to the target. "${mergeSource.name}" will be deactivated. This cannot be undone.`)) return;
    setMerging(true);
    try {
      await api.post(`/suppliers/${mergeSource.id}/merge-into/${mergeTarget}`);
      toast.success('Suppliers merged successfully');
      setMergeSource(null);
      setMergeTarget('');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Merge failed');
    } finally {
      setMerging(false);
    }
  }

  const fmt = (n: number | string) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n));

  return (
    <>
      <Header
        title="Suppliers"
        actions={
          <span className={`text-xs font-mono px-2 py-1 rounded ${connected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        }
      />
      <main className="flex-1 p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <BarcodeScannerInput
            value={search} onChange={handleSearch}
            placeholder="Search name, phone, GSTIN or scan…"
            className="flex-1 max-w-xs"
          />
          {/* Vendor type filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-600 focus:outline-none focus:border-[#1B4F8A]"
          >
            <option value="">All types</option>
            {Object.entries(VENDOR_TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none"
            title="Include deactivated vendors in the list">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-[#1B4F8A] focus:ring-[#1B4F8A]"
            />
            Show inactive
          </label>
          <span className="text-sm text-gray-400 ml-auto">{total} vendor{total !== 1 ? 's' : ''}</span>
          <button
            onClick={() => { setShowDuplicates(true); refetchDups(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
          >
            <Merge className="w-3.5 h-3.5" /> Find Duplicates
          </button>
          <button
            onClick={() => openInNewWindow('/dashboard/suppliers/import-bank-accounts')}
            className="flex items-center gap-1.5 border border-[#1B4F8A] text-[#1B4F8A] text-sm font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Import Bank Accounts
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No suppliers found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">GSTIN</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Bank A/c</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Outstanding</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Credit Limit</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((s) => {
                  const balance     = s.balanceDue ?? 0;
                  const limit       = Number(s.creditLimit);
                  const overLimit   = limit > 0 && balance > limit;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <EntityLink type="supplier" id={s.id} className="font-medium">
                            {s.name}
                          </EntityLink>
                          {!s.isActive && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                              Inactive
                            </span>
                          )}
                        </span>
                        {s.address && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {s.address}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {(() => {
                          const t = s.supplierType ?? 'SUPPLIER';
                          const m = VENDOR_TYPE_META[t] ?? VENDOR_TYPE_META['OTHER'];
                          return (
                            <div>
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
                              <p className="text-[10px] text-gray-400 mt-0.5">{m.accounting}</p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-0.5">
                          {s.phone && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" /> {s.phone}
                            </p>
                          )}
                          {s.email && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" /> {s.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-xs font-mono text-gray-600">{s.gstin ?? '—'}</p>
                        <p className="text-xs text-gray-400">{s.paymentTermsDays}d terms</p>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {(() => {
                          const primary = (s as any).bankAccounts?.[0];
                          const accNo   = primary?.accountNumber ?? s.bankAccountNumber;
                          const bank    = primary?.bankName ?? s.bankBankName;
                          const ifsc    = primary?.ifscCode ?? s.bankIfscCode;
                          return accNo ? (
                            <div>
                              <p className="text-xs font-mono text-gray-700">****{accNo.slice(-4)}</p>
                              <p className="text-xs text-gray-400">{bank ? `${bank}` : ifsc ?? ''}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-orange-400">⚠ Not set</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {balance > 0 ? (
                          <span className={`font-medium flex items-center justify-end gap-1 ${overLimit ? 'text-red-600' : 'text-red-600'}`}>
                            {overLimit && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                            Due: Rs.{fmt(balance)}
                          </span>
                        ) : balance < 0 ? (
                          <span className="font-medium text-green-600">Adv: Rs.{fmt(Math.abs(balance))}</span>
                        ) : (
                          <span className="text-gray-400">Settled</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right ${overLimit ? 'text-red-500' : 'text-gray-600'}`}>
                        Rs.{fmt(s.creditLimit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openInNewWindow(`/dashboard/suppliers?id=${s.id}`)}
                            title="Open in new window"
                            className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors text-sm leading-none"
                          >
                            ↗
                          </button>
                          <button
                            onClick={() => { setMergeSource({ id: s.id, name: s.name }); setMergeTarget(''); }}
                            title="Merge duplicate into another vendor"
                            className="p-1.5 rounded-lg text-gray-300 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Merge className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const msg = s.isActive
                                ? `Deactivate "${s.name}"?\n\nIt will be hidden from search and new GRNs can't be created against it. You can reactivate later.`
                                : `Reactivate "${s.name}"?`;
                              if (confirm(msg)) toggleActiveMutation.mutate(s);
                            }}
                            disabled={toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === s.id}
                            title={s.isActive ? 'Deactivate supplier' : 'Reactivate supplier'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              s.isActive
                                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                            }`}
                          >
                            {s.isActive ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                  p === page ? 'bg-[#1B4F8A] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1B4F8A]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
            {/* Sticky header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-base font-semibold text-gray-800">
                {editing ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6">
              {showRestore && !editing && (() => {
                const saved = autosave.getSaved();
                return saved ? (
                  <div className="mb-4">
                    <RestoreBanner
                      savedAt={saved.savedAt}
                      onRestore={() => { setForm(saved.data); setShowRestore(false); }}
                      onDiscard={() => { autosave.clearSaved(); setShowRestore(false); }}
                    />
                  </div>
                ) : null;
              })()}

              {/* ── Row 1: Name + Vendor Type ── */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="col-span-2 space-y-1">
                  <div className="flex items-center gap-0.5">
                    <label className="text-xs font-medium text-gray-600">Vendor Name *</label>
                    <FieldHelp title="Vendor Name" description="Enter the name exactly as registered. This appears on GRN documents and payment records." />
                  </div>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onBlur={(e) => setForm((f) => ({ ...f, name: toTitleCase(cleanSpaces(e.target.value)) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="Official name as per GST registration"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-0.5">
                    <label className="text-xs font-medium text-gray-600">Vendor Type</label>
                    <FieldHelp title="Vendor Type" description="Classify this vendor for accounting. Helps your CA categorize payables correctly in the books." example="Product suppliers → 'Supplier', banks → 'Bank / Lender', rent → 'Landlord / Rent'" />
                  </div>
                  <select
                    value={form.supplierType}
                    onChange={(e) => setForm({ ...form, supplierType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  >
                    {Object.entries(VENDOR_TYPE_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  {form.supplierType && VENDOR_TYPE_META[form.supplierType] && (
                    <p className="text-[10px] text-gray-400">{VENDOR_TYPE_META[form.supplierType].accounting}</p>
                  )}
                </div>
              </div>

              {/* ── Row 2: Phone | Email | GSTIN ── */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: formatPhoneDisplay(e.target.value) })}
                    onBlur={() => {
                      if (!form.phone) { setPhoneError(null); return; }
                      setPhoneError(validatePhone(form.phone) ? null : 'Must be 10 digits starting with 6–9');
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${phoneError ? 'border-red-400' : form.phone && validatePhone(form.phone) ? 'border-green-400' : 'border-gray-200 focus:border-[#1B4F8A]'}`}
                    placeholder="10-digit mobile"
                  />
                  {phoneError && <p className="text-xs text-red-500 mt-0.5">{phoneError}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    onBlur={() => setEmailError(!!form.email && !form.email.includes('@'))}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${emailError ? 'border-red-400' : 'border-gray-200 focus:border-[#1B4F8A]'}`}
                    placeholder="email@example.com"
                  />
                  {emailError && <p className="text-xs text-red-500 mt-0.5">Invalid email</p>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-0.5">
                    <label className="text-xs font-medium text-gray-600">GSTIN</label>
                    <FieldHelp title="GSTIN" description="Enter the supplier's GSTIN from their invoice. System auto-detects state and intrastate/interstate." example="Format: 36AAACH1529B1ZE" />
                  </div>
                  <input
                    value={form.gstin}
                    onChange={(e) => {
                      const g = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                      const r = g.length === 15 ? validateGSTIN(g) : null;
                      setForm((f) => ({ ...f, gstin: g, stateCode: r?.valid ? r.stateCode : f.stateCode }));
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none font-mono ${
                      form.gstin.length === 0 ? 'border-gray-200 focus:border-[#1B4F8A]'
                      : validateGSTIN(form.gstin).valid ? 'border-green-400'
                      : 'border-red-400'
                    }`}
                    placeholder="15-character GSTIN"
                    maxLength={15}
                  />
                  {form.gstin.length > 0 && (() => {
                    const r = validateGSTIN(form.gstin);
                    if (!r.valid) return <p className="text-xs text-red-500 mt-0.5">{r.message}</p>;
                    return (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.isInterstate ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {r.isInterstate ? 'INTERSTATE' : 'INTRASTATE'}
                        </span>
                        <span className="text-xs text-gray-400">{r.stateCode}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── Row 3: Address | State Code + Payment Terms + Credit Limit ── */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Address</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    onBlur={(e) => setForm((f) => ({ ...f, address: cleanSpaces(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] resize-none"
                    rows={3}
                    placeholder="Full address"
                  />
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-0.5">
                        <label className="text-xs font-medium text-gray-600">State Code</label>
                        <FieldHelp title="State Code" description="2-digit state code. Auto-filled from GSTIN. 36 = Telangana." />
                      </div>
                      {(() => {
                        const locked = form.gstin.length === 15 && validateGSTIN(form.gstin).valid;
                        return (
                          <input
                            value={form.stateCode}
                            onChange={(e) => !locked && setForm({ ...form, stateCode: e.target.value })}
                            readOnly={locked}
                            className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none ${locked ? 'bg-gray-50 text-gray-500 cursor-default' : 'focus:border-[#1B4F8A]'}`}
                            placeholder="36"
                            maxLength={2}
                          />
                        );
                      })()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-0.5">
                        <label className="text-xs font-medium text-gray-600">Payment Terms (days)</label>
                        <FieldHelp title="Payment Terms" description="Days to pay after receiving goods. 0 = cash on delivery." example="7, 14, 30, 45" />
                      </div>
                      <input
                        type="number"
                        value={form.paymentTermsDays}
                        onChange={(e) => setForm({ ...form, paymentTermsDays: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-0.5">
                      <label className="text-xs font-medium text-gray-600">Credit Limit (Rs.)</label>
                      <FieldHelp title="Credit Limit" description="Maximum outstanding allowed with this supplier at any time." />
                    </div>
                    <input
                      type="number"
                      value={form.creditLimit}
                      onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                      min={0}
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <div
                      onClick={() => setForm({ ...form, isGstRegistered: !form.isGstRegistered })}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.isGstRegistered ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isGstRegistered ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm text-gray-700">GST Registered</span>
                  </label>
                </div>
              </div>

              {/* ── Opening Balance ── */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Opening Balance</p>
                {editing && Number(editing.openingBalance) > 0 && (
                  <p className="text-xs text-blue-600 mb-2">
                    Current: Rs.{Number(editing.openingBalance).toFixed(2)} ({editing.openingBalanceType})
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Amount (Rs.)</label>
                    <input
                      type="number"
                      value={form.openingBalance}
                      onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                      min={0}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Type</label>
                    <select
                      value={form.openingBalanceType}
                      onChange={(e) => setForm({ ...form, openingBalanceType: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                    >
                      <option value="DEBIT">Debit (we owe them)</option>
                      <option value="CREDIT">Credit (they owe us)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">As of Date</label>
                    <input
                      type="date"
                      value={form.openingBalanceDate}
                      onChange={(e) => setForm({ ...form, openingBalanceDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-1 mt-3">
                  <label className="text-xs font-medium text-gray-600">Note</label>
                  <input
                    value={form.openingBalanceNote}
                    onChange={(e) => setForm({ ...form, openingBalanceNote: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                    placeholder="e.g. Balance carried from old books"
                  />
                </div>
              </div>
            </div>

            {/* ── Bank Accounts ── */}
            <div className="px-6 pb-4">
              <div className="border border-blue-100 rounded-xl bg-blue-50/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-800">🏦 Bank Accounts</span>
                    <span className="text-xs text-blue-500">(for NEFT payment matching)</span>
                  </div>
                  {!addingBank && (
                    <button
                      type="button"
                      onClick={() => setAddingBank(true)}
                      className="text-xs text-[#1B4F8A] font-medium hover:underline"
                    >
                      + Add Account
                    </button>
                  )}
                </div>

                {/* Existing accounts list */}
                {bankAccounts.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {bankAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-800">****{acc.accountNumber.slice(-4)}</p>
                          <p className="text-[11px] text-gray-500">{acc.bankName}{acc.branchName ? ` · ${acc.branchName}` : ''}{acc.ifscCode ? ` · ${acc.ifscCode}` : ''}</p>
                        </div>
                        {acc.isPrimary && (
                          <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded px-1.5 py-0.5 font-medium shrink-0">PRIMARY</span>
                        )}
                        {!acc.isPrimary && editing && (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.patch(`/suppliers/bank-accounts/${acc.id}`, { isPrimary: true });
                              const r = await api.get(`/suppliers/${editing.id}/bank-accounts`);
                              setBankAccounts(r.data);
                            }}
                            className="text-[11px] text-blue-600 hover:underline shrink-0"
                          >
                            Set primary
                          </button>
                        )}
                        {editing && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Remove this bank account?')) return;
                              await api.delete(`/suppliers/bank-accounts/${acc.id}`);
                              setBankAccounts(prev => prev.filter(a => a.id !== acc.id));
                            }}
                            className="text-[11px] text-red-400 hover:text-red-600 shrink-0 ml-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add account form (editing: saves immediately; new: saved after supplier create) */}
                {addingBank && (
                  <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Account Number *</label>
                        <input
                          value={bankForm.accountNumber}
                          onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value.trim() })}
                          className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none bg-white font-mono ${bankDupeHint ? 'border-amber-400 focus:border-amber-500' : 'border-gray-200 focus:border-[#1B4F8A]'}`}
                          placeholder="e.g. 10234567890"
                        />
                        {bankDupeHint && (
                          <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-800 font-medium">
                              This account already belongs to <span className="font-semibold">{bankDupeHint.supplierName}</span> ({bankDupeHint.bankName})
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setShowModal(false);
                                setMergeSource(editing ? { id: editing.id, name: editing.name } : null);
                                setMergeTarget(bankDupeHint.supplierId);
                                setBankDupeHint(null);
                              }}
                              className="mt-1.5 text-xs text-amber-700 underline hover:text-amber-900"
                            >
                              Merge this party into {bankDupeHint.supplierName} →
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">IFSC Code</label>
                        <input
                          value={bankForm.ifscCode}
                          onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value.trim().toUpperCase() })}
                          maxLength={11}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white font-mono uppercase"
                          placeholder="SBIN0001234"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Bank Name *</label>
                        <input
                          value={bankForm.bankName}
                          onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                          placeholder="SBI, HDFC, ICICI…"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Branch Name</label>
                        <input
                          value={bankForm.branchName}
                          onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                          placeholder="Srikakulam Main"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {editing ? (
                        <button
                          type="button"
                          disabled={savingBank}
                          onClick={async () => {
                            if (!bankForm.accountNumber.trim()) { toast.error('Account number required'); return; }
                            setSavingBank(true);
                            try {
                              await api.post(`/suppliers/${editing.id}/bank-accounts`, {
                                accountNumber: bankForm.accountNumber.trim(),
                                bankName:      bankForm.bankName.trim() || 'Unknown',
                                branchName:    bankForm.branchName.trim() || undefined,
                                ifscCode:      bankForm.ifscCode.trim() || undefined,
                                isPrimary:     bankAccounts.length === 0,
                              });
                              const r = await api.get(`/suppliers/${editing.id}/bank-accounts`);
                              setBankAccounts(r.data);
                              setBankForm({ ...EMPTY_BANK });
                              setAddingBank(false);
                              queryClient.invalidateQueries({ queryKey: ['suppliers'] });
                            } catch (e: any) {
                              toast.error(e?.response?.data?.message ?? 'Failed to save');
                            } finally {
                              setSavingBank(false);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-[#1B4F8A] text-white rounded-lg disabled:opacity-60"
                        >
                          {savingBank ? 'Saving…' : 'Save Account'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Will be saved when supplier is created</span>
                      )}
                      <button
                        type="button"
                        onClick={() => { setAddingBank(false); setBankForm({ ...EMPTY_BANK }); }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {bankAccounts.length === 0 && !addingBank && (
                  <p className="text-xs text-gray-400">No bank accounts added yet.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saveMutation.isPending}
                className="flex-1 py-2.5 text-sm font-medium bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Find Duplicates panel */}
      {showDuplicates && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDuplicates(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Duplicate Parties</h2>
                <p className="text-xs text-gray-500 mt-0.5">Detected by matching bank account numbers and similar names</p>
              </div>
              <button onClick={() => setShowDuplicates(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              {dupLoading && <p className="text-sm text-gray-400 text-center py-8">Scanning…</p>}
              {!dupLoading && dupData && (
                <>
                  {/* Bank account duplicates */}
                  {dupData.bankAccountDuplicates?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Same Bank Account Number</p>
                      <div className="space-y-3">
                        {dupData.bankAccountDuplicates.map((group: any, i: number) => (
                          <div key={i} className="border border-amber-200 rounded-xl p-3 bg-amber-50">
                            <p className="text-xs text-amber-700 font-medium mb-2">
                              Account ****{group.accountNumber.slice(-4)} · {group.bankName}
                            </p>
                            <div className="space-y-1.5">
                              {group.parties.map((p: any, j: number) => (
                                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                                  <div>
                                    <span className="text-sm font-medium text-gray-800">{p.name}</span>
                                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${VENDOR_TYPE_META[p.supplierType]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                                      {VENDOR_TYPE_META[p.supplierType]?.label ?? p.supplierType}
                                    </span>
                                    {!p.isActive && <span className="ml-1 text-[10px] text-gray-400">(inactive)</span>}
                                  </div>
                                  {j > 0 && (
                                    <button
                                      onClick={() => {
                                        setShowDuplicates(false);
                                        setMergeSource({ id: p.id, name: p.name });
                                        setMergeTarget(group.parties[0].id);
                                      }}
                                      className="text-xs text-amber-700 hover:text-amber-900 underline"
                                    >
                                      Merge into {group.parties[0].name}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Name duplicates */}
                  {dupData.nameDuplicates?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Similar Names</p>
                      <div className="space-y-3">
                        {dupData.nameDuplicates.map((group: any, i: number) => (
                          <div key={i} className="border border-blue-200 rounded-xl p-3 bg-blue-50">
                            <div className="space-y-1.5">
                              {group.parties.map((p: any, j: number) => (
                                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                                  <div>
                                    <span className="text-sm font-medium text-gray-800">{p.name}</span>
                                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${VENDOR_TYPE_META[p.supplierType]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                                      {VENDOR_TYPE_META[p.supplierType]?.label ?? p.supplierType}
                                    </span>
                                    {!p.isActive && <span className="ml-1 text-[10px] text-gray-400">(inactive)</span>}
                                  </div>
                                  {j > 0 && (
                                    <button
                                      onClick={() => {
                                        setShowDuplicates(false);
                                        setMergeSource({ id: p.id, name: p.name });
                                        setMergeTarget(group.parties[0].id);
                                      }}
                                      className="text-xs text-blue-700 hover:text-blue-900 underline"
                                    >
                                      Merge into {group.parties[0].name}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dupData.bankAccountDuplicates?.length === 0 && dupData.nameDuplicates?.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">No duplicates found.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge dialog */}
      {mergeSource && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setMergeSource(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Merge Vendor</h2>
            <p className="text-xs text-gray-500 mb-4">
              All purchases, payments and advances from <span className="font-semibold text-gray-700">{mergeSource.name}</span> will move to the target vendor.
              The source will be deactivated. This cannot be undone.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Source (will be deactivated)</label>
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">{mergeSource.name}</div>
              </div>
              <div className="flex items-center justify-center text-gray-400 text-xs">↓ merge into ↓</div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Keep (target vendor)</label>
                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                >
                  <option value="">— Select the vendor to keep —</option>
                  {suppliers.filter(s => s.id !== mergeSource.id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}{!s.isActive ? ' (inactive)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setMergeSource(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={executeMerge} disabled={!mergeTarget || merging}
                className="flex-1 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium">
                {merging ? 'Merging…' : 'Merge & Deactivate Source'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

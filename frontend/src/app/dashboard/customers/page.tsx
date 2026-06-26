'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Plus, Search, Edit2, Phone, AlertTriangle, X, Check,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { broadcastERP } from '@/hooks/useERPBroadcast';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { EntityLink } from '@/components/shared/EntityLink';
import {
  toTitleCase, cleanSpaces, formatPhoneDisplay,
  validatePhone, validateGSTIN,
} from '@/lib/input-utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { BarcodeScannerInput } from '@/components/shared/BarcodeScannerInput';

interface Customer {
  id: string;
  customerCode: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  customerType: string;
  channel: string;
  status: string;
  customerGroup: string | null;
  creditLimit: number | string;
  loyaltyPoints: number;
  openingBalance: number | string;
  outstandingBalance: number;
  isActive: boolean;
  isSystemDefault: boolean;
}

const EMPTY_FORM = {
  name:           '',
  phone:          '',
  email:          '',
  customerType:   'B2C',
  companyName:    '',
  gstin:          '',
  billingAddress: '',
  address:        '',
  creditLimit:    0,
  openingBalance: 0,
  whatsappOptIn:  false,
  smsOptIn:       false,
  emailOptIn:     false,
  status:         'ACTIVE',
};

// ── Badge helpers ────────────────────────────────────────────────────────────

function TypeBadge({ t }: { t: string }) {
  if (t === 'WALKIN') return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">Walk-in</span>;
  if (t === 'B2B')    return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">B2B</span>;
  return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">B2C</span>;
}

function ChannelBadge({ c }: { c: string }) {
  if (c === 'ONLINE') return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-teal-100 text-teal-700">Online</span>;
  if (c === 'BOTH')   return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">Both</span>;
  return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">POS</span>;
}

function StatusBadge({ s, isActive }: { s: string; isActive: boolean }) {
  if (!isActive || s === 'INACTIVE') return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">Inactive</span>;
  if (s === 'BLOCKED') return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-600">Blocked</span>;
  return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700">Active</span>;
}

// ── Toggle helper ────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${on ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const queryClient    = useQueryClient();
  const { connected }  = useWebSocket();

  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]                   = useState(1);
  const [showModal, setShowModal]         = useState(false);
  const [editing, setEditing]             = useState<Customer | null>(null);
  const [form, setForm]                   = useState({ ...EMPTY_FORM });
  const [phoneError, setPhoneError]       = useState<string | null>(null);
  const [emailError, setEmailError]       = useState(false);

  useEscapeKey(() => setShowModal(false), showModal);

  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('erp:new', handler);
    return () => window.removeEventListener('erp:new', handler);
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedSearch(val), 350);
  };

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { page, search: debouncedSearch }],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: { page, limit: 20, search: debouncedSearch || undefined },
      });
      return res.data as { data: Customer[]; meta: { totalPages: number; total: number } };
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const customers  = data?.data  ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const total      = data?.meta.total      ?? 0;

  // ── WS listeners ──────────────────────────────────────────────────────────

  useWebSocketEvent('customer.created',          () => queryClient.invalidateQueries({ queryKey: ['customers'] }));
  useWebSocketEvent('customer.updated',          () => queryClient.invalidateQueries({ queryKey: ['customers'] }));
  useWebSocketEvent('customer.payment-recorded', () => queryClient.invalidateQueries({ queryKey: ['customers'] }));
  useWebSocketEvent('customer.payment-deleted',  () => queryClient.invalidateQueries({ queryKey: ['customers'] }));
  useWebSocketEvent('bill.created',              () => queryClient.invalidateQueries({ queryKey: ['customers'] }));
  useWebSocketEvent('bill.voided',               () => queryClient.invalidateQueries({ queryKey: ['customers'] }));

  // ── Mutation ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.phone && !validatePhone(form.phone)) throw new Error('Invalid phone number');
      if (form.gstin && !validateGSTIN(form.gstin).valid) throw new Error('Invalid GSTIN format');

      const payload: Record<string, unknown> = {
        name:          form.name.trim(),
        phone:         form.phone || undefined,
        email:         form.email.trim() || undefined,
        customerType:  form.customerType,
        creditLimit:   Number(form.creditLimit),
        whatsappOptIn: form.whatsappOptIn,
        smsOptIn:      form.smsOptIn,
        emailOptIn:    form.emailOptIn,
        status:        form.status,
      };

      if (form.customerType === 'B2B') {
        payload.gstin          = form.gstin  || undefined;
        payload.companyName    = form.companyName.trim()    || undefined;
        payload.billingAddress = form.billingAddress.trim() || undefined;
      } else if (form.gstin) {
        payload.gstin = form.gstin;
      }

      if (form.address.trim()) payload.address = form.address.trim();

      if (editing) {
        await api.put(`/customers/${editing.id}`, payload);
        return { action: 'edit' as const };
      } else {
        payload.openingBalance = Number(form.openingBalance);
        const res = await api.post('/customers', payload);
        broadcastERP({ type: 'CUSTOMER_ADDED', id: res.data?.id, name: res.data?.name ?? form.name });
        return { action: 'add' as const };
      }
    },
    onSuccess: ({ action }) => {
      toast.success(action === 'edit' ? 'Customer updated' : 'Customer added');
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? e?.response?.data?.message ?? 'Save failed');
    },
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setPhoneError(null);
    setEmailError(false);
    setShowModal(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setPhoneError(null);
    setEmailError(false);
    setForm({
      ...EMPTY_FORM,
      name:         c.name,
      phone:        c.phone         ?? '',
      email:        c.email         ?? '',
      gstin:        c.gstin         ?? '',
      customerType: c.customerType,
      creditLimit:  Number(c.creditLimit),
      status:       c.status,
    });
    setShowModal(true);
  }

  function save() {
    if (!form.name.trim() && !form.phone) { toast.error('Name or phone is required'); return; }
    if (form.phone && !validatePhone(form.phone)) { toast.error('Invalid phone number'); return; }
    saveMutation.mutate();
  }

  const fmt = (n: number | string) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n));

  const showB2B = form.customerType === 'B2B';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Header
        title="Customers"
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
            placeholder="Search name, phone, code or scan…"
            className="flex-1 max-w-xs"
          />
          <span className="text-sm text-gray-400 ml-auto">
            {total} customer{total !== 1 ? 's' : ''}
          </span>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {search ? 'No customers match your search' : 'No customers yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium text-gray-500 w-10">#</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 w-20">Code</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Phone</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Type</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Channel</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-600">Outstanding</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-600 hidden xl:table-cell">Credit Limit</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Status</th>
                    <th className="px-3 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((c, idx) => {
                    const outstanding = Number(c.outstandingBalance ?? 0);
                    const limit       = Number(c.creditLimit);
                    const overLimit   = limit > 0 && outstanding > limit;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 text-gray-400 text-xs tabular-nums">
                          {(page - 1) * 20 + idx + 1}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-500">
                          {c.customerCode ?? '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <EntityLink type="customer" id={c.id} className="font-medium text-gray-800">
                              {c.name}
                            </EntityLink>
                            {c.isSystemDefault && (
                              <span className="text-[10px] text-gray-400">(system)</span>
                            )}
                          </div>
                          {c.email && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{c.email}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          {c.phone ? (
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />{c.phone}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <TypeBadge t={c.customerType} />
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <ChannelBadge c={c.channel} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          {outstanding > 0 ? (
                            <span className="font-medium text-red-600 flex items-center justify-end gap-1 text-xs">
                              {overLimit && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              Due: Rs.{fmt(outstanding)}
                            </span>
                          ) : outstanding < 0 ? (
                            <span className="font-medium text-green-600 text-xs">
                              Adv: Rs.{fmt(Math.abs(outstanding))}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Settled</span>
                          )}
                        </td>
                        <td className={`px-3 py-3 text-right hidden xl:table-cell text-xs ${overLimit ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                          {limit > 0 ? `Rs.${fmt(limit)}` : '—'}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <StatusBadge s={c.status} isActive={c.isActive} />
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => openEdit(c)}
                            disabled={c.isSystemDefault}
                            title={c.isSystemDefault ? 'System customer cannot be edited' : 'Edit customer'}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                  p === page
                    ? 'bg-[#1B4F8A] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1B4F8A]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-base font-semibold text-gray-800">
                {editing ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Phone + Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    Phone {!editing && '*'}
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: formatPhoneDisplay(e.target.value) })}
                    onBlur={() => {
                      if (!form.phone) { setPhoneError(null); return; }
                      setPhoneError(validatePhone(form.phone) ? null : 'Must be 10 digits starting 6–9');
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                      phoneError
                        ? 'border-red-400 focus:border-red-400'
                        : form.phone && validatePhone(form.phone)
                        ? 'border-green-400 focus:border-green-500'
                        : 'border-gray-200 focus:border-[#1B4F8A]'
                    }`}
                    placeholder="10-digit mobile"
                    maxLength={10}
                  />
                  {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onBlur={(e) => setForm((f) => ({ ...f, name: toTitleCase(cleanSpaces(e.target.value)) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="Customer name"
                  />
                </div>
              </div>

              {/* Customer Type toggle */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Customer Type</label>
                <div className="flex gap-2">
                  {(['B2C', 'B2B'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, customerType: t })}
                      className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                        form.customerType === t
                          ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4F8A]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={() => setEmailError(!!form.email && !form.email.includes('@'))}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                    emailError ? 'border-red-400' : 'border-gray-200 focus:border-[#1B4F8A]'
                  }`}
                  placeholder="email@example.com"
                />
                {emailError && <p className="text-xs text-red-500">Invalid email address</p>}
              </div>

              {/* B2B section */}
              {showB2B && (
                <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">B2B Details</p>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">GSTIN</label>
                    <input
                      value={form.gstin}
                      onChange={(e) => {
                        const g = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                        setForm((f) => ({ ...f, gstin: g }));
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none font-mono ${
                        form.gstin.length === 0
                          ? 'border-gray-200 focus:border-[#1B4F8A]'
                          : validateGSTIN(form.gstin).valid
                          ? 'border-green-400 focus:border-green-500'
                          : 'border-red-400 focus:border-red-400'
                      }`}
                      placeholder="15-character GSTIN"
                      maxLength={15}
                    />
                    {form.gstin.length > 0 && (() => {
                      const r = validateGSTIN(form.gstin);
                      if (!r.valid) return <p className="text-xs text-red-500 mt-0.5">{r.message}</p>;
                      return <p className="text-xs text-green-600 mt-0.5">Valid — State {r.stateCode}</p>;
                    })()}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Company Name</label>
                    <input
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                      placeholder="Registered company name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Billing Address</label>
                    <textarea
                      value={form.billingAddress}
                      onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white resize-none"
                      rows={2}
                      placeholder="GST billing address"
                    />
                  </div>
                </div>
              )}

              {/* GSTIN auto-detect (B2C mode) */}
              {!showB2B && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    GSTIN
                    <span className="ml-1 text-[11px] text-gray-400 font-normal">(auto-switches to B2B when valid)</span>
                  </label>
                  <input
                    value={form.gstin}
                    onChange={(e) => {
                      const g = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                      const r = g.length === 15 ? validateGSTIN(g) : null;
                      setForm((f) => ({
                        ...f,
                        gstin:        g,
                        customerType: r?.valid ? 'B2B' : f.customerType,
                      }));
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none font-mono ${
                      form.gstin.length === 0
                        ? 'border-gray-200 focus:border-[#1B4F8A]'
                        : validateGSTIN(form.gstin).valid
                        ? 'border-green-400 focus:border-green-500'
                        : 'border-red-400 focus:border-red-400'
                    }`}
                    placeholder="15-character GSTIN (optional)"
                    maxLength={15}
                  />
                  {form.gstin.length > 0 && !validateGSTIN(form.gstin).valid && (
                    <p className="text-xs text-red-500 mt-0.5">{(validateGSTIN(form.gstin) as any).message}</p>
                  )}
                </div>
              )}

              {/* Credit Limit + Opening Balance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    min={0}
                    placeholder="0"
                  />
                </div>
                {!editing && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Opening Balance (Rs.)</label>
                    <input
                      type="number"
                      value={form.openingBalance}
                      onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-gray-400">Amount customer already owes</p>
                  </div>
                )}
              </div>

              {/* Status (edit only) */}
              {editing && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}

              {/* Communication opt-ins */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Communication</p>
                {(
                  [
                    { key: 'whatsappOptIn', label: 'WhatsApp' },
                    { key: 'smsOptIn',      label: 'SMS' },
                    { key: 'emailOptIn',    label: 'Email' },
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <Toggle
                      on={(form as any)[key]}
                      onToggle={() => setForm({ ...form, [key]: !(form as any)[key] })}
                    />
                    <span className="text-sm text-gray-700">{label} opt-in</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-2xl">
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
                {saveMutation.isPending ? 'Saving...' : editing ? 'Update Customer' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

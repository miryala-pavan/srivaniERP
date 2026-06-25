'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Search, Edit2, KeyRound, Power, X, Eye, EyeOff, ChevronDown, AlertCircle } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import toast from 'react-hot-toast';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  counterId?: string;
  counterName?: string;
  lastLoginAt?: string;
  createdAt: string;
  createdByName?: string;
}

interface Counter { id: string; name: string; code: string }

type FilterTab = 'ALL' | 'BRANCH_MANAGER' | 'CASHIER' | 'PURCHASE_CHECKER' | 'VIEWER' | 'INACTIVE';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:      'Owner',
  BRANCH_MANAGER:   'Manager',
  CASHIER:          'Cashier',
  PURCHASE_CHECKER: 'Purchase Checker',
  ACCOUNTS_PERSON:  'Accounts',
  FLOOR_SUPERVISOR: 'Floor Supervisor',
  PACKING_STAFF:    'Repacking Staff',
  SALES_REP:        'Sales Rep',
  VIEWER:           'Viewer',
  CA:               'CA / Auditor',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:      'bg-blue-900 text-white',
  BRANCH_MANAGER:   'bg-blue-600 text-white',
  CASHIER:          'bg-green-600 text-white',
  PURCHASE_CHECKER: 'bg-orange-500 text-white',
  ACCOUNTS_PERSON:  'bg-purple-600 text-white',
  FLOOR_SUPERVISOR: 'bg-teal-600 text-white',
  PACKING_STAFF:    'bg-gray-500 text-white',
  SALES_REP:        'bg-pink-500 text-white',
  VIEWER:           'bg-gray-400 text-white',
  CA:               'bg-amber-700 text-white',
};

const CREATABLE_ROLES = [
  { value: 'BRANCH_MANAGER',   label: 'Manager' },
  { value: 'CASHIER',          label: 'Cashier' },
  { value: 'PURCHASE_CHECKER', label: 'Purchase Checker' },
  { value: 'ACCOUNTS_PERSON',  label: 'Accounts' },
  { value: 'FLOOR_SUPERVISOR', label: 'Floor Supervisor' },
  { value: 'PACKING_STAFF',    label: 'Repacking Staff' },
  { value: 'SALES_REP',        label: 'Sales Rep' },
  { value: 'VIEWER',           label: 'Viewer' },
  { value: 'CA',               label: 'CA / Auditor' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(iso?: string) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function cls(...args: (string | false | undefined)[]) {
  return args.filter(Boolean).join(' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cls('px-2 py-0.5 rounded-full text-xs font-semibold', ROLE_COLORS[role] ?? 'bg-gray-200 text-gray-700')}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function PinInput({
  label, value, onChange, placeholder,
}: {
  label: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const valid = /^\d{6}$/.test(value);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={placeholder ?? '6-digit PIN'}
          className={cls(
            'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 pr-10',
            value && !valid ? 'border-red-400' : 'border-gray-300',
          )}
        />
        <button type="button" onClick={() => setShow(p => !p)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex gap-1 mt-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={cls('h-1 flex-1 rounded-full', i < value.length ? 'bg-blue-500' : 'bg-gray-200')} />
          ))}
        </div>
      )}
      {value && !valid && <p className="text-xs text-red-500 mt-0.5">Must be exactly 6 digits</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers]       = useState<StaffUser[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');

  // ─── Modals ───────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd]         = useState(false);
  const [editUser, setEditUser]       = useState<StaffUser | null>(null);
  const [resetUser, setResetUser]     = useState<StaffUser | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<StaffUser | null>(null);
  const [saving, setSaving]           = useState(false);

  // ─── Add/Edit form state ─────────────────────────────────────────────────
  const [formFullName, setFormFullName]   = useState('');
  const [formUsername, setFormUsername]   = useState('');
  const [formRole, setFormRole]           = useState('CASHIER');
  const [formCounterId, setFormCounterId] = useState('');
  const [formPhone, setFormPhone]         = useState('');
  const [formEmail, setFormEmail]         = useState('');
  const [formPin, setFormPin]             = useState('');
  const [formPinConfirm, setFormPinConfirm] = useState('');

  // ─── Reset PIN form ───────────────────────────────────────────────────────
  const [resetPin, setResetPin]         = useState('');
  const [resetPinConfirm, setResetPinConfirm] = useState('');

  useEscapeKey(() => setDeactivateUser(null), !!deactivateUser);
  useEscapeKey(() => setResetUser(null), !!resetUser && !deactivateUser);
  useEscapeKey(closeModal, showAdd && !resetUser && !deactivateUser);

  // ─── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<StaffUser[]>('/users'),
      api.get<Counter[]>('/users/counters'),
    ]).then(([usersRes, countersRes]) => {
      setUsers(usersRes.data);
      setCounters(countersRes.data);
    }).catch(() => toast.error('Failed to load staff data'))
      .finally(() => setLoading(false));
  }, []);

  // ─── Derived stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    users.length,
    active:   users.filter(u => u.isActive).length,
    managers: users.filter(u => u.role === 'BRANCH_MANAGER' || u.role === 'SUPER_ADMIN').length,
    cashiers: users.filter(u => u.role === 'CASHIER').length,
  }), [users]);

  const filtered = useMemo(() => {
    let list = users;
    if (filterTab === 'INACTIVE') {
      list = list.filter(u => !u.isActive);
    } else if (filterTab !== 'ALL') {
      list = list.filter(u => u.role === filterTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
      );
    }
    return list;
  }, [users, filterTab, search]);

  // ─── Open add/edit modal ──────────────────────────────────────────────────
  function openAdd() {
    setEditUser(null);
    setFormFullName(''); setFormUsername(''); setFormRole('CASHIER');
    setFormCounterId(''); setFormPhone(''); setFormEmail('');
    setFormPin(''); setFormPinConfirm('');
    setShowAdd(true);
  }

  function openEdit(u: StaffUser) {
    setEditUser(u);
    setFormFullName(u.fullName);
    setFormUsername(u.username);
    setFormRole(u.role);
    setFormCounterId(u.counterId ?? '');
    setFormPhone(u.phone ?? '');
    setFormEmail(u.email ?? '');
    setFormPin(''); setFormPinConfirm('');
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false); setEditUser(null);
  }

  // ─── Save staff member ────────────────────────────────────────────────────
  async function saveStaff() {
    if (!formFullName.trim()) return toast.error('Full name is required');
    if (!editUser && !formUsername.trim()) return toast.error('Username is required');
    if (!editUser && !/^\d{6}$/.test(formPin)) return toast.error('PIN must be exactly 6 digits');
    if (!editUser && formPin !== formPinConfirm) return toast.error('PINs do not match');

    setSaving(true);
    try {
      if (editUser) {
        const body: Record<string, string> = { fullName: formFullName, role: formRole };
        if (formCounterId) body.counterId = formCounterId;
        if (formPhone)     body.phone     = formPhone;
        if (formEmail)     body.email     = formEmail;
        const res = await api.put<StaffUser>(`/users/${editUser.id}`, body);
        setUsers(prev => prev.map(u => u.id === editUser.id ? { ...res.data, isActive: res.data.status === 'ACTIVE' } : u));
        toast.success('Staff member updated');
      } else {
        const body: Record<string, string> = {
          fullName: formFullName, username: formUsername,
          pin: formPin, role: formRole,
        };
        if (formCounterId) body.counterId = formCounterId;
        if (formPhone)     body.phone     = formPhone;
        if (formEmail)     body.email     = formEmail;
        const res = await api.post<StaffUser>('/users', body);
        setUsers(prev => [...prev, { ...res.data, isActive: res.data.status === 'ACTIVE' }]);
        toast.success(`${formFullName} added successfully`);
      }
      closeModal();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  // ─── Reset PIN ────────────────────────────────────────────────────────────
  async function doResetPin() {
    if (!resetUser) return;
    if (!/^\d{6}$/.test(resetPin)) return toast.error('PIN must be exactly 6 digits');
    if (resetPin !== resetPinConfirm) return toast.error('PINs do not match');

    setSaving(true);
    try {
      await api.put(`/users/${resetUser.id}/reset-pin`, { newPin: resetPin });
      toast.success(`PIN reset for ${resetUser.fullName}`);
      setResetUser(null); setResetPin(''); setResetPinConfirm('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to reset PIN');
    } finally {
      setSaving(false);
    }
  }

  // ─── Toggle active ────────────────────────────────────────────────────────
  async function doToggleActive() {
    if (!deactivateUser) return;
    setSaving(true);
    try {
      const res = await api.put<{ isActive: boolean }>(`/users/${deactivateUser.id}/toggle-active`);
      setUsers(prev => prev.map(u =>
        u.id === deactivateUser.id
          ? { ...u, isActive: res.data.isActive, status: res.data.isActive ? 'ACTIVE' : 'INACTIVE' }
          : u,
      ));
      toast.success(`${deactivateUser.fullName} ${res.data.isActive ? 'activated' : 'deactivated'}`);
      setDeactivateUser(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'ALL',              label: 'All Staff' },
    { key: 'BRANCH_MANAGER',   label: 'Managers' },
    { key: 'CASHIER',          label: 'Cashiers' },
    { key: 'PURCHASE_CHECKER', label: 'Checkers' },
    { key: 'VIEWER',           label: 'Viewers' },
    { key: 'INACTIVE',         label: 'Inactive' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Staff Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage user accounts and access levels</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Staff',   value: stats.total,    color: 'text-gray-900' },
          { label: 'Active',        value: stats.active,   color: 'text-green-700' },
          { label: 'Managers',      value: stats.managers, color: 'text-blue-700' },
          { label: 'Cashiers',      value: stats.cashiers, color: 'text-purple-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Role tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setFilterTab(t.key)}
              className={cls(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                filterTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
            Loading staff...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No staff members found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Counter</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  {/* Name + avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cls(
                        'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                        u.isActive ? 'bg-blue-500' : 'bg-gray-300',
                      )}>
                        {initials(u.fullName)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.fullName}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  {/* Role */}
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  {/* Counter */}
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.counterName ?? (u.role === 'CASHIER' ? 'Unassigned' : '—')}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={cls(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600',
                    )}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {/* Last login */}
                  <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(u.lastLoginAt)}</td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setResetUser(u); setResetPin(''); setResetPinConfirm(''); }}
                        title="Reset PIN"
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      {u.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => setDeactivateUser(u)}
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                          className={cls(
                            'p-1.5 rounded-lg transition-colors',
                            u.isActive
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50',
                          )}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editUser ? `Edit ${editUser.fullName}` : 'Add Staff Member'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={formFullName} onChange={e => setFormFullName(e.target.value)}
                  placeholder="e.g. Ravi Kumar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Username (only for new) */}
              {!editUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={formUsername} onChange={e => setFormUsername(e.target.value.toLowerCase())}
                    placeholder="e.g. ravi.kumar"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formRole} onChange={e => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                  >
                    {CREATABLE_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Counter (only for cashier) */}
              {formRole === 'CASHIER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Counter</label>
                  <div className="relative">
                    <select
                      value={formCounterId} onChange={e => setFormCounterId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                    >
                      <option value="">No counter assigned</option>
                      {counters.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* PIN (only for new) */}
              {!editUser && (
                <>
                  <PinInput
                    label="PIN (6 digits) *"
                    value={formPin}
                    onChange={setFormPin}
                  />
                  <PinInput
                    label="Confirm PIN *"
                    value={formPinConfirm}
                    onChange={setFormPinConfirm}
                    placeholder="Re-enter PIN"
                  />
                  {formPin.length === 6 && formPinConfirm.length === 6 && formPin !== formPinConfirm && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />PINs do not match
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
                Cancel
              </button>
              <button
                onClick={saveStaff}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Saving...' : editUser ? 'Save Changes' : 'Add Staff Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PIN MODAL ── */}
      {resetUser && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setResetUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Reset PIN</h2>
              <button onClick={() => setResetUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                Resetting PIN for <span className="font-semibold">{resetUser.fullName}</span> (@{resetUser.username}).
                This action will be logged.
              </p>
              <PinInput label="New PIN *" value={resetPin} onChange={setResetPin} />
              <PinInput label="Confirm PIN *" value={resetPinConfirm} onChange={setResetPinConfirm} placeholder="Re-enter new PIN" />
              {resetPin.length === 6 && resetPinConfirm.length === 6 && resetPin !== resetPinConfirm && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />PINs do not match
                </p>
              )}
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                The user will need to use this new PIN to log in next time.
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setResetUser(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={doResetPin}
                disabled={saving || !/^\d{6}$/.test(resetPin) || resetPin !== resetPinConfirm}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Resetting...' : 'Reset PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE / ACTIVATE CONFIRMATION ── */}
      {deactivateUser && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDeactivateUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {deactivateUser.isActive ? 'Deactivate' : 'Activate'} {deactivateUser.fullName}?
            </h2>
            {deactivateUser.isActive ? (
              <p className="text-sm text-gray-600 mb-5">
                {deactivateUser.fullName} will not be able to log in. Any open shifts on their account may need to be closed manually.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-5">
                {deactivateUser.fullName} will be able to log in and use the system again.
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeactivateUser(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={doToggleActive}
                disabled={saving}
                className={cls(
                  'px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50',
                  deactivateUser.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
                )}
              >
                {saving ? 'Processing...' : deactivateUser.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

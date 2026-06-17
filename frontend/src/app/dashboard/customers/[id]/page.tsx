'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Phone, Mail, Edit2, AlertTriangle, ChevronLeft, ChevronRight,
  RefreshCw, X, Check, Plus, Trash2, Star, Printer,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { EntityLink } from '@/components/shared/EntityLink';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Tabs } from '@/components/shared/Tabs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── Statement PDF builder ────────────────────────────────────────────────────

function buildStatementHtml(
  customer: any,
  entries: any[],
  outstanding: number,
  fromDate: string,
  toDate: string,
) {
  const storeName = 'Srivani Kirana & General Stores';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const periodLabel = fromDate || toDate
    ? `${fromDate ? new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start'} – ${toDate ? new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}`
    : 'All Transactions';

  const rows = entries.map((e: any) => {
    const bal = Number(e.balance);
    const balStr = bal === 0 ? '—' : `Rs.${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Math.abs(bal))}${bal < 0 ? ' Cr' : ''}`;
    const typeColor = e.type === 'OPENING' ? '#2563eb' : e.type === 'BILL' ? '#d97706' : '#16a34a';
    return `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td><span style="color:${typeColor};font-weight:600;font-size:11px">${e.type}</span></td>
        <td>${e.description}</td>
        <td class="num">${Number(e.debit) > 0 ? 'Rs.' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Number(e.debit)) : '—'}</td>
        <td class="num">${Number(e.credit) > 0 ? 'Rs.' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Number(e.credit)) : '—'}</td>
        <td class="num ${bal > 0 ? 'dr' : bal < 0 ? 'cr' : ''}">${balStr}</td>
      </tr>`;
  }).join('');

  const closingLabel = outstanding > 0 ? 'Dr (Amount Due)' : outstanding < 0 ? 'Cr (Advance)' : 'Settled';
  const closingColor = outstanding > 0 ? '#dc2626' : outstanding < 0 ? '#16a34a' : '#6b7280';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Account Statement – ${customer.name ?? customer.phone}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20mm 15mm; }
    .header { text-align:center; border-bottom: 2px solid #1B4F8A; padding-bottom: 10px; margin-bottom: 14px; }
    .header h1 { font-size:18px; color:#1B4F8A; font-weight:700; }
    .header p  { font-size:11px; color:#555; margin-top:2px; }
    .title { text-align:center; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:14px; color:#333; }
    .meta { display:flex; justify-content:space-between; margin-bottom:14px; font-size:11px; color:#444; }
    .meta .box { background:#f8f9fa; border:1px solid #e5e7eb; border-radius:6px; padding:8px 12px; min-width:200px; }
    .meta .box strong { display:block; font-size:12px; color:#111; margin-bottom:2px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#1B4F8A; color:#fff; padding:7px 8px; text-align:left; font-size:11px; }
    th.num, td.num { text-align:right; }
    td { padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:11px; }
    tr:nth-child(even) td { background:#f9fafb; }
    .dr { color:#dc2626; font-weight:600; }
    .cr { color:#16a34a; font-weight:600; }
    .closing { margin-top:14px; text-align:right; font-size:12px; }
    .closing span { font-weight:700; font-size:14px; }
    .footer { margin-top:30px; text-align:center; font-size:10px; color:#aaa; border-top:1px solid #e5e7eb; padding-top:8px; }
    @media print { body { padding:10mm; } }
  </style></head><body>
  <div class="header">
    <h1>${storeName}</h1>
    <p>New Bus Stand Area, Sangareddy, Telangana | Ph: 9382828484 | GSTIN: 36AESPM7617R1ZE</p>
  </div>
  <div class="title">Account Statement</div>
  <div class="meta">
    <div class="box">
      <strong>${customer.name ?? '—'}</strong>
      ${customer.phone ? `Ph: ${customer.phone}<br>` : ''}
      ${customer.gstin ? `GSTIN: ${customer.gstin}<br>` : ''}
      ${customer.customerCode ? `Code: ${customer.customerCode}` : ''}
    </div>
    <div class="box" style="text-align:right">
      <strong>Period: ${periodLabel}</strong>
      Printed on: ${today}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Type</th><th>Description</th>
        <th class="num">Debit (Dr)</th><th class="num">Credit (Cr)</th><th class="num">Balance</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="closing">
    Closing Balance: <span style="color:${closingColor}">
      Rs.${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Math.abs(outstanding))} ${closingLabel}
    </span>
  </div>
  <div class="footer">This is a computer-generated statement — ${storeName}</div>
  </body></html>`;
}

function printStatement(html: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { try { win.print(); } catch { /* ignore */ } };
}

type Tab = 'bills' | 'online-orders' | 'payments' | 'statement' | 'addresses';

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'NEFT', 'RTGS', 'OTHER'];

const BILL_TYPE_BADGE: Record<string, string> = {
  CREDIT: 'bg-amber-100 text-amber-700',
  CASH:   'bg-gray-100 text-gray-600',
};

const STMT_BADGE: Record<string, string> = {
  OPENING: 'bg-blue-50 text-blue-700',
  BILL:    'bg-orange-50 text-orange-700',
  PAYMENT: 'bg-green-50 text-green-700',
};

const EMPTY_PAY  = { amount: '', paymentMode: 'CASH', reference: '', notes: '', billId: '', paymentDate: todayISO() };
const EMPTY_ADDR = { label: '', line1: '', line2: '', city: '', state: '', pincode: '', isDefault: false };

// ─── Pager ───────────────────────────────────────────────────────────────────

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs">Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const qc            = useQueryClient();
  const { connected } = useWebSocket();

  const [activeTab, setActiveTab] = useState<Tab>('bills');
  const [billPage,  setBillPage]  = useState(1);
  const [payPage,   setPayPage]   = useState(1);
  const [stmtFrom,  setStmtFrom]  = useState('');
  const [stmtTo,    setStmtTo]    = useState('');

  const [showPay,  setShowPay]  = useState(false);
  const [payForm,  setPayForm]  = useState({ ...EMPTY_PAY });

  const [showAddr,    setShowAddr]    = useState(false);
  const [editingAddr, setEditingAddr] = useState<any | null>(null);
  const [addrForm,    setAddrForm]    = useState({ ...EMPTY_ADDR });

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEscapeKey(() => setShowEdit(false), showEdit);
  useEscapeKey(() => setShowAddr(false), showAddr && !showEdit);
  useEscapeKey(() => setShowPay(false), showPay && !showAddr && !showEdit);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn:  () => api.get(`/customers/${id}`).then(r => r.data),
    enabled:  !!id,
  });

  const { data: onlineOrdersData, isLoading: onlineOrdersLoading } = useQuery<any[]>({
    queryKey: ['customer', id, 'online-orders'],
    queryFn:  () => api.get('/online-orders/admin', {
      params: { search: customer?.phone ?? '', status: 'ALL' },
    }).then(r => (r.data as any[]).filter((o: any) => o.customerPhone === customer?.phone)),
    enabled:  !!id && !!customer?.phone && activeTab === 'online-orders',
    staleTime: 60_000,
  });

  const { data: billsData, isLoading: billsLoading } = useQuery({
    queryKey: ['customer', id, 'bills', { page: billPage }],
    queryFn:  () => api.get(`/customers/${id}/bills`, { params: { page: billPage, limit: 20 } }).then(r => r.data),
    enabled:  !!id && activeTab === 'bills',
    placeholderData: (prev: any) => prev,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['customer', id, 'payments', { page: payPage }],
    queryFn:  () => api.get(`/customers/${id}/payments`, { params: { page: payPage, limit: 20 } }).then(r => r.data),
    enabled:  !!id && activeTab === 'payments',
    placeholderData: (prev: any) => prev,
  });

  const { data: stmtData, isLoading: stmtLoading } = useQuery({
    queryKey: ['customer', id, 'statement', { stmtFrom, stmtTo }],
    queryFn:  () => api.get(`/customers/${id}/statement`, {
      params: {
        ...(stmtFrom ? { dateFrom: stmtFrom } : {}),
        ...(stmtTo   ? { dateTo:   stmtTo   } : {}),
      },
    }).then(r => r.data),
    enabled:  !!id && activeTab === 'statement',
    placeholderData: (prev: any) => prev,
  });

  const { data: billsForSelect = [] } = useQuery<any[]>({
    queryKey: ['customer', id, 'bills-select'],
    queryFn:  () => api.get(`/customers/${id}/bills`, { params: { limit: 50 } }).then(r => r.data.data ?? []),
    enabled:  !!id && showPay,
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ['customer', id] });

  const addPay = useMutation({
    mutationFn: (body: any) => api.post(`/customers/${id}/payments`, body),
    onSuccess:  () => {
      toast.success('Payment recorded');
      setShowPay(false);
      setPayForm({ ...EMPTY_PAY });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to record payment'),
  });

  const deletePay = useMutation({
    mutationFn: (pid: string) => api.delete(`/customers/${id}/payments/${pid}`),
    onSuccess:  () => { toast.success('Payment deleted'); invalidate(); },
    onError:    (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete payment'),
  });

  const saveAddr = useMutation({
    mutationFn: (data: any) =>
      editingAddr
        ? api.put(`/customers/${id}/addresses/${editingAddr.id}`, data)
        : api.post(`/customers/${id}/addresses`, data),
    onSuccess: () => {
      toast.success(editingAddr ? 'Address updated' : 'Address added');
      setShowAddr(false);
      setEditingAddr(null);
      setAddrForm({ ...EMPTY_ADDR });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save address'),
  });

  const deleteAddr = useMutation({
    mutationFn: (addrId: string) => api.delete(`/customers/${id}/addresses/${addrId}`),
    onSuccess:  () => { toast.success('Address deleted'); invalidate(); },
    onError:    (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete address'),
  });

  const editCustomer = useMutation({
    mutationFn: (data: any) => api.put(`/customers/${id}`, data),
    onSuccess:  () => { toast.success('Customer updated'); setShowEdit(false); invalidate(); },
    onError:    (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update customer'),
  });

  // ── Real-time ────────────────────────────────────────────────────────────────

  useWebSocketEvent('customer.updated',          invalidate);
  useWebSocketEvent('customer.payment-recorded', invalidate);
  useWebSocketEvent('customer.payment-deleted',  invalidate);
  useWebSocketEvent('bill.created',              invalidate);
  useWebSocketEvent('bill.voided',               invalidate);

  // ── Loading / not found ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Customer" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Customer" />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">Customer not found</div>
      </div>
    );
  }

  const stats       = customer.stats ?? {};
  const outstanding = n(stats.outstandingBalance);
  const creditLimit = n(customer.creditLimit);
  const available   = creditLimit > 0 ? Math.max(0, creditLimit - outstanding) : null;
  const overLimit   = creditLimit > 0 && outstanding > creditLimit;
  const addresses   = customer.addresses ?? [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Customer" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Top nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <BackButton fallbackHref="/dashboard/customers" />
          <span className="text-gray-300">|</span>
          <Breadcrumbs items={[
            { label: 'Customers', href: '/dashboard/customers' },
            { label: customer.name || customer.phone || customer.customerCode || 'Customer' },
          ]} />
          <span className={`ml-auto text-xs font-mono px-2 py-1 rounded ${
            connected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
                {customer.customerCode && (
                  <span className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {customer.customerCode}
                  </span>
                )}
                {/* Status badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  customer.status === 'ACTIVE' && customer.isActive ? 'bg-green-100 text-green-700'
                    : customer.status === 'BLOCKED'                 ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {customer.status === 'ACTIVE' && customer.isActive ? 'Active'
                    : customer.status === 'BLOCKED' ? 'Blocked' : 'Inactive'}
                </span>
                {/* Type badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  customer.customerType === 'WALKIN' ? 'bg-gray-100 text-gray-600'
                    : customer.customerType === 'B2B' ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {customer.customerType === 'WALKIN' ? 'Walk-in'
                    : customer.customerType === 'B2B' ? 'B2B' : 'B2C'}
                </span>
                {/* Channel badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  customer.channel === 'ONLINE' ? 'bg-teal-100 text-teal-700'
                    : customer.channel === 'BOTH' ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {customer.channel === 'ONLINE' ? 'Online'
                    : customer.channel === 'BOTH' ? 'Both' : 'POS'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {customer.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{customer.email}</span>
                )}
                {customer.customerType === 'B2B' && customer.gstin && (
                  <span className="font-mono text-xs bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                    GSTIN: {customer.gstin}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { setPayForm({ ...EMPTY_PAY }); setShowPay(true); }}
                className="px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e] font-medium"
              >
                Record Payment
              </button>
              {!customer.isSystemDefault && (
                <button
                  onClick={() => {
                    setEditForm({
                      name:           customer.name,
                      phone:          customer.phone          ?? '',
                      email:          customer.email          ?? '',
                      creditLimit:    n(customer.creditLimit),
                      status:         customer.status,
                      whatsappOptIn:  customer.whatsappOptIn  ?? false,
                      smsOptIn:       customer.smsOptIn       ?? false,
                      emailOptIn:     customer.emailOptIn     ?? false,
                    });
                    setShowEdit(true);
                  }}
                  className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
                  title="Edit customer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 7 Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Outstanding */}
          <div className={`bg-white rounded-xl border px-5 py-4 ${
            outstanding > 0 ? 'border-red-200'
              : outstanding < 0 ? 'border-green-200'
              : 'border-gray-200'
          }`}>
            <p className="text-xs text-gray-500 mb-1">Outstanding</p>
            {outstanding > 0 ? (
              <>
                <p className="text-xl font-semibold text-red-600">Rs. {inr(outstanding)}</p>
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  {overLimit && <AlertTriangle className="w-3 h-3" />}
                  {overLimit ? 'Over limit' : 'Due'}
                </p>
              </>
            ) : outstanding < 0 ? (
              <>
                <p className="text-xl font-semibold text-green-600">Rs. {inr(Math.abs(outstanding))}</p>
                <p className="text-xs text-green-500 mt-1">Advance</p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-gray-400">Settled</p>
                <p className="text-xs text-gray-400 mt-1">No dues</p>
              </>
            )}
          </div>

          {/* 2. Credit Limit */}
          <div className={`bg-white rounded-xl border px-5 py-4 ${overLimit ? 'border-red-200' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Credit Limit</p>
            {creditLimit > 0 ? (
              <>
                <p className={`text-xl font-semibold ${overLimit ? 'text-red-600' : 'text-gray-700'}`}>
                  Rs. {inr(creditLimit)}
                </p>
                <p className={`text-xs mt-1 ${overLimit ? 'text-red-500' : 'text-green-600'}`}>
                  {overLimit
                    ? `Exceeded by Rs. ${inr(outstanding - creditLimit)}`
                    : `Avail: Rs. ${inr(available!)}`}
                </p>
              </>
            ) : (
              <p className="text-xl font-semibold text-gray-400">No limit</p>
            )}
          </div>

          {/* 3. Lifetime Purchases */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Lifetime Purchases</p>
            <p className="text-xl font-semibold text-gray-700">Rs. {inr(n(stats.totalPurchased))}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.totalBills ?? 0} bill(s)</p>
          </div>

          {/* 4. This Month */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-xl font-semibold text-gray-700">Rs. {inr(n(stats.thisMonthPurchased))}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* 5. Last Purchase */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Last Purchase</p>
            <p className="text-lg font-semibold text-gray-700">{fmtDate(stats.lastPurchaseDate)}</p>
            {stats.lastBillNumber && (
              <p className="text-xs text-gray-400 mt-1">Bill #{stats.lastBillNumber}</p>
            )}
          </div>

          {/* 6. Last Payment */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Last Payment</p>
            <p className="text-lg font-semibold text-gray-700">{fmtDate(stats.lastPaymentDate)}</p>
            {stats.lastPaymentAmount != null && (
              <p className="text-xs text-gray-400 mt-1">
                Rs. {inr(n(stats.lastPaymentAmount))} · {stats.lastPaymentMode}
              </p>
            )}
          </div>

          {/* 7. Loyalty Points */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Loyalty Points</p>
            <p className="text-xl font-semibold text-gray-700">{customer.loyaltyPoints ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">points earned</p>
          </div>
        </div>

        {/* Body: tabs + side panel */}
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Tabs area */}
          <div className="flex-1 min-w-0">
            <Tabs
              tabs={[
                { key: 'bills',         label: 'Bills' },
                { key: 'online-orders', label: 'Online Orders' },
                { key: 'payments',      label: 'Payments' },
                { key: 'statement',     label: 'Statement' },
                { key: 'addresses',     label: 'Addresses' },
              ]}
              active={activeTab}
              onChange={(t) => setActiveTab(t as Tab)}
              className="bg-white rounded-t-xl px-4 pt-3"
            />

            <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 overflow-hidden">

              {/* ── Bills ─────────────────────────────────────────────────── */}
              {activeTab === 'bills' && (
                <div>
                  {billsLoading ? (
                    <div className="py-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
                    </div>
                  ) : billsData?.data?.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                              <th className="px-4 py-2.5 text-left font-medium">Bill #</th>
                              <th className="px-4 py-2.5 text-left font-medium">Date</th>
                              <th className="px-4 py-2.5 text-left font-medium">Type</th>
                              <th className="px-4 py-2.5 text-right font-medium">Total</th>
                              <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                              <th className="px-4 py-2.5 text-left font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billsData.data.map((b: any) => (
                              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-mono text-xs">
                                  <EntityLink type="bill" id={b.id}>{b.billNumber ?? b.id.slice(-8)}</EntityLink>
                                </td>
                                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(b.billDate)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BILL_TYPE_BADGE[b.saleType] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {b.saleType}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium">Rs. {inr(n(b.grandTotal))}</td>
                                <td className="px-4 py-2.5 text-right text-green-600">Rs. {inr(n(b.paidAmount))}</td>
                                <td className={`px-4 py-2.5 text-right font-medium ${n(b.balanceAmount) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  Rs. {inr(n(b.balanceAmount))}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    b.status === 'FINAL' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {b.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pager page={billPage} totalPages={billsData.meta?.totalPages ?? 1} onPage={setBillPage} />
                    </>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">No bills found</div>
                  )}
                </div>
              )}

              {/* ── Online Orders ─────────────────────────────────────────── */}
              {activeTab === 'online-orders' && (
                <div>
                  {!customer.phone ? (
                    <div className="py-12 text-center text-gray-400 text-sm">
                      No phone number on this customer — online orders are linked by phone.
                    </div>
                  ) : onlineOrdersLoading ? (
                    <div className="py-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : !onlineOrdersData?.length ? (
                    <div className="py-12 text-center text-gray-400 text-sm">No online orders for this customer</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                            <th className="px-4 py-2.5 text-left font-medium">Order #</th>
                            <th className="px-4 py-2.5 text-left font-medium">Date</th>
                            <th className="px-4 py-2.5 text-left font-medium">Delivery</th>
                            <th className="px-4 py-2.5 text-left font-medium">Payment</th>
                            <th className="px-4 py-2.5 text-right font-medium">Total</th>
                            <th className="px-4 py-2.5 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(onlineOrdersData ?? []).map((o: any) => {
                            const statusColor: Record<string, string> = {
                              PENDING_COD:     'bg-blue-100 text-blue-700',
                              CONFIRMED:       'bg-green-100 text-green-700',
                              PROCESSING:      'bg-purple-100 text-purple-700',
                              READY:           'bg-teal-100 text-teal-700',
                              DELIVERED:       'bg-gray-100 text-gray-700',
                              CANCELLED:       'bg-red-100 text-red-600',
                              PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
                              PAYMENT_FAILED:  'bg-red-100 text-red-600',
                            };
                            const statusLabel: Record<string, string> = {
                              PENDING_COD: 'Pending COD', CONFIRMED: 'Confirmed',
                              PROCESSING: 'Processing', READY: 'Ready',
                              DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
                              PENDING_PAYMENT: 'Pending Payment', PAYMENT_FAILED: 'Failed',
                            };
                            return (
                              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#1B4F8A]">
                                  {o.orderNumber}
                                </td>
                                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                                  {fmtDate(o.createdAt)}
                                </td>
                                <td className="px-4 py-2.5 text-gray-500 text-xs">
                                  {o.deliveryType === 'STORE_PICKUP' ? 'Pickup' : 'Delivery'}
                                </td>
                                <td className="px-4 py-2.5 text-gray-500 text-xs">
                                  {o.paymentMethod === 'COD' ? 'COD' : 'Online'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium">
                                  Rs. {inr(n(o.total))}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {statusLabel[o.status] ?? o.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                        {onlineOrdersData?.length} online order(s) linked by phone {customer.phone}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Payments ──────────────────────────────────────────────── */}
              {activeTab === 'payments' && (
                <div>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{paymentsData?.meta?.total ?? 0} payment(s)</span>
                    <button
                      onClick={() => { setPayForm({ ...EMPTY_PAY }); setShowPay(true); }}
                      className="px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e]"
                    >
                      Record Payment
                    </button>
                  </div>
                  {paymentsLoading ? (
                    <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                  ) : paymentsData?.data?.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                              <th className="px-4 py-2.5 text-left font-medium">Date</th>
                              <th className="px-4 py-2.5 text-left font-medium">Mode</th>
                              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                              <th className="px-4 py-2.5 text-left font-medium">Against Bill</th>
                              <th className="px-4 py-2.5 text-left font-medium">Reference</th>
                              <th className="px-4 py-2.5 text-left font-medium">Notes</th>
                              <th className="px-4 py-2.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentsData.data.map((p: any) => (
                              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                                <td className="px-4 py-2.5 text-gray-600">{p.paymentMode}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-green-700">Rs. {inr(n(p.amount))}</td>
                                <td className="px-4 py-2.5 font-mono text-xs">
                                  {p.bill
                                    ? <EntityLink type="bill" id={p.bill.id}>{p.bill.billNumber ?? p.bill.id.slice(-8)}</EntityLink>
                                    : '—'}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.reference ?? '—'}</td>
                                <td className="px-4 py-2.5 text-gray-500 text-xs">{p.notes ?? '—'}</td>
                                <td className="px-4 py-2.5">
                                  <button
                                    onClick={() => { if (confirm('Delete this payment?')) deletePay.mutate(p.id); }}
                                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Delete payment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pager page={payPage} totalPages={paymentsData.meta?.totalPages ?? 1} onPage={setPayPage} />
                    </>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">No payments recorded</div>
                  )}
                </div>
              )}

              {/* ── Statement ─────────────────────────────────────────────── */}
              {activeTab === 'statement' && (
                <div>
                  <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">From</label>
                      <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">To</label>
                      <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                    </div>
                    {(stmtFrom || stmtTo) && (
                      <button onClick={() => { setStmtFrom(''); setStmtTo(''); }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                    )}
                    {stmtLoading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
                    {stmtData?.entries?.length > 0 && (
                      <button
                        onClick={() => printStatement(buildStatementHtml(customer, stmtData.entries, outstanding, stmtFrom, stmtTo))}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e] transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Statement
                      </button>
                    )}
                  </div>
                  {stmtData?.entries?.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                              <th className="px-4 py-2.5 text-left font-medium">Date</th>
                              <th className="px-4 py-2.5 text-left font-medium">Type</th>
                              <th className="px-4 py-2.5 text-left font-medium">Description</th>
                              <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                              <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stmtData.entries.map((e: any, i: number) => (
                              <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${e.type === 'OPENING' ? 'bg-blue-50/30' : ''}`}>
                                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STMT_BADGE[e.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {e.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-700">
                                  {e.type === 'BILL' && e.refId
                                    ? <EntityLink type="bill" id={e.refId}>{e.description}</EntityLink>
                                    : e.description}
                                </td>
                                <td className="px-4 py-2.5 text-right text-orange-700 font-medium">
                                  {n(e.debit) > 0 ? `Rs. ${inr(n(e.debit))}` : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right text-green-700 font-medium">
                                  {n(e.credit) > 0 ? `Rs. ${inr(n(e.credit))}` : '—'}
                                </td>
                                <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${
                                  n(e.balance) > 0 ? 'text-red-600'
                                    : n(e.balance) < 0 ? 'text-green-600'
                                    : 'text-gray-500'
                                }`}>
                                  {n(e.balance) !== 0
                                    ? `Rs. ${inr(Math.abs(n(e.balance)))}${n(e.balance) < 0 ? ' (Cr)' : ''}`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 border-t border-gray-100 text-right text-sm">
                        <span className="text-gray-500">Closing balance: </span>
                        <span className={`font-semibold ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                          Rs. {inr(Math.abs(outstanding))}
                          {outstanding < 0 ? ' (Advance)' : outstanding > 0 ? ' (Due)' : ' (Settled)'}
                        </span>
                      </div>
                    </>
                  ) : stmtLoading ? (
                    <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">No transactions found</div>
                  )}
                </div>
              )}

              {/* ── Addresses ─────────────────────────────────────────────── */}
              {activeTab === 'addresses' && (
                <div>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{addresses.length} address(es)</span>
                    <button
                      onClick={() => { setEditingAddr(null); setAddrForm({ ...EMPTY_ADDR }); setShowAddr(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Address
                    </button>
                  </div>
                  {addresses.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {addresses.map((addr: any) => (
                        <div key={addr.id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {addr.label && (
                                <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                  {addr.label}
                                </span>
                              )}
                              {addr.isDefault && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  <Star className="w-3 h-3" /> Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700">
                              {[addr.line1, addr.line2, addr.city, addr.state, addr.pincode]
                                .filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingAddr(addr);
                                setAddrForm({
                                  label:     addr.label    ?? '',
                                  line1:     addr.line1,
                                  line2:     addr.line2    ?? '',
                                  city:      addr.city     ?? '',
                                  state:     addr.state    ?? '',
                                  pincode:   addr.pincode  ?? '',
                                  isDefault: addr.isDefault,
                                });
                                setShowAddr(true);
                              }}
                              className="p-1.5 rounded text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm('Delete this address?')) deleteAddr.mutate(addr.id); }}
                              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">No addresses added</div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Side panel */}
          <div className="lg:w-72 shrink-0 space-y-4">

            {/* Contact */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Contact</h3>
              <dl className="space-y-2 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-700">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-700 truncate">{customer.email}</span>
                  </div>
                )}
                {!customer.phone && !customer.email && (
                  <p className="text-gray-400 text-xs">No contact info</p>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <dt className="text-gray-500">Since</dt>
                  <dd className="text-gray-800">{fmtDate(customer.createdAt)}</dd>
                </div>
              </dl>
            </div>

            {/* B2B details */}
            {customer.customerType === 'B2B' && (
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">B2B Details</h3>
                <dl className="space-y-2 text-sm">
                  {customer.companyName && (
                    <div>
                      <dt className="text-xs text-gray-500">Company</dt>
                      <dd className="font-medium text-gray-800">{customer.companyName}</dd>
                    </div>
                  )}
                  {customer.gstin && (
                    <div>
                      <dt className="text-xs text-gray-500">GSTIN</dt>
                      <dd className="font-mono text-xs text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 mt-0.5">
                        {customer.gstin}
                      </dd>
                    </div>
                  )}
                  {customer.billingAddress && (
                    <div>
                      <dt className="text-xs text-gray-500">Billing Address</dt>
                      <dd className="text-gray-700 text-xs mt-0.5">{customer.billingAddress}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Communication prefs */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Communication</h3>
              <div className="space-y-1.5 text-sm">
                {([
                  { key: 'whatsappOptIn', label: 'WhatsApp' },
                  { key: 'smsOptIn',      label: 'SMS' },
                  { key: 'emailOptIn',    label: 'Email' },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-gray-600">{label}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      customer[key] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {customer[key] ? 'Opted in' : 'Off'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer group */}
            {customer.customerGroup && (
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Customer Group</h3>
                <p className="text-sm text-gray-800">{customer.customerGroup}</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Record Payment Modal ──────────────────────────────────────────────── */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPay(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Record Payment</h2>
              <button onClick={() => setShowPay(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {customer.name} — Outstanding:{' '}
              <span className={`font-semibold ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                Rs. {inr(Math.abs(outstanding))}
                {outstanding < 0 ? ' (Advance)' : outstanding === 0 ? ' (Settled)' : ''}
              </span>
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Amount *</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={payForm.amount}
                    onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="0.00" autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Date *</label>
                  <input
                    type="date"
                    value={payForm.paymentDate}
                    onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Payment Mode *</label>
                <select
                  value={payForm.paymentMode}
                  onChange={e => setPayForm(f => ({ ...f, paymentMode: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {billsForSelect.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Against Bill (optional)</label>
                  <select
                    value={payForm.billId}
                    onChange={e => setPayForm(f => ({ ...f, billId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  >
                    <option value="">— None —</option>
                    {billsForSelect.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.billNumber ?? b.id.slice(-8)} — Rs. {inr(n(b.balanceAmount))} due
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Reference</label>
                <input
                  type="text"
                  value={payForm.reference}
                  onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="Cheque / UTR / Transaction ID"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <textarea rows={2}
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] resize-none"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPay(false)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                disabled={!payForm.amount || Number(payForm.amount) <= 0 || addPay.isPending}
                onClick={() => addPay.mutate({
                  amount:      Number(payForm.amount),
                  paymentDate: payForm.paymentDate,
                  paymentMode: payForm.paymentMode,
                  reference:   payForm.reference || undefined,
                  notes:       payForm.notes     || undefined,
                  billId:      payForm.billId    || undefined,
                })}
                className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {addPay.isPending ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Address Modal ─────────────────────────────────────────────────────── */}
      {showAddr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAddr(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                {editingAddr ? 'Edit Address' : 'Add Address'}
              </h2>
              <button onClick={() => setShowAddr(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Label</label>
                <input
                  value={addrForm.label}
                  onChange={e => setAddrForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="Home / Office / Billing (optional)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Line 1 *</label>
                <input
                  value={addrForm.line1}
                  onChange={e => setAddrForm(f => ({ ...f, line1: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="House No, Street, Area"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Line 2</label>
                <input
                  value={addrForm.line2}
                  onChange={e => setAddrForm(f => ({ ...f, line2: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="Landmark (optional)"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">City</label>
                  <input
                    value={addrForm.city}
                    onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="City"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">State</label>
                  <input
                    value={addrForm.state}
                    onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="State"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Pincode</label>
                  <input
                    value={addrForm.pincode}
                    onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={addrForm.isDefault}
                  onChange={e => setAddrForm(f => ({ ...f, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-[#1B4F8A] focus:ring-[#1B4F8A]"
                />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowAddr(false)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button
                disabled={!addrForm.line1.trim() || saveAddr.isPending}
                onClick={() => saveAddr.mutate({
                  label:     addrForm.label     || undefined,
                  line1:     addrForm.line1.trim(),
                  line2:     addrForm.line2     || undefined,
                  city:      addrForm.city      || undefined,
                  state:     addrForm.state     || undefined,
                  pincode:   addrForm.pincode   || undefined,
                  isDefault: addrForm.isDefault,
                })}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163d6e] disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {saveAddr.isPending ? 'Saving...' : editingAddr ? 'Update Address' : 'Add Address'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Customer Modal ───────────────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-gray-900">Edit Customer</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Phone</label>
                  <input
                    value={editForm.phone ?? ''}
                    onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="10-digit mobile"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Name</label>
                  <input
                    value={editForm.name ?? ''}
                    onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="Customer name"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Email</label>
                <input
                  value={editForm.email ?? ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="email@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Credit Limit (Rs.)</label>
                  <input
                    type="number" min={0}
                    value={editForm.creditLimit ?? 0}
                    onChange={e => setEditForm((f: any) => ({ ...f, creditLimit: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Status</label>
                  <select
                    value={editForm.status ?? 'ACTIVE'}
                    onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Communication</p>
                {([
                  { key: 'whatsappOptIn', label: 'WhatsApp opt-in' },
                  { key: 'smsOptIn',      label: 'SMS opt-in' },
                  { key: 'emailOptIn',    label: 'Email opt-in' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm[key] ?? false}
                      onChange={e => setEditForm((f: any) => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-[#1B4F8A] focus:ring-[#1B4F8A]"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button
                disabled={editCustomer.isPending}
                onClick={() => editCustomer.mutate({
                  name:          editForm.name      || undefined,
                  phone:         editForm.phone     || undefined,
                  email:         editForm.email     || undefined,
                  creditLimit:   editForm.creditLimit,
                  status:        editForm.status,
                  whatsappOptIn: editForm.whatsappOptIn,
                  smsOptIn:      editForm.smsOptIn,
                  emailOptIn:    editForm.emailOptIn,
                })}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163d6e] disabled:opacity-60 flex items-center justify-center gap-2 font-medium"
              >
                <Check className="w-4 h-4" />
                {editCustomer.isPending ? 'Saving...' : 'Update Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

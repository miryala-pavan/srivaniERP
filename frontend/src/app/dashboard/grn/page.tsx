'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Eye, Pencil, Trash2, Send,
  CheckCircle2, XCircle, RotateCcw,
  Package, Printer, CreditCard, X, Check, Tag, FileText, AlertTriangle,
  Search, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, ShieldOff,
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Tabs } from '@/components/shared/Tabs';

type GrnStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type TabKey = 'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CREDIT_NOTES';

interface GrnSummary {
  id: string;
  grnNumber: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierId: string;
  grandTotal: number | string;
  invoiceControlTotal?: number | string | null;
  receivedDate?: string | null;
  status: GrnStatus;
  createdAt: string;
  notes?: string | null;
  excludeFromGst?: boolean;
  _count: { items: number };
}

interface PaymentSummary {
  totalPaid: number;
  grandTotal: number;
  totalCreditNotes?: number;
  balance: number;
  isPaid: boolean;
  coversMultiple?: boolean;
  billCount?: number;
}

interface CreditNote {
  id: string;
  scnNumber: string;
  cnDate: string;
  supplierId: string;
  supplier: { id: string; name: string };
  originalGrnId: string | null;
  originalInvoiceNo: string | null;
  reason: string;
  taxableAmount: number | string;
  cgstAmount: number | string;
  sgstAmount: number | string;
  igstAmount: number | string;
  cessAmount: number | string;
  totalAmount: number | string;
  status: string;
  notes: string | null;
}

const STATUS_BADGE: Record<GrnStatus, { label: string; color: string }> = {
  DRAFT:            { label: 'Draft',    color: 'bg-gray-100 text-gray-600'   },
  PENDING_APPROVAL: { label: 'Pending',  color: 'bg-amber-100 text-amber-700' },
  APPROVED:         { label: 'Approved', color: 'bg-green-100 text-green-700' },
  REJECTED:         { label: 'Rejected', color: 'bg-red-100 text-red-600'     },
  CANCELLED:        { label: 'Cancelled',color: 'bg-gray-100 text-gray-500'   },
};

const TABS: { key: TabKey; label: string; status: string }[] = [
  { key: 'ALL',              label: 'All',          status: ''                 },
  { key: 'DRAFT',            label: 'Drafts',       status: 'DRAFT'            },
  { key: 'PENDING_APPROVAL', label: 'Pending',      status: 'PENDING_APPROVAL' },
  { key: 'APPROVED',         label: 'Approved',     status: 'APPROVED'         },
  { key: 'REJECTED',         label: 'Rejected',     status: 'REJECTED'         },
  { key: 'CREDIT_NOTES',     label: 'Credit Notes', status: ''                 },
];

const REASONS = [
  'Goods Returned (damaged)',
  'Goods Returned (expired)',
  'Rate Difference',
  'Short Supply',
  'Quality Issue',
  'Other',
];

const GST_RATES = [0, 5, 12, 18, 28];
const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'NEFT', 'RTGS'];

const fmt = (v: number | string) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(v));

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY_CN_FORM = {
  cnDate:           todayIso(),
  reason:           '',
  description:      '',
  supplierCnNumber: '',
  taxableAmount:    '',
  gstRate:          18,
  cessAmount:       '',
  itcReversal:      false,
  notes:            '',
};

export default function GrnPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connected } = useWebSocket();

  // Filter / pagination state
  const [activeTab, setActiveTab]   = useState<TabKey>('ALL');
  const [page, setPage]             = useState(1);
  const [cnPage, setCnPage]         = useState(1);

  // Filters & sorting
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');   // debounced
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [minAmount, setMinAmount]     = useState('');
  const [maxAmount, setMaxAmount]     = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');  // PAID | PARTIAL | UNPAID
  const [sortBy, setSortBy]           = useState('date');   // date | amount | supplier | grnNumber | invoiceNumber
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasActiveFilters = !!(search || supplierFilter || dateFrom || dateTo || minAmount || maxAmount || paymentStatus);

  function clearFilters() {
    setSearchInput(''); setSearch(''); setSupplierFilter('');
    setDateFrom(''); setDateTo(''); setMinAmount(''); setMaxAmount('');
    setPaymentStatus(''); setPage(1);
  }

  // Sort indicator icon for a column header
  function sortArrow(col: string) {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#1B4F8A]" />
      : <ArrowDown className="w-3 h-3 text-[#1B4F8A]" />;
  }

  // Toggle a sortable column: same column flips direction, new column resets to desc
  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col); setSortDir('desc');
    }
    setPage(1);
  }

  // Reset to page 1 whenever a filter changes
  useEffect(() => { setPage(1); }, [search, supplierFilter, dateFrom, dateTo, minAmount, maxAmount, paymentStatus]);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentDrawer, setPaymentDrawer] = useState<{ id: string; grnNumber: string | null } | null>(null);

  // Payment modal
  const [payModal, setPayModal]   = useState<GrnSummary | null>(null);
  const [paySummary, setPaySummary] = useState<PaymentSummary | null>(null);
  const [payForm, setPayForm]     = useState({
    paymentDate: todayIso(),
    amount: '',
    paymentMode: 'CASH',
    referenceNumber: '',
    notes: '',
  });

  // Label print prompt after GRN approval
  const [labelPrompt, setLabelPrompt] = useState<{ ids: string[]; qtys: number[] } | null>(null);

  // Price review after GRN approval
  const [priceReview, setPriceReview] = useState<{
    grnId: string;
    items: { productId: string; productName: string; oldCost: number; newCost: number; sellingPrice: number; mrp: number; pluId: string }[];
  } | null>(null);
  const [priceReviewUpdates, setPriceReviewUpdates] = useState<Record<string, string>>({});

  // Credit note modal
  const [cnModal, setCnModal] = useState<GrnSummary | null>(null);
  const [cnForm, setCnForm]   = useState({ ...EMPTY_CN_FORM });

  useEscapeKey(() => setCnModal(null), !!cnModal);
  useEscapeKey(() => setPayModal(null), !!payModal && !cnModal);

  const statusForTab = TABS.find((t) => t.key === activeTab)?.status ?? '';

  // ─── Queries ──────────────────────────────────────────────────────────────────

  const { data: grnData, isLoading } = useQuery({
    queryKey: ['grns', { tab: activeTab, page, search, supplierFilter, dateFrom, dateTo, minAmount, maxAmount, paymentStatus, sortBy, sortDir }],
    queryFn: async () => {
      const res = await api.get('/grn', {
        params: {
          page, limit: 20,
          status:        statusForTab || undefined,
          search:        search || undefined,
          supplierId:    supplierFilter || undefined,
          startDate:     dateFrom || undefined,
          endDate:       dateTo || undefined,
          minAmount:     minAmount || undefined,
          maxAmount:     maxAmount || undefined,
          paymentStatus: paymentStatus || undefined,
          sortBy,
          sortDir,
        },
      });
      const list: GrnSummary[] = res.data.data;

      // Batch-fetch payment summaries for approved GRNs
      const paymentSummaries: Record<string, PaymentSummary> = {};
      const approved = list.filter((g) => g.status === 'APPROVED');
      if (approved.length > 0) {
        const results = await Promise.allSettled(
          approved.map((g) => api.get(`/grn/${g.id}/payment-summary`)),
        );
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') paymentSummaries[approved[i].id] = r.value.data;
        });
      }

      // Check for duplicate invoices on draft GRNs
      const duplicateMap: Record<string, string> = {};
      const drafts = list.filter((g) => g.status === 'DRAFT' && g.invoiceNumber);
      if (drafts.length > 0) {
        const dupResults = await Promise.allSettled(
          drafts.map((g) =>
            api.get('/grn', {
              params: { invoiceNumber: g.invoiceNumber, supplierId: g.supplierId, excludeStatus: 'DRAFT', limit: 5 },
            }),
          ),
        );
        dupResults.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const hits = (r.value.data.data ?? []).filter((x: any) => x.status !== 'DRAFT');
            if (hits.length > 0) duplicateMap[drafts[i].id] = hits[0].status;
          }
        });
      }

      return {
        grns: list,
        total: res.data.meta.total as number,
        totalPages: res.data.meta.totalPages as number,
        paymentSummaries,
        duplicateMap,
      };
    },
    enabled: activeTab !== 'CREDIT_NOTES',
    placeholderData: (prev) => prev,
  });

  const grns             = grnData?.grns             ?? [];
  const total            = grnData?.total            ?? 0;
  const totalPages       = grnData?.totalPages       ?? 1;
  const paymentSummaries = grnData?.paymentSummaries ?? {};
  const duplicateMap     = grnData?.duplicateMap     ?? {};

  const { data: cnQueryData, isLoading: cnIsLoading } = useQuery({
    queryKey: ['grn-credit-notes', cnPage],
    queryFn: async () => {
      const res = await api.get('/grn/credit-notes', { params: { page: cnPage, limit: 20 } });
      return {
        creditNotes: res.data.data as CreditNote[],
        total:       res.data.meta.total as number,
        totalPages:  res.data.meta.totalPages as number,
      };
    },
    enabled: activeTab === 'CREDIT_NOTES',
    placeholderData: (prev) => prev,
  });

  const creditNotes  = cnQueryData?.creditNotes ?? [];
  const cnListTotal  = cnQueryData?.total       ?? 0;
  const cnTotalPages = cnQueryData?.totalPages  ?? 1;

  // Suppliers for the filter dropdown
  const { data: supplierOptions = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['grn-supplier-options'],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { limit: 500 } });
      const rows = (res.data?.data ?? res.data ?? []) as any[];
      return rows
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
  });

  // ─── WS live updates ──────────────────────────────────────────────────────────

  useWebSocketEvent('grn.created',   () => queryClient.invalidateQueries({ queryKey: ['grns'] }));
  useWebSocketEvent('grn.updated',   () => queryClient.invalidateQueries({ queryKey: ['grns'] }));
  useWebSocketEvent('grn.submitted', () => queryClient.invalidateQueries({ queryKey: ['grns'] }));
  useWebSocketEvent('grn.approved',  () => queryClient.invalidateQueries({ queryKey: ['grns'] }));
  useWebSocketEvent('grn.rejected',  () => queryClient.invalidateQueries({ queryKey: ['grns'] }));

  // ─── Mutations ────────────────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.post(`/grn/${id}/submit`, {}),
    onSuccess: () => {
      toast.success('GRN submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['grns'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Submit failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, invoiceNumber }: { id: string; invoiceNumber: string }) => {
      await api.delete(`/grn/${id}`);
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('grn_v2_draft_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.grnId === id) localStorage.removeItem(key);
            }
          }
        }
      } catch {}
      return invoiceNumber;
    },
    onSuccess: () => {
      toast.success('Draft deleted');
      queryClient.invalidateQueries({ queryKey: ['grns'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/grn/${id}/approve`, {});
      try {
        const detail = await api.get(`/grn/${id}`);
        const items = (detail.data.items ?? []) as Array<{
          productId: string; productName: string; quantity: number; totalQty?: number;
          netCostPrice?: number; lastCostPrice?: number; priceChanged?: boolean;
          mrp?: number; sellingPrice?: number;
        }>;
        const valid = items.filter((it) => it.productId && Number(it.totalQty ?? it.quantity) > 0);

        // Fetch PLUs for items with price changes
        const changed = items.filter(it => it.priceChanged && it.productId);
        let reviewItems: any[] = [];
        if (changed.length > 0) {
          const pluResults = await Promise.allSettled(
            changed.map(it => api.get(`/products/${it.productId}/plus/active`))
          );
          reviewItems = changed.map((it, i) => {
            const plu = pluResults[i].status === 'fulfilled' ? pluResults[i].value.data?.[0] : null;
            return plu ? {
              productId: it.productId,
              productName: it.productName,
              oldCost: Number(it.lastCostPrice ?? 0),
              newCost: Number(it.netCostPrice ?? 0),
              sellingPrice: Number(plu.sellingPrice ?? 0),
              mrp: Number(plu.mrp ?? 0),
              pluId: plu.id,
            } : null;
          }).filter(Boolean);
        }

        return {
          labelData: valid.length > 0
            ? { ids: valid.map((it) => it.productId), qtys: valid.map((it) => Math.ceil(Number(it.totalQty ?? it.quantity))) }
            : null,
          reviewItems,
          grnId: id,
        };
      } catch {
        return { labelData: null, reviewItems: [], grnId: id };
      }
    },
    onSuccess: (result) => {
      toast.success('GRN approved — stock updated');
      if (result?.labelData) setLabelPrompt(result.labelData);
      if (result?.reviewItems?.length > 0) {
        const updates: Record<string, string> = {};
        result.reviewItems.forEach((it: any) => { updates[it.pluId] = String(it.sellingPrice); });
        setPriceReviewUpdates(updates);
        setPriceReview({ grnId: result.grnId, items: result.reviewItems });
      }
      queryClient.invalidateQueries({ queryKey: ['grns'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Approval failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/grn/${id}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success('GRN rejected');
      setRejectTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['grns'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Rejection failed'),
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/grn/${id}/revert`, {}),
    onSuccess: () => {
      toast.success('GRN reverted to Draft');
      queryClient.invalidateQueries({ queryKey: ['grns'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Revert failed'),
  });

  const paymentMutation = useMutation({
    mutationFn: async (vars: {
      supplierId: string; purchaseId: string; invoiceReference: string;
      paymentDate: string; amount: number; paymentMode: string;
      referenceNumber?: string; notes?: string;
    }) => {
      await api.post(`/suppliers/${vars.supplierId}/payments`, {
        purchaseId:       vars.purchaseId,
        invoiceReference: vars.invoiceReference,
        paymentDate:      vars.paymentDate,
        amount:           vars.amount,
        paymentMode:      vars.paymentMode,
        referenceNumber:  vars.referenceNumber,
        notes:            vars.notes,
      });
    },
    onSuccess: () => {
      toast.success('Payment recorded');
      setPayModal(null);
      queryClient.invalidateQueries({ queryKey: ['grns'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Payment failed'),
  });

  const creditNoteMutation = useMutation({
    mutationFn: async (vars: {
      supplierId: string; originalGrnId: string; originalInvoiceNo: string;
      supplierCnNumber?: string; cnDate: string; reason: string;
      taxableAmount: number; gstRate: number; cessAmount?: number;
      itcReversal: boolean; notes?: string;
    }) => {
      const res = await api.post('/grn/credit-notes', vars);
      return res.data?.scnNumber ?? 'SCN';
    },
    onSuccess: (scn) => {
      toast.success(`Credit Note ${scn} created. Supplier balance reduced by Rs.${fmt(cnTotal)}`);
      setCnModal(null);
      queryClient.invalidateQueries({ queryKey: ['grns'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create credit note'),
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    setPage(1);
  }

  function openPayModal(g: GrnSummary) {
    setPayModal(g);
    setPaySummary(paymentSummaries[g.id] ?? null);
    setPayForm({
      paymentDate: todayIso(),
      amount: '',
      paymentMode: 'CASH',
      referenceNumber: '',
      notes: '',
    });
  }

  function openCnModal(g: GrnSummary) {
    setCnModal(g);
    setCnForm({ ...EMPTY_CN_FORM, cnDate: todayIso() });
  }

  const cnTaxable = Number(cnForm.taxableAmount) || 0;
  const cnGstAmt  = Math.round(cnTaxable * cnForm.gstRate / 100 * 100) / 100;
  const cnCess    = Number(cnForm.cessAmount) || 0;
  const cnTotal   = Math.round((cnTaxable + cnGstAmt + cnCess) * 100) / 100;

  function paymentStatusChip(ps: PaymentSummary | undefined, grn?: { id: string; grnNumber: string | null }) {
    if (!ps) return <span className="text-xs text-gray-400 italic">Payment: —</span>;
    // Paid / Partial → clickable to open payment details; Unpaid → plain text
    const hasPayment = (ps.isPaid || ps.balance <= 0 || ps.totalPaid > 0);
    const label = (ps.isPaid || ps.balance <= 0)
      ? <span className="text-green-600">Paid</span>
      : ps.totalPaid > 0
        ? <span className="text-amber-600">Partial: Rs.{fmt(ps.totalPaid)} paid · Rs.{fmt(ps.balance)} due</span>
        : null;
    if (hasPayment && grn) {
      return (
        <button
          onClick={() => setPaymentDrawer({ id: grn.id, grnNumber: grn.grnNumber })}
          className="text-xs font-medium hover:underline inline-flex items-center gap-1.5"
          title="View payment details"
        >
          {label}
          {ps.coversMultiple && (
            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200"
              title={`Paid together with ${(ps.billCount ?? 2) - 1} other bill(s) in one payment`}>
              ◫ Bulk ×{ps.billCount}
            </span>
          )}
          <span className="text-gray-400">ⓘ</span>
        </button>
      );
    }
    return (
      <span className="text-xs text-red-600 font-medium">
        Unpaid: Rs.{fmt(ps.grandTotal)}
      </span>
    );
  }

  return (
    <>
      <Header
        title="GRN — Goods Receipt Note"
        actions={
          <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        }
      />
      <main className="flex-1 p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {activeTab === 'CREDIT_NOTES'
              ? `${cnListTotal} credit note${cnListTotal !== 1 ? 's' : ''}`
              : `${total} GRN${total !== 1 ? 's' : ''}`}
          </span>
          <div className="ml-auto">
            <button
              onClick={() => router.push('/dashboard/grn/v2')}
              className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
            >
              <Plus className="w-4 h-4" /> New GRN
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={TABS.map(t => ({ key: t.key, label: t.label }))}
          active={activeTab}
          onChange={(tab) => switchTab(tab as TabKey)}
          variant="pill"
        />

        {/* Filter bar (GRN tabs only) */}
        {activeTab !== 'CREDIT_NOTES' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search GRN #, invoice or supplier…"
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                />
                {searchInput && (
                  <button onClick={() => setSearchInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filters toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'border-[#1B4F8A] text-[#1B4F8A] bg-blue-50'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" /> Filters
                {hasActiveFilters && (
                  <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-[#1B4F8A] rounded-full">●</span>
                )}
              </button>

              {/* Sort dropdown */}
              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [b, d] = e.target.value.split(':');
                  setSortBy(b); setSortDir(d as 'asc' | 'desc'); setPage(1);
                }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white text-gray-700"
                title="Sort"
              >
                <option value="date:desc">Newest first</option>
                <option value="date:asc">Oldest first</option>
                <option value="amount:desc">Amount: high → low</option>
                <option value="amount:asc">Amount: low → high</option>
                <option value="supplier:asc">Supplier: A → Z</option>
                <option value="supplier:desc">Supplier: Z → A</option>
                <option value="grnNumber:desc">GRN # ↓</option>
                <option value="grnNumber:asc">GRN # ↑</option>
                <option value="invoiceNumber:asc">Invoice # ↑</option>
                <option value="invoiceNumber:desc">Invoice # ↓</option>
              </select>

              {hasActiveFilters && (
                <button onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>

            {/* Advanced filters panel */}
            {showFilters && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Supplier</label>
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                  >
                    <option value="">All suppliers</option>
                    {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Payment status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                  >
                    <option value="">Any</option>
                    <option value="UNPAID">Unpaid</option>
                    <option value="PARTIAL">Partially paid</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Invoice date from</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Invoice date to</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Min amount (Rs.)</label>
                  <input type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Max amount (Rs.)</label>
                  <input type="number" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Any"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white" />
                </div>

                {paymentStatus && (
                  <p className="col-span-full text-xs text-gray-400">
                    Payment status filter applies to approved GRNs only.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Credit Notes Tab Content */}
        {activeTab === 'CREDIT_NOTES' ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {cnIsLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : creditNotes.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No supplier credit notes yet</p>
                <p className="text-gray-300 text-xs mt-1">Click [CN] on an approved GRN to create one</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">SCN #</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">GRN Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Reason</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-800">{cn.scnNumber}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{fmtDate(cn.cnDate)}</td>
                      <td className="px-4 py-3 font-medium">
                        {cn.supplier?.id ? (
                          <button onClick={() => router.push(`/dashboard/suppliers/${cn.supplier.id}`)}
                            className="text-[#1B4F8A] hover:underline text-left" title="Open supplier dashboard">
                            {cn.supplier.name}
                          </button>
                        ) : <span className="text-gray-700">{cn.supplier?.name ?? '—'}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        {cn.originalGrnId ? (
                          <button onClick={() => router.push(`/dashboard/grn/${cn.originalGrnId}`)}
                            className="text-[#1B4F8A] hover:underline text-left" title="Open original GRN">
                            {cn.originalInvoiceNo ?? 'View GRN'}
                          </button>
                        ) : <span className="text-gray-500">{cn.originalInvoiceNo ?? '—'}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm hidden lg:table-cell max-w-xs truncate">
                        {cn.reason}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        Rs.{fmt(cn.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                          cn.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {cn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* GRN Table */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : grns.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No GRNs found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => toggleSort('grnNumber')} className="inline-flex items-center gap-1 hover:text-[#1B4F8A]">
                        GRN # {sortArrow('grnNumber')}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => toggleSort('supplier')} className="inline-flex items-center gap-1 hover:text-[#1B4F8A]">
                        Supplier {sortArrow('supplier')}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                      <button onClick={() => toggleSort('invoiceNumber')} className="inline-flex items-center gap-1 hover:text-[#1B4F8A]">
                        Invoice {sortArrow('invoiceNumber')}
                      </button>
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 hover:text-[#1B4F8A] ml-auto">
                        Total {sortArrow('amount')}
                      </button>
                    </th>
                    {activeTab === 'ALL' && (
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    )}
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                {grns.map((g) => {
                    const badge = STATUS_BADGE[g.status] ?? STATUS_BADGE.DRAFT;
                    const busy = (submitMutation.isPending && submitMutation.variables === g.id) ||
                                 (approveMutation.isPending && approveMutation.variables === g.id) ||
                                 (rejectMutation.isPending && (rejectMutation.variables as any)?.id === g.id) ||
                                 (revertMutation.isPending && revertMutation.variables === g.id) ||
                                 (deleteMutation.isPending && (deleteMutation.variables as any)?.id === g.id);
                    const colCount = activeTab === 'ALL' ? 6 : 5;

                    const grnDate  = fmtDate(g.receivedDate ?? g.createdAt);
                    const itemCount = g._count.items;

                    const ict  = Number(g.invoiceControlTotal ?? 0);
                    const gt   = Number(g.grandTotal);
                    const diff = ict > 0 ? Math.abs(gt - ict) : null;

                    const ps = paymentSummaries[g.id];

                    return (
                      <tbody key={g.id} className="group border-b border-gray-100 last:border-0">
                        {/* Line 1 — main row */}
                        <tr className="group-hover:bg-gray-50 transition-colors">
                          <td className="px-4 pt-3 pb-0.5">
                            {g.grnNumber ? (
                              <button
                                onClick={() => router.push(`/dashboard/grn/${g.id}`)}
                                className="font-mono font-medium text-[#1B4F8A] hover:underline text-left"
                                title="Open GRN"
                              >
                                {g.grnNumber}
                              </button>
                            ) : (
                              <span className="font-mono font-medium text-gray-400 italic">Draft</span>
                            )}
                          </td>
                          <td className="px-4 pt-3 pb-0.5">
                            <button
                              onClick={() => router.push(`/dashboard/suppliers/${g.supplierId}`)}
                              className="font-medium text-[#1B4F8A] hover:underline text-left"
                              title="Open supplier dashboard"
                            >
                              {g.supplierName}
                            </button>
                          </td>
                          <td className="px-4 pt-3 pb-0.5 hidden md:table-cell">
                            <button
                              onClick={() => router.push(`/dashboard/grn/${g.id}`)}
                              className="text-[#1B4F8A] hover:underline text-left"
                              title="Open GRN"
                            >
                              {g.invoiceNumber}
                            </button>
                            <p className="text-xs text-gray-400">
                              {new Date(g.invoiceDate).toLocaleDateString('en-IN')}
                            </p>
                          </td>
                          <td className="px-4 pt-3 pb-0.5 text-right font-medium text-gray-800">
                            Rs.{fmt(g.grandTotal)}
                          </td>
                          {activeTab === 'ALL' && (
                            <td className="px-4 pt-3 pb-0.5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                                  {badge.label}
                                </span>
                                {g.excludeFromGst && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium" title="Excluded from GST returns">
                                    <ShieldOff className="w-3 h-3" /> GST Excl.
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-4 pt-3 pb-0.5">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">

                              {/* DRAFT */}
                              {g.status === 'DRAFT' && (() => {
                                const dupStatus = duplicateMap[g.id];
                                return (
                                  <>
                                    <button
                                      onClick={() => router.push(`/dashboard/grn/${g.id}`)}
                                      className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded-lg transition-colors"
                                      title="View details"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => router.push(`/dashboard/grn/v2?id=${g.id}`)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    {!dupStatus && (
                                      <button
                                        onClick={() => submitMutation.mutate(g.id)}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                                      >
                                        <Send className="w-3.5 h-3.5" /> Submit
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (!confirm(`Delete GRN for invoice ${g.invoiceNumber}?\nThis cannot be undone.`)) return;
                                        deleteMutation.mutate({ id: g.id, invoiceNumber: g.invoiceNumber });
                                      }}
                                      disabled={busy}
                                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                                        dupStatus
                                          ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                      }`}
                                      title={dupStatus ? `Invoice ${g.invoiceNumber} already exists as ${dupStatus}. Delete this dead draft.` : 'Delete draft'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                );
                              })()}

                              {/* PENDING */}
                              {g.status === 'PENDING_APPROVAL' && (
                                <>
                                  <button
                                    onClick={() => router.push(`/dashboard/grn/v2?id=${g.id}`)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!confirm('Approve this GRN and update stock?')) return;
                                      approveMutation.mutate(g.id);
                                    }}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                  </button>
                                  <button
                                    onClick={() => { setRejectTarget(g.id); setRejectReason(''); }}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                  </button>
                                  <button
                                    onClick={() => router.push(`/dashboard/grn/${g.id}`)}
                                    className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="View details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {/* APPROVED */}
                              {g.status === 'APPROVED' && (
                                <>
                                  <button
                                    onClick={() => ps?.isPaid
                                      ? setPaymentDrawer({ id: g.id, grnNumber: g.grnNumber })
                                      : openPayModal(g)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                      ps?.isPaid
                                        ? 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    }`}
                                    title={ps?.isPaid ? 'View payment details' : 'Record payment'}
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    {ps?.isPaid ? 'Paid' : 'Pay'}
                                  </button>
                                  <button
                                    onClick={() => openCnModal(g)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                                    title="Create Supplier Credit Note"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> CN
                                  </button>
                                  <button
                                    onClick={() => router.push(`/dashboard/grn/v2?id=${g.id}`)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                  </button>
                                  <button
                                    onClick={() => router.push(`/dashboard/grn/${g.id}`)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View
                                  </button>
                                  <button
                                    onClick={() => window.open(`/dashboard/grn/${g.id}/print`, '_blank')}
                                    className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Print A4"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {/* REJECTED */}
                              {g.status === 'REJECTED' && (
                                <>
                                  <button
                                    onClick={() => {
                                      if (!confirm('Revert this GRN to Draft for re-editing?')) return;
                                      revertMutation.mutate(g.id);
                                    }}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" /> Revert
                                  </button>
                                  <button
                                    onClick={() => router.push(`/dashboard/grn/${g.id}`)}
                                    className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="View details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {/* CANCELLED — always show view */}
                              {g.status === 'CANCELLED' && (
                                <button
                                  onClick={() => router.push(`/dashboard/grn/${g.id}`)}
                                  className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}

                            </div>
                          </td>
                        </tr>

                        {/* Line 2 — secondary info */}
                        <tr className="group-hover:bg-gray-50 transition-colors">
                          <td colSpan={colCount} className="px-4 pt-0 pb-2.5">
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-500">{grnDate}</span>
                              <span className="text-gray-300 text-xs">·</span>
                              <span className="text-xs text-gray-500">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                              {diff !== null && (
                                <>
                                  <span className="text-gray-300 text-xs">·</span>
                                  {diff <= 5 ? (
                                    <span className="text-xs text-green-600 font-medium">Matched</span>
                                  ) : (
                                    <span className="text-xs text-amber-600 font-medium">Diff: Rs.{fmt(diff)}</span>
                                  )}
                                </>
                              )}
                              {g.status === 'APPROVED' && (
                                <>
                                  <span className="text-gray-300 text-xs">·</span>
                                  {paymentStatusChip(ps, { id: g.id, grnNumber: g.grnNumber })}
                                </>
                              )}
                              {g.status === 'DRAFT' && duplicateMap[g.id] && (
                                <>
                                  <span className="text-gray-300 text-xs">·</span>
                                  <span
                                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700"
                                    title={`Invoice ${g.invoiceNumber} already exists as ${duplicateMap[g.id]}. This draft cannot be submitted.`}
                                  >
                                    <AlertTriangle className="w-3 h-3" /> Duplicate Invoice
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    );
                  })}
              </table>
            )}
          </div>
        )}

        {/* Pagination */}
        {activeTab === 'CREDIT_NOTES' ? (
          cnTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: cnTotalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCnPage(p)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    p === cnPage
                      ? 'bg-[#1B4F8A] text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1B4F8A]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )
        ) : (
          totalPages > 1 && (
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
          )
        )}
      </main>

      {/* Reject reason modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Reject GRN</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason…"
              rows={3}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-400 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) { toast.error('Enter rejection reason'); return; }
                  rejectMutation.mutate({ id: rejectTarget, reason: rejectReason });
                }}
                disabled={rejectMutation.isPending}
                className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-60"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label print prompt after approval */}
      {labelPrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">GRN Approved</h3>
                <p className="text-sm text-gray-500 mt-0.5">Print barcode labels for received products?</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {labelPrompt.ids.length} product{labelPrompt.ids.length !== 1 ? 's' : ''} — quantities pre-filled from received amounts
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setLabelPrompt(null)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-600"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  const ids  = labelPrompt.ids.join(',');
                  const qtys = labelPrompt.qtys.join(',');
                  setLabelPrompt(null);
                  router.push(`/dashboard/products/labels?ids=${ids}&qty=${qtys}`);
                }}
                className="flex-1 py-2.5 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium flex items-center justify-center gap-2"
              >
                <Tag className="w-4 h-4" /> Print Labels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Review modal after GRN approval */}
      {priceReview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Cost Changed — Review Selling Prices
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {priceReview.items.length} product{priceReview.items.length !== 1 ? 's' : ''} have new cost prices. Adjust selling prices if needed.
                </p>
              </div>
              <button onClick={() => setPriceReview(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {priceReview.items.map((it) => (
                <div key={it.pluId} className="border border-gray-200 rounded-xl p-3">
                  <div className="font-medium text-sm text-gray-800 mb-2">{it.productName}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-gray-400 mb-0.5">Old Cost</div>
                      <div className="font-semibold text-red-600">₹{it.oldCost.toFixed(2)}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-gray-400 mb-0.5">New Cost</div>
                      <div className="font-semibold text-green-600">₹{it.newCost.toFixed(2)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-gray-400 mb-0.5">MRP</div>
                      <div className="font-semibold text-blue-600">₹{it.mrp.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">New Selling Price:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={priceReviewUpdates[it.pluId] ?? String(it.sellingPrice)}
                      onChange={(e) => setPriceReviewUpdates(u => ({ ...u, [it.pluId]: e.target.value }))}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#1B4F8A] font-semibold"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setPriceReview(null)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
                Skip (Keep Current Prices)
              </button>
              <button
                onClick={async () => {
                  try {
                    await Promise.all(
                      priceReview.items.map(it => {
                        const newPrice = parseFloat(priceReviewUpdates[it.pluId] ?? String(it.sellingPrice));
                        if (isNaN(newPrice) || newPrice === it.sellingPrice) return Promise.resolve();
                        return api.patch(`/products/${it.productId}/plus/${it.pluId}`, { sellingPrice: newPrice });
                      })
                    );
                    toast.success('Selling prices updated');
                  } catch { toast.error('Some prices failed to update'); }
                  setPriceReview(null);
                }}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163d6d] font-medium"
              >
                Update Prices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Credit Note modal */}
      {cnModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCnModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Supplier Credit Note</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Against {cnModal.grnNumber ?? 'Draft'} — {cnModal.supplierName}
                </p>
              </div>
              <button onClick={() => setCnModal(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* GRN details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice</span>
                  <span className="text-gray-700 font-medium">{cnModal.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GRN Total</span>
                  <span className="font-semibold text-gray-800">Rs.{fmt(cnModal.grandTotal)}</span>
                </div>
              </div>

              {cnTotal > Number(cnModal.grandTotal) && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Credit note (Rs.{fmt(cnTotal)}) exceeds GRN total (Rs.{fmt(cnModal.grandTotal)})
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Credit Note Date *</label>
                  <input
                    type="date"
                    value={cnForm.cnDate}
                    max={todayIso()}
                    onChange={(e) => setCnForm({ ...cnForm, cnDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Supplier CN# (optional)</label>
                  <input
                    value={cnForm.supplierCnNumber}
                    onChange={(e) => setCnForm({ ...cnForm, supplierCnNumber: e.target.value })}
                    placeholder="Supplier's ref number"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Reason *</label>
                <select
                  value={cnForm.reason}
                  onChange={(e) => setCnForm({ ...cnForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                >
                  <option value="">Select reason…</option>
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea
                  value={cnForm.description}
                  onChange={(e) => setCnForm({ ...cnForm, description: e.target.value })}
                  placeholder="e.g. 2 bottles of Horlicks 500g received damaged"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] resize-none"
                />
              </div>

              {/* Amount section */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Taxable Amount (Rs.) *</label>
                    <input
                      type="number"
                      value={cnForm.taxableAmount}
                      onChange={(e) => setCnForm({ ...cnForm, taxableAmount: e.target.value })}
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">GST Rate</label>
                    <select
                      value={cnForm.gstRate}
                      onChange={(e) => setCnForm({ ...cnForm, gstRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                    >
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">GST Amount (Rs.)</label>
                    <input
                      readOnly
                      value={cnGstAmt.toFixed(2)}
                      className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-100 text-gray-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">CESS Amount (Rs.)</label>
                    <input
                      type="number"
                      value={cnForm.cessAmount}
                      onChange={(e) => setCnForm({ ...cnForm, cessAmount: e.target.value })}
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">Total Credit Note</span>
                  <span className={`text-lg font-bold ${cnTotal > Number(cnModal.grandTotal) ? 'text-red-600' : 'text-gray-900'}`}>
                    Rs.{fmt(cnTotal)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Internal Notes (optional)</label>
                <input
                  value={cnForm.notes}
                  onChange={(e) => setCnForm({ ...cnForm, notes: e.target.value })}
                  placeholder="Additional notes…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setCnForm({ ...cnForm, itcReversal: !cnForm.itcReversal })}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${cnForm.itcReversal ? 'bg-orange-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cnForm.itcReversal ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">ITC Reversal required</span>
              </label>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setCnModal(null)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!cnForm.reason) { toast.error('Select a reason'); return; }
                  if (!cnForm.description.trim()) { toast.error('Enter a description'); return; }
                  if (!cnTaxable || cnTaxable <= 0) { toast.error('Enter taxable amount'); return; }
                  if (cnTotal > Number(cnModal.grandTotal)) {
                    toast.error(`Credit note (Rs.${fmt(cnTotal)}) exceeds GRN total (Rs.${fmt(cnModal.grandTotal)})`);
                    return;
                  }
                  creditNoteMutation.mutate({
                    supplierId:        cnModal.supplierId,
                    originalGrnId:     cnModal.id,
                    originalInvoiceNo: cnModal.invoiceNumber,
                    supplierCnNumber:  cnForm.supplierCnNumber || undefined,
                    cnDate:            cnForm.cnDate,
                    reason:            cnForm.reason + (cnForm.description ? ` — ${cnForm.description}` : ''),
                    taxableAmount:     cnTaxable,
                    gstRate:           cnForm.gstRate,
                    cessAmount:        cnCess || undefined,
                    itcReversal:       cnForm.itcReversal,
                    notes:             cnForm.notes || undefined,
                  });
                }}
                disabled={creditNoteMutation.isPending || cnTotal > Number(cnModal.grandTotal)}
                className="flex-1 py-2.5 text-sm bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-60 font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {creditNoteMutation.isPending ? 'Creating…' : 'Create Credit Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Record Payment</h3>
              <button onClick={() => setPayModal(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Invoice summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier</span>
                  <span className="font-medium text-gray-800">{payModal.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice</span>
                  <span className="text-gray-700">{payModal.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice Amount</span>
                  <span className="font-medium text-gray-800">Rs.{fmt(payModal.grandTotal)}</span>
                </div>
                {paySummary && paySummary.totalPaid > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Previously Paid</span>
                    <span className="font-medium">Rs.{fmt(paySummary.totalPaid)}</span>
                  </div>
                )}
                {paySummary && (paySummary.totalCreditNotes ?? 0) > 0 && (
                  <div className="flex justify-between text-orange-700">
                    <span>Credit Notes</span>
                    <span className="font-medium">- Rs.{fmt(paySummary.totalCreditNotes ?? 0)}</span>
                  </div>
                )}
                {paySummary && (
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                    <span className="font-semibold text-gray-700">Balance Due</span>
                    <span className={`font-bold ${paySummary.balance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Rs.{fmt(Math.max(0, paySummary.balance))}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment form */}
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
                    placeholder={paySummary ? String(Math.max(0, paySummary.balance).toFixed(2)) : '0.00'}
                    min={0}
                    autoFocus
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
                onClick={() => setPayModal(null)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amt = Number(payForm.amount);
                  if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
                  if (!payModal) return;
                  paymentMutation.mutate({
                    supplierId:       payModal.supplierId,
                    purchaseId:       payModal.id,
                    invoiceReference: payModal.invoiceNumber,
                    paymentDate:      payForm.paymentDate,
                    amount:           amt,
                    paymentMode:      payForm.paymentMode,
                    referenceNumber:  payForm.referenceNumber || undefined,
                    notes:            payForm.notes || undefined,
                  });
                }}
                disabled={paymentMutation.isPending}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {paymentMutation.isPending ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentDrawer && (
        <PaymentDetailsDrawer
          grnId={paymentDrawer.id}
          grnNumber={paymentDrawer.grnNumber}
          onClose={() => setPaymentDrawer(null)}
          onOpenSupplier={(sid) => { setPaymentDrawer(null); router.push(`/dashboard/suppliers/${sid}`); }}
        />
      )}
    </>
  );
}

// ─── Payment details slide-over (lookup drawer) ─────────────────────────────
function PaymentDetailsDrawer({
  grnId, grnNumber, onClose,
}: {
  grnId: string;
  grnNumber: string | null;
  onClose: () => void;
  onOpenSupplier?: (supplierId: string) => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['grn-payments', grnId],
    queryFn: async () => (await api.get(`/grn/${grnId}/payments`)).data,
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const inr = (n: number) => Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const isoDate = (d: string) => new Date(d).toISOString().slice(0, 10);
  const reasonLabel: Record<string, string> = {
    BANK_CHARGE: 'Bank charge', TDS: 'TDS deducted', CASH_DISCOUNT: 'Cash discount',
    ROUNDING: 'Rounding', SHORT_PAYMENT: 'Short payment',
  };

  function startEdit(p: any) {
    setEditId(p.id);
    setForm({
      paymentDate: isoDate(p.paymentDate), paymentMode: p.paymentMode ?? 'NEFT',
      referenceNumber: p.referenceNumber ?? '', utrNumber: p.utrNumber ?? '',
      epayOrderNumber: p.epayOrderNumber ?? '', adjustmentReason: p.adjustmentReason ?? '',
      notes: p.notes ?? '',
    });
  }

  async function savePayment(paymentId: string, patch?: any) {
    setSavingId(paymentId);
    try {
      await api.patch(`/grn/payments/${paymentId}`, patch ?? form);
      toast.success('Payment updated');
      setEditId(null);
      await qc.invalidateQueries({ queryKey: ['grn-payments', grnId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update');
    } finally { setSavingId(null); }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#1B4F8A]';

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Payment Details</h2>
            <p className="text-xs text-gray-400 mt-0.5">{grnNumber ?? 'GRN'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !data?.payments?.length ? (
            <p className="text-sm text-gray-400">No payments recorded for this GRN yet.</p>
          ) : (
            data.payments.map((p: any) => {
              const editing = editId === p.id;
              return (
              <div key={p.id} className="border border-gray-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Rs.{inr(p.allocatedToThis ?? p.amount)}</span>
                  <div className="flex items-center gap-2">
                    {p.matchedFromStatement && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium border border-green-200">
                        ✓ Bank-verified
                      </span>
                    )}
                    {!editing && (
                      <button onClick={() => startEdit(p)} className="text-xs text-[#1B4F8A] hover:underline">Edit</button>
                    )}
                  </div>
                </div>
                {p.coversMultiple && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      Bulk payment of Rs.{inr(p.amount)} · {p.billCount} bills
                    </p>
                    <div className="space-y-1">
                      {p.bills.map((b: any) => (
                        <button
                          key={b.purchaseId}
                          onClick={() => { if (!b.isThisBill) { onClose(); router.push(`/dashboard/grn/${b.purchaseId}`); } }}
                          disabled={b.isThisBill}
                          className={`w-full flex items-center justify-between text-[11px] px-2 py-1 rounded ${
                            b.isThisBill
                              ? 'bg-amber-100 text-amber-900 font-semibold cursor-default'
                              : 'bg-white text-[#1B4F8A] hover:bg-blue-50'
                          }`}
                          title={b.isThisBill ? 'This bill' : 'Open this bill'}
                        >
                          <span className="truncate">
                            {b.isThisBill && '▸ '}{b.grnNumber ?? b.invoiceNumber ?? 'Bill'}
                            {b.invoiceNumber && b.grnNumber ? ` · ${b.invoiceNumber}` : ''}
                          </span>
                          <span className="shrink-0 ml-2 font-medium">Rs.{inr(b.allocatedAmount)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editing ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase">Date</label>
                      <input type="date" value={form.paymentDate} onChange={e => setForm((f: any) => ({ ...f, paymentDate: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase">Mode</label>
                      <select value={form.paymentMode} onChange={e => setForm((f: any) => ({ ...f, paymentMode: e.target.value }))} className={inputCls}>
                        {['NEFT', 'RTGS', 'IMPS', 'UPI', 'CASH', 'CHEQUE'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase">UTR</label>
                      <input value={form.utrNumber} onChange={e => setForm((f: any) => ({ ...f, utrNumber: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase">Reference</label>
                      <input value={form.referenceNumber} onChange={e => setForm((f: any) => ({ ...f, referenceNumber: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-400 uppercase">Order No. (PhonePe/GPay)</label>
                      <input value={form.epayOrderNumber} onChange={e => setForm((f: any) => ({ ...f, epayOrderNumber: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2 flex gap-2 pt-1">
                      <button onClick={() => savePayment(p.id)} disabled={savingId === p.id}
                        className="flex-1 py-1.5 text-xs bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-60">
                        {savingId === p.id ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <Detail label="Date" value={fmtDt(p.paymentDate)} />
                    <Detail label="Mode" value={p.paymentMode} />
                    {p.utrNumber       && <Detail label="UTR" value={p.utrNumber} />}
                    {p.referenceNumber && <Detail label="Reference" value={p.referenceNumber} />}
                    {p.epayOrderNumber && <Detail label="Order No." value={p.epayOrderNumber} />}
                    {Number(p.adjustmentAmount) !== 0 && (
                      <Detail label="Adjustment" value={`Rs.${inr(p.adjustmentAmount)} (${reasonLabel[p.adjustmentReason] ?? p.adjustmentReason ?? '—'})`} />
                    )}
                    <Detail label="By" value={p.createdByName} />
                  </div>
                )}

                {/* Always-editable remark */}
                <RemarkBox initial={p.notes ?? ''} saving={savingId === p.id && !editing}
                  onSave={(notes) => savePayment(p.id, { notes })} />

                {/* Payment-proof screenshot — paste / drag / browse */}
                <ProofUpload
                  paymentId={p.id}
                  screenshotUrl={p.screenshotUrl}
                  onUploaded={() => qc.invalidateQueries({ queryKey: ['grn-payments', grnId] })}
                />
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-gray-700 font-medium break-all">{value}</p>
    </div>
  );
}

// Always-editable remark/reason box — saves only when changed
function RemarkBox({ initial, onSave, saving }: { initial: string; onSave: (notes: string) => void; saving: boolean }) {
  const [val, setVal] = useState(initial);
  const dirty = val !== initial;
  return (
    <div className="border-t border-gray-100 pt-2">
      <label className="text-[10px] text-gray-400 uppercase tracking-wide">Remark / Reason</label>
      <div className="flex items-center gap-2 mt-1">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Add a remark…"
          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#1B4F8A]"
        />
        {dirty && (
          <button onClick={() => onSave(val)} disabled={saving}
            className="px-2.5 py-1.5 text-xs bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-60 shrink-0">
            {saving ? '…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}

// Payment-proof upload — accepts paste (Ctrl+V), drag-drop, or click-to-browse
function ProofUpload({ paymentId, screenshotUrl, onUploaded }: {
  paymentId: string; screenshotUrl: string | null; onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/?$/, '');
  const fullUrl = screenshotUrl
    ? (screenshotUrl.startsWith('http') ? screenshotUrl : apiBase + screenshotUrl)
    : null;

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please use an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/grn/payments/${paymentId}/proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Proof uploaded');
      onUploaded();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Upload failed');
    } finally { setUploading(false); }
  }

  async function removeProof() {
    if (!confirm('Remove this payment screenshot?')) return;
    setUploading(true);
    try {
      await api.delete(`/grn/payments/${paymentId}/proof`);
      toast.success('Proof removed');
      onUploaded();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to remove');
    } finally { setUploading(false); }
  }

  const [focused, setFocused] = useState(false);

  function handleImageFromClipboard(items: DataTransferItemList | null): boolean {
    if (!items) return false;
    const item = Array.from(items).find((i) => i.type.startsWith('image/'));
    if (item) { const f = item.getAsFile(); if (f) { upload(f); return true; } }
    return false;
  }

  return (
    <div className="border-t border-gray-100 pt-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-gray-400 uppercase tracking-wide">Payment Proof</label>
        <button onClick={() => fileRef.current?.click()} className="text-[10px] text-[#1B4F8A] hover:underline">
          Browse file
        </button>
      </div>
      {fullUrl && (
        <div className="relative inline-block mt-1 mb-1.5">
          <a href={fullUrl} target="_blank" rel="noreferrer" className="block">
            <img src={fullUrl} alt="Payment proof"
              className="max-h-32 rounded-lg border border-gray-200 object-contain" />
          </a>
          <button onClick={removeProof} disabled={uploading}
            title="Remove screenshot"
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600 disabled:opacity-50">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => { if (handleImageFromClipboard(e.clipboardData.items)) e.preventDefault(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className={`mt-1 cursor-pointer rounded-lg border border-dashed px-3 py-3 text-center text-[11px] transition-colors outline-none ${
          dragOver || focused ? 'border-[#1B4F8A] bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {uploading
          ? <span className="text-gray-500">Uploading…</span>
          : focused
            ? <span className="text-[#1B4F8A] font-medium">Ready — press <b>Ctrl+V</b> to paste your screenshot</span>
            : <span className="text-gray-500">
                📋 <b>Click here first</b>, then press <b>Ctrl+V</b> to paste a screenshot.<br />
                <span className="text-gray-400">…or drag an image in, or use “Browse file” above.</span>
              </span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ChevronDown, Save, Send, Calendar, Settings } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useERPBroadcast } from '@/hooks/useERPBroadcast';
import { openInNewWindow } from '@/lib/new-window';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { FieldHelp } from '@/components/ui/FieldHelp';
import { useFormAutosave } from '@/hooks/useFormAutosave';
import { RestoreBanner } from '@/components/ui/RestoreBanner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchProduct {
  id: string; name: string; hsnCode?: string; unitOfMeasure: string;
  mrp: number | string; sellingPrice: number | string; costPrice?: number | string | null;
  cessRate?: number | string; gstRatePercent?: number | string;
  barcode?: string | null;
}

interface GrnItem {
  productId: string; productName: string; hsnCode: string; unitOfMeasure: string; gstRate: number;
  basicCostPrice: number;
  disc1Percent: number; disc2Percent: number; disc3Percent: number; disc4Percent: number;
  cashDiscPercent: number;
  casesReceived: number; looseQty: number; packSize: number;
  freeCases: number; freeLoose: number;
  mrp: number; sellingPrice: number; cessRate: number;
  batchNumber: string; expiryDate: string;
  rejectedQty: number; rejectionReason: string;
}

interface Adj {
  billDiscountPercent: number; freightCharges: number;
  hamaliCharges: number; otherCharges: number; roundingAmount: number;
  advanceAdjusted: number; paymentDueDate: string; paymentMode: string;
  paymentReference: string; paymentNotes: string;
}

interface PopupData {
  supplierId: string; supplierName: string; supplierGstin: string;
  invoiceNumber: string; invoiceDateRaw: string; invoiceDateISO: string;
  invoiceControlTotal: number; taxType: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';
}

interface ERPToast {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const pad2 = (num: number) => String(num).padStart(2, '0');

function getTodayISO() { return new Date().toISOString().split('T')[0]; }

function getTodayDisplay() {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function getSixMonthsAgoISO() {
  const d = new Date(); d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isValidDMY(s: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return false;
  const day = +m[1], month = +m[2], year = +m[3];
  if (month < 1 || month > 12) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function dmyToISO(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function isoToDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// ── Calc helpers ──────────────────────────────────────────────────────────────

const r2 = (x: number) => Math.round(x * 100) / 100;
const n = (v: unknown) => Number(v) || 0;

function calcItem(item: GrnItem, taxType: string, isInterState: boolean) {
  const netCostPrice = r2(
    item.basicCostPrice
    * (1 - item.disc1Percent / 100)
    * (1 - item.disc2Percent / 100)
    * (1 - item.disc3Percent / 100)
    * (1 - item.disc4Percent / 100),
  );
  const totalReceivedQty = r2(item.casesReceived * item.packSize + item.looseQty);
  let taxable = taxType === 'TAX_INCLUSIVE'
    ? r2((netCostPrice / (1 + item.gstRate / 100)) * totalReceivedQty)
    : r2(netCostPrice * totalReceivedQty);
  taxable = r2(taxable - r2(taxable * item.cashDiscPercent / 100));
  const cessAmount = r2(taxable * item.cessRate / 100);
  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) { igst = r2(taxable * item.gstRate / 100); }
  else { cgst = r2(taxable * item.gstRate / 2 / 100); sgst = cgst; }
  const lineTotal = r2(taxable + cgst + sgst + igst + cessAmount);
  return { netCostPrice, totalReceivedQty, taxable, cgst, sgst, igst, cess: cessAmount, lineTotal };
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultAdj: Adj = {
  billDiscountPercent: 0, freightCharges: 0, hamaliCharges: 0,
  otherCharges: 0, roundingAmount: 0, advanceAdjusted: 0,
  paymentDueDate: '', paymentMode: '', paymentReference: '', paymentNotes: '',
};

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const DEFAULT_GST_RATES = [0, 5, 12, 18, 28];

// ── Num input ────────────────────────────────────────────────────────────────

function Num({ value, onChange, min = 0, step = '0.01', placeholder = '' }: {
  value: number; onChange: (v: number) => void;
  min?: number; step?: string; placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      min={min} step={step} placeholder={placeholder}
      className="w-full px-1.5 py-1 text-right text-xs border border-gray-200 rounded focus:outline-none focus:border-[#1B4F8A]"
    />
  );
}

// ── Supplier combo ───────────────────────────────────────────────────────────

function SupplierCombo({
  suppliers, value, onSelect,
}: {
  suppliers: { id: string; name: string; gstin?: string }[];
  value: string;
  onSelect: (id: string, name: string, gstin: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const selected = suppliers.find((s) => s.id === value);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = search.trim()
    ? suppliers.filter((s) => {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.gstin ?? '').toLowerCase().includes(q);
      })
    : suppliers;

  const onKeyDown = useKeyboardNav({
    count: filtered.length,
    activeIndex: activeIdx,
    setActiveIndex: setActiveIdx,
    onSelect: (i) => { onSelect(filtered[i].id, filtered[i].name, filtered[i].gstin ?? ''); setOpen(false); setSearch(''); setActiveIdx(-1); },
    onClose: () => { setOpen(false); setActiveIdx(-1); },
  });

  return (
    <div className="relative" ref={ref}>
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setSearch(''); }}
          className="finp text-left flex items-center justify-between w-full"
        >
          <span className="truncate text-sm">{selected.name}</span>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
        </button>
      ) : (
        <input
          autoFocus={open}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="finp"
          placeholder="Search supplier…"
        />
      )}
      {open && (
        <div className="absolute top-full left-0 w-full min-w-[280px] bg-white border border-gray-200 rounded-xl shadow-xl z-50 mt-1 max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No suppliers found</div>
          ) : filtered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSelect(s.id, s.name, s.gstin ?? ''); setOpen(false); setSearch(''); setActiveIdx(-1); }}
              className={`w-full text-left px-4 py-2.5 text-sm ${i === activeIdx ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
            >
              <div className="font-medium text-gray-800">{s.name}</div>
              {s.gstin && <div className="text-xs text-gray-400">{s.gstin}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Date field ───────────────────────────────────────────────────────────────

function DateField({
  raw, onRaw, error, warn, calRef, maxISO,
}: {
  raw: string; onRaw: (v: string) => void;
  error?: string; warn?: string;
  calRef: React.RefObject<HTMLInputElement>;
  maxISO: string;
}) {
  return (
    <div>
      <div className="relative">
        <input
          value={raw}
          onChange={(e) => onRaw(formatDateInput(e.target.value))}
          className={`finp pr-8 ${error ? 'border-red-400' : ''}`}
          placeholder="DD/MM/YYYY"
          maxLength={10}
        />
        <button
          type="button"
          onClick={() => calRef.current?.showPicker?.()}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1B4F8A]"
        >
          <Calendar className="w-4 h-4" />
        </button>
        <input
          ref={calRef}
          type="date"
          className="sr-only"
          max={maxISO}
          onChange={(e) => onRaw(isoToDMY(e.target.value))}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      {!error && warn && <p className="text-xs text-amber-600 mt-0.5">{warn}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewGrnPage() {
  const router = useRouter();

  // Popup
  const [showStartPopup, setShowStartPopup] = useState(true);
  const [popupData, setPopupData] = useState<PopupData>({
    supplierId: '', supplierName: '', supplierGstin: '',
    invoiceNumber: '', invoiceDateRaw: '', invoiceDateISO: '',
    invoiceControlTotal: 0, taxType: 'TAX_EXCLUSIVE',
  });
  const [popupInvDateError, setPopupInvDateError] = useState('');
  const [popupInvDateWarn, setPopupInvDateWarn]   = useState('');
  const [popupErrors, setPopupErrors]             = useState<Record<string, string>>({});
  const [popupDraft, setPopupDraft]               = useState<any>(null);
  const [popupLoadingSupplier, setPopupLoadingSupplier] = useState(false);
  const popupCalRef = useRef<HTMLInputElement>(null);

  // Business info
  const [businessInfo, setBusinessInfo] = useState({ name: '', gstin: '', branchName: '' });

  // Main form
  const [supplierId, setSupplierId]           = useState('');
  const [supplierGstin, setSupplierGstin]     = useState('');
  const [supplierBalance, setSupplierBalance] = useState<number | null>(null);
  const [lockedSupplierName, setLockedSupplierName] = useState('');
  const [branchId, setBranchId]               = useState('');
  const [invoiceNumber, setInvoiceNumber]     = useState('');
  const [invoiceDateISO, setInvoiceDateISO]   = useState('');
  const [invoiceControlTotal, setInvoiceControlTotal] = useState(0);
  const [taxType, setTaxType]                 = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE'>('TAX_EXCLUSIVE');
  const [docType, setDocType]                 = useState('INVOICE');
  const [itcEligibility, setItcEligibility]   = useState('ELIGIBLE');
  const [placeOfSupply, setPlaceOfSupply]     = useState('');
  const [poNumber, setPoNumber]               = useState('');
  const [adj, setAdj]                         = useState<Adj>(defaultAdj);
  const [notes, setNotes]                     = useState('');

  // Received date
  const [receivedDateRaw, setReceivedDateRaw]     = useState(getTodayDisplay());
  const [receivedDateISO, setReceivedDateISO]     = useState(getTodayISO());
  const [receivedDateError, setReceivedDateError] = useState('');
  const receivedCalRef = useRef<HTMLInputElement>(null);

  const [suppliers, setSuppliers]               = useState<{ id: string; name: string; gstin?: string }[]>([]);
  const [branches, setBranches]                 = useState<{ id: string; name: string }[]>([]);
  const [businessState, setBusinessState]       = useState('');

  const [items, setItems]                       = useState<GrnItem[]>([]);
  const [productSearch, setProductSearch]       = useState('');
  const [productResults, setProductResults]     = useState<SearchProduct[]>([]);
  const [productActiveIdx, setProductActiveIdx] = useState(-1);
  const [gstRates, setGstRates]                 = useState<number[]>(DEFAULT_GST_RATES);
  const [taxUpdateSuggestion, setTaxUpdateSuggestion] = useState<{ idx: number; newGstRate: number; productId: string } | null>(null);
  const [erpToast, setErpToast]                 = useState<ERPToast | null>(null);
  const [saving, setSaving]                     = useState(false);
  const [showGrnRestore, setShowGrnRestore]     = useState(false);

  // Quick product create
  const [showQuickCreate, setShowQuickCreate]   = useState(false);
  const [quickCreateName, setQuickCreateName]   = useState('');
  const [quickCreateSaving, setQuickCreateSaving] = useState(false);
  const [quickCreateForm, setQuickCreateForm]   = useState({
    name: '', categoryId: '', hsnCode: '', unitOfMeasure: 'PCS',
    mrp: '', sellingPrice: '', taxId: '',
  });
  const [quickCreateCats, setQuickCreateCats]   = useState<{ id: string; name: string; label: string }[]>([]);
  const [quickCreateTaxes, setQuickCreateTaxes] = useState<{ id: string; taxName: string; taxRate: number }[]>([]);
  const searchRef        = useRef<HTMLInputElement>(null);
  const grnScanIntentRef = useRef('');

  // GRN intelligence alerts
  const [priceAlerts, setPriceAlerts] = useState<Record<string, { level: 'red' | 'orange' | 'amber' | 'green'; message: string }>>({});
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const lastRatesCache = useRef<Record<string, any[]>>({});

  // Collapsed item cards (by index stored as Set)
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(new Set());

  function toggleCollapse(idx: number) {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  // Auto-save snapshot (items + adjustments) — active only after popup dismissed
  const grnSnapshot = { items, adj, notes, itcEligibility, placeOfSupply, poNumber };
  const grnAutosave = useFormAutosave('grn', grnSnapshot, { enabled: !showStartPopup });
  const todayISO  = getTodayISO();

  const onProductKeyDown = useKeyboardNav({
    count: productResults.length,
    activeIndex: productActiveIdx,
    setActiveIndex: setProductActiveIdx,
    onSelect: (i) => { addProduct(productResults[i]); setProductActiveIdx(-1); },
    onClose: () => { setProductSearch(''); setProductResults([]); setProductActiveIdx(-1); },
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get('/suppliers', { params: { limit: 200 } })
      .then((r) => setSuppliers(r.data.data ?? [])).catch(() => {});
    api.get('/business/info').then((r) => {
      const biz = r.data;
      setBusinessState(biz.stateCode ?? '');
      const list = biz.branches ?? [];
      setBranches(list);
      if (list.length === 1) setBranchId(list[0].id);
      setBusinessInfo({ name: biz.name ?? '', gstin: biz.gstin ?? '', branchName: list[0]?.name ?? '' });
    }).catch(() => {});
    api.get('/admin/taxes').then((r) => {
      const allRates: number[] = (r.data ?? []).map((t: any) => n(t.taxRate ?? t.rate ?? 0));
      const rates = allRates.filter((v, i) => allRates.indexOf(v) === i).sort((a, b) => a - b);
      if (rates.length > 0) setGstRates(rates);
    }).catch(() => {});
  }, []);

  // ── ERP broadcast listener ──────────────────────────────────────────────────

  useERPBroadcast((msg) => {
    if (msg.type === 'PRODUCT_ADDED') {
      const newToast: ERPToast = {
        message: `${msg.name} was added.`,
        actionLabel: 'Add to GRN',
        onAction: () => { addProductById(msg.id); setErpToast(null); },
      };
      setErpToast(newToast);
      setTimeout(() => setErpToast((t) => (t === newToast ? null : t)), 10000);
    }
    if (msg.type === 'SUPPLIER_ADDED') {
      const newToast: ERPToast = {
        message: `${msg.name} added as supplier.`,
        actionLabel: 'Select Supplier',
        onAction: () => {
          setPopupData((p) => ({ ...p, supplierId: msg.id, supplierName: msg.name }));
          if (!showStartPopup) setShowStartPopup(true);
          setErpToast(null);
        },
      };
      setErpToast(newToast);
      setTimeout(() => setErpToast((t) => (t === newToast ? null : t)), 10000);
    }
  });

  // ── Inter-state ─────────────────────────────────────────────────────────────

  const isInterState = useMemo(() => {
    if (!supplierGstin || !businessState) return false;
    return supplierGstin.substring(0, 2) !== businessState;
  }, [supplierGstin, businessState]);

  // ── Popup date ──────────────────────────────────────────────────────────────

  function handlePopupDateRaw(raw: string) {
    const formatted = formatDateInput(raw);
    setPopupInvDateError('');
    setPopupInvDateWarn('');
    setPopupData((p) => ({ ...p, invoiceDateRaw: formatted, invoiceDateISO: '' }));
    if (formatted.length < 10) return;
    if (!isValidDMY(formatted)) { setPopupInvDateError('Invalid date'); return; }
    const iso = dmyToISO(formatted);
    if (iso > getTodayISO()) { setPopupInvDateError('Invoice date cannot be in the future'); return; }
    if (iso < getSixMonthsAgoISO()) setPopupInvDateWarn('Invoice older than 6 months — ITC claim may not be eligible');
    setPopupData((p) => ({ ...p, invoiceDateRaw: formatted, invoiceDateISO: iso }));
  }

  // ── Popup supplier ──────────────────────────────────────────────────────────

  async function handlePopupSupplierSelect(id: string, name: string, gstin: string) {
    setPopupData((p) => ({ ...p, supplierId: id, supplierName: name, supplierGstin: gstin }));
    setPopupDraft(null);
    setPopupLoadingSupplier(true);
    try {
      const [approvedRes, draftRes] = await Promise.all([
        api.get('/grn', { params: { supplierId: id, status: 'APPROVED', limit: 1 } }).catch(() => null),
        api.get('/grn', { params: { supplierId: id, status: 'DRAFT', limit: 1 } }).catch(() => null),
      ]);
      const lastApproved = approvedRes?.data?.data?.[0];
      if (lastApproved?.taxType) setPopupData((p) => ({ ...p, taxType: lastApproved.taxType }));
      const draft = draftRes?.data?.data?.[0];
      if (draft) setPopupDraft(draft);
    } finally {
      setPopupLoadingSupplier(false);
    }
  }

  // ── Popup confirm ───────────────────────────────────────────────────────────

  function handleStartGrn() {
    const errs: Record<string, string> = {};
    if (!popupData.supplierId) errs.supplier = 'Select a supplier';
    if (popupData.invoiceNumber.trim().length < 3) errs.invoiceNumber = 'At least 3 characters';
    if (popupInvDateError) errs.invoiceDate = popupInvDateError;
    else if (!popupData.invoiceDateISO) errs.invoiceDate = 'Enter a valid invoice date';
    if (!popupData.invoiceControlTotal || popupData.invoiceControlTotal <= 0)
      errs.invoiceTotal = 'Invoice total must be > 0';
    setPopupErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSupplierId(popupData.supplierId);
    setLockedSupplierName(popupData.supplierName);
    setSupplierGstin(popupData.supplierGstin);
    setInvoiceNumber(popupData.invoiceNumber);
    setInvoiceDateISO(popupData.invoiceDateISO);
    setTaxType(popupData.taxType);
    setInvoiceControlTotal(popupData.invoiceControlTotal);

    api.get(`/grn/supplier/${popupData.supplierId}/advance`).then((r) => {
      const advances: any[] = r.data ?? [];
      setSupplierBalance(advances.reduce((s: number, a: any) => s + (a.remainingAmount ?? 0), 0));
    }).catch(() => {});

    setShowStartPopup(false);
    // Show restore banner only if no server draft exists
    if (!popupDraft && grnAutosave.hasSaved()) setShowGrnRestore(true);
  }

  // ── Received date ───────────────────────────────────────────────────────────

  function handleReceivedDateRaw(raw: string) {
    const formatted = formatDateInput(raw);
    setReceivedDateRaw(formatted);
    setReceivedDateError('');
    if (formatted.length < 10) { setReceivedDateISO(''); return; }
    if (!isValidDMY(formatted)) { setReceivedDateISO(''); return; }
    const iso = dmyToISO(formatted);
    if (iso > getTodayISO()) { setReceivedDateError('Received date cannot be in the future'); setReceivedDateISO(''); return; }
    if (invoiceDateISO && iso < invoiceDateISO) { setReceivedDateError('Received date cannot be before invoice date'); setReceivedDateISO(''); return; }
    setReceivedDateISO(iso);
  }

  // ── Product search ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(() => {
      api.get('/pos/search', { params: { q: productSearch } })
        .then((r) => setProductResults(r.data ?? []))
        .catch(() => setProductResults([]));
    }, 280);
    return () => clearTimeout(t);
  }, [productSearch]);

  // Auto-select when scanner fires Enter before debounce loads results
  useEffect(() => {
    const intent = grnScanIntentRef.current;
    if (!intent || productResults.length === 0) return;
    grnScanIntentRef.current = '';
    const exact = productResults.find(r => r.barcode === intent);
    const target = exact ?? (productResults.length === 1 ? productResults[0] : null);
    if (target) addProduct(target);
  }, [productResults]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addProduct(p: SearchProduct) {
    setProductSearch('');
    setProductResults([]);
    let lastRate: any = null;
    try {
      const r = await api.get(`/grn/product/${p.id}/last-rates`);
      lastRatesCache.current[p.id] = r.data ?? [];
      lastRate = r.data?.[0] ?? null;
    } catch {}
    if (items.some((i) => i.productId === p.id)) { toast('Product already in list', { icon: 'i' }); return; }
    setItems((prev) => [...prev, {
      productId: p.id, productName: p.name, hsnCode: p.hsnCode ?? '',
      unitOfMeasure: p.unitOfMeasure,
      gstRate: lastRate?.gstRatePercent ?? n(p.gstRatePercent),
      basicCostPrice: lastRate?.basicCostPrice ?? n(p.costPrice),
      disc1Percent: 0, disc2Percent: 0, disc3Percent: 0, disc4Percent: 0, cashDiscPercent: 0,
      casesReceived: 0, looseQty: 0, packSize: 1, freeCases: 0, freeLoose: 0,
      mrp: lastRate?.mrp ?? n(p.mrp),
      sellingPrice: lastRate?.sellingPrice ?? n(p.sellingPrice),
      cessRate: lastRate?.cessRate ?? n(p.cessRate),
      batchNumber: '', expiryDate: '', rejectedQty: 0, rejectionReason: '',
    }]);
  }

  function updateItem(idx: number, patch: Partial<GrnItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removeItem(idx: number) {
    const productId = items[idx]?.productId;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (taxUpdateSuggestion?.idx === idx) setTaxUpdateSuggestion(null);
    if (productId) {
      setPriceAlerts((prev) => { const next = { ...prev }; delete next[productId]; return next; });
      setDismissedAlerts((prev) => { const next = new Set(prev); next.delete(productId); return next; });
    }
  }

  async function openQuickCreate() {
    setQuickCreateName(productSearch.trim());
    setQuickCreateForm(f => ({ ...f, name: productSearch.trim() }));
    // Fetch cats + taxes if not loaded
    if (quickCreateCats.length === 0) {
      try {
        const [cats, taxes] = await Promise.all([
          api.get('/products/subcategories'),
          api.get('/products/taxes'),
        ]);
        setQuickCreateCats(cats.data ?? []);
        setQuickCreateTaxes(taxes.data ?? []);
      } catch {}
    }
    setShowQuickCreate(true);
  }

  async function saveQuickCreate() {
    const f = quickCreateForm;
    if (!f.name.trim()) { toast.error('Product name required'); return; }
    if (!f.categoryId) { toast.error('Sub-category required'); return; }
    if (!f.hsnCode || ![4,6,8].includes(f.hsnCode.trim().length)) { toast.error('Valid HSN required (4/6/8 digits)'); return; }
    if (!f.mrp) { toast.error('MRP required'); return; }
    if (!f.sellingPrice) { toast.error('Selling price required'); return; }
    if (!f.taxId) { toast.error('Tax slab required'); return; }
    setQuickCreateSaving(true);
    try {
      const res = await api.post('/products', {
        name: f.name.trim().toUpperCase(),
        categoryId: f.categoryId,
        hsnCode: f.hsnCode.trim(),
        unitOfMeasure: f.unitOfMeasure,
        mrp: parseFloat(f.mrp),
        sellingPrice: parseFloat(f.sellingPrice),
        taxId: f.taxId,
      });
      toast.success(`Product "${res.data.name}" created`);
      setShowQuickCreate(false);
      setQuickCreateForm({ name: '', categoryId: '', hsnCode: '', unitOfMeasure: 'PCS', mrp: '', sellingPrice: '', taxId: '' });
      // Add to GRN immediately
      await addProductById(res.data.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create product');
    } finally {
      setQuickCreateSaving(false);
    }
  }

  async function addProductById(id: string) {
    if (items.some((i) => i.productId === id)) { toast('Product already in list', { icon: 'i' }); return; }
    try {
      const [prodRes, ratesRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/grn/product/${id}/last-rates`).catch(() => ({ data: [] })),
      ]);
      const p = prodRes.data;
      if (!p) { toast.error('Product not found'); return; }
      lastRatesCache.current[id] = ratesRes.data ?? [];
      const lastRate = ratesRes.data?.[0] ?? null;
      setItems((prev) => [...prev, {
        productId: p.id, productName: p.name, hsnCode: p.hsnCode ?? '',
        unitOfMeasure: p.unitOfMeasure,
        gstRate: lastRate?.gstRatePercent ?? n(p.gstRatePercent ?? p.tax?.taxRate),
        basicCostPrice: lastRate?.basicCostPrice ?? n(p.costPrice),
        disc1Percent: 0, disc2Percent: 0, disc3Percent: 0, disc4Percent: 0, cashDiscPercent: 0,
        casesReceived: 0, looseQty: 0, packSize: 1, freeCases: 0, freeLoose: 0,
        mrp: lastRate?.mrp ?? n(p.mrp),
        sellingPrice: lastRate?.sellingPrice ?? n(p.sellingPrice),
        cessRate: lastRate?.cessRate ?? n(p.cessRate ?? 0),
        batchNumber: '', expiryDate: '', rejectedQty: 0, rejectionReason: '',
      }]);
      toast.success(`${p.name} added`);
    } catch { toast.error('Failed to add product'); }
  }

  function handleGstRateChange(idx: number, newRate: number) {
    const oldRate = items[idx].gstRate;
    updateItem(idx, { gstRate: newRate });
    if (newRate !== oldRate) setTaxUpdateSuggestion({ idx, newGstRate: newRate, productId: items[idx].productId });
  }

  async function updateProductTax(productId: string, newGstRate: number) {
    try {
      const taxRes = await api.get('/admin/taxes');
      const match = (taxRes.data ?? []).find((t: any) => n(t.taxRate ?? t.rate) === newGstRate);
      if (match) {
        await api.put(`/products/${productId}`, { taxId: match.id });
        toast.success('Product tax rate updated');
      } else toast.error('Tax rate not found in system');
    } catch { toast.error('Failed to update product tax'); }
    setTaxUpdateSuggestion(null);
  }

  // ── Calculations ─────────────────────────────────────────────────────────────

  const calcs = useMemo(
    () => items.map((it) => calcItem(it, taxType, isInterState)),
    [items, taxType, isInterState],
  );

  const totals = useMemo(() => {
    const taxableTotal = r2(calcs.reduce((s, c) => s + c.taxable, 0));
    const cgstTotal    = r2(calcs.reduce((s, c) => s + c.cgst, 0));
    const sgstTotal    = r2(calcs.reduce((s, c) => s + c.sgst, 0));
    const igstTotal    = r2(calcs.reduce((s, c) => s + c.igst, 0));
    const cessTotal    = r2(calcs.reduce((s, c) => s + c.cess, 0));
    const itemsTotal   = r2(calcs.reduce((s, c) => s + c.lineTotal, 0));
    const billDiscAmt  = r2(taxableTotal * adj.billDiscountPercent / 100);
    const grandTotal   = r2(itemsTotal - billDiscAmt + adj.freightCharges + adj.hamaliCharges + adj.otherCharges + adj.roundingAmount);
    const amtPayable   = r2(grandTotal - adj.advanceAdjusted);
    return { taxableTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, itemsTotal, billDiscAmt, grandTotal, amtPayable };
  }, [calcs, adj]);

  // ── GRN Intelligence: Price comparison (debounced, API-based) ────────────────

  const basicCostPriceKey = items.map((it) => `${it.productId}:${it.basicCostPrice}`).join('|');

  useEffect(() => {
    const t = setTimeout(() => {
      for (const item of items) {
        const rates = lastRatesCache.current[item.productId];
        if (!rates || rates.length === 0) continue;
        const lastBasic = rates[0].basicCostPrice;
        if (!lastBasic || lastBasic <= 0 || item.basicCostPrice <= 0) continue;
        const pctChange = (item.basicCostPrice - lastBasic) / lastBasic * 100;
        const dismissKey = `${item.productId}:${item.basicCostPrice}`;
        if (dismissedAlerts.has(dismissKey)) continue;

        let level: 'red' | 'orange' | 'amber' | 'green';
        let message: string;
        if (pctChange < 0) {
          level = 'green';
          message = `Price decreased by ${Math.abs(pctChange).toFixed(1)}% vs last purchase (was Rs.${inr(lastBasic)})`;
        } else if (pctChange <= 5) {
          level = 'amber';
          message = `Price up ${pctChange.toFixed(1)}% vs last purchase (was Rs.${inr(lastBasic)})`;
        } else if (pctChange <= 20) {
          level = 'orange';
          message = `Price up ${pctChange.toFixed(1)}% vs last purchase (was Rs.${inr(lastBasic)}) — verify with supplier`;
        } else {
          level = 'red';
          message = `Price up ${pctChange.toFixed(1)}% vs last purchase (was Rs.${inr(lastBasic)}) — significant increase`;
        }
        setPriceAlerts((prev) => ({ ...prev, [item.productId]: { level, message } }));
      }
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicCostPriceKey]);

  // ── GRN Intelligence: Expiry + free qty (pure computation) ───────────────────

  const computedAlerts = useMemo(() => {
    const out: Record<string, Array<{ level: 'red' | 'amber'; message: string; key: string }>> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const item of items) {
      const alerts: Array<{ level: 'red' | 'amber'; message: string; key: string }> = [];

      // Expiry check
      if (item.expiryDate) {
        const iso = dmyToISO(item.expiryDate);
        if (iso) {
          const expiry = new Date(iso);
          const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
          if (daysLeft < 7) {
            alerts.push({ level: 'red', message: `Expiry in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — critically short`, key: 'expiry' });
          } else if (daysLeft < 30) {
            alerts.push({ level: 'amber', message: `Expiry in ${daysLeft} days — short shelf life`, key: 'expiry' });
          }
        }
      }

      // Free quantity scheme check
      const totalPaid = item.casesReceived * item.packSize + item.looseQty;
      const totalFree = item.freeCases * item.packSize + item.freeLoose;
      if (totalPaid > 0 && totalFree > 0) {
        const expectedFree = Math.round(totalPaid / 11);
        if (totalFree > expectedFree * 2) {
          alerts.push({
            level: 'amber',
            message: `${totalFree} free for ${totalPaid} received is unusual. Standard 1+11 scheme gives ${expectedFree} free. Confirm this is correct.`,
            key: 'freeqty',
          });
        }
      }

      if (alerts.length > 0) out[item.productId] = alerts;
    }
    return out;
  }, [items]);

  // ── Tolerance ────────────────────────────────────────────────────────────────

  const tolerance = useMemo(() => {
    if (!invoiceControlTotal) return null;
    const diff = r2(Math.abs(totals.grandTotal - invoiceControlTotal));
    if (diff === 0) return { diff, level: 0, msg: 'Matched perfectly',                         cls: 'bg-green-50 text-green-700 border-green-200',   canSubmit: true,  needsConfirm: false };
    if (diff <= 5)  return { diff, level: 1, msg: `Acceptable difference Rs.${inr(diff)}`,     cls: 'bg-green-50 text-green-700 border-green-200',   canSubmit: true,  needsConfirm: false };
    if (diff <= 10) return { diff, level: 2, msg: `Small difference Rs.${inr(diff)} — Recheck`, cls: 'bg-amber-50 text-amber-700 border-amber-200',  canSubmit: true,  needsConfirm: false };
    if (diff <= 50) return { diff, level: 3, msg: `Difference Rs.${inr(diff)} — Verify rates`, cls: 'bg-orange-50 text-orange-700 border-orange-200', canSubmit: true,  needsConfirm: true  };
    return           { diff, level: 4, msg: `Difference Rs.${inr(diff)} — Cannot submit`,      cls: 'bg-red-50 text-red-700 border-red-200',         canSubmit: false, needsConfirm: false };
  }, [totals.grandTotal, invoiceControlTotal]);

  // ── Validate + save ──────────────────────────────────────────────────────────

  const validate = useCallback(() => {
    if (!supplierId)           { toast.error('Select a supplier'); return false; }
    if (!branchId)             { toast.error('Select a branch'); return false; }
    if (!invoiceNumber.trim()) { toast.error('Enter invoice number'); return false; }
    if (!invoiceDateISO)       { toast.error('Enter a valid invoice date'); return false; }
    if (receivedDateError)     { toast.error(receivedDateError); return false; }
    if (tolerance && !tolerance.canSubmit) { toast.error('Invoice total difference too large. Check rates.'); return false; }
    if (items.length === 0)    { toast.error('Add at least one product'); return false; }
    for (const it of items) {
      const c = calcs[items.indexOf(it)];
      if (c.totalReceivedQty <= 0) { toast.error(`${it.productName}: enter qty received`); return false; }
      if (it.basicCostPrice <= 0)  { toast.error(`${it.productName}: basic cost price required`); return false; }
      if (it.mrp <= 0)             { toast.error(`${it.productName}: MRP required`); return false; }
    }
    return true;
  }, [supplierId, branchId, invoiceNumber, invoiceDateISO, receivedDateError, tolerance, items, calcs]);

  async function handleSave(isDraft: boolean) {
    if (!validate()) return;
    if (!isDraft && tolerance?.needsConfirm) {
      if (!confirm(`Difference of Rs.${inr(tolerance.diff)} exists. Submit anyway?`)) return;
    }
    setSaving(true);
    try {
      const res = await api.post('/grn', {
        supplierId, branchId, invoiceNumber,
        invoiceDate: invoiceDateISO,
        receivedDate: receivedDateISO || undefined,
        taxType, documentType: docType, itcEligibility,
        placeOfSupply: placeOfSupply || undefined,
        poNumber: poNumber || undefined,
        billDiscountPercent: adj.billDiscountPercent || undefined,
        freightCharges: adj.freightCharges || undefined,
        hamaliCharges: adj.hamaliCharges || undefined,
        otherCharges: adj.otherCharges || undefined,
        roundingAmount: adj.roundingAmount || undefined,
        invoiceControlTotal: invoiceControlTotal || undefined,
        advanceAdjusted: adj.advanceAdjusted || undefined,
        paymentDueDate: adj.paymentDueDate || undefined,
        paymentMode: adj.paymentMode || undefined,
        paymentReference: adj.paymentReference || undefined,
        paymentNotes: adj.paymentNotes || undefined,
        notes: notes || undefined,
        isDraft,
        items: items.map((it) => ({
          productId: it.productId,
          basicCostPrice: it.basicCostPrice,
          disc1Percent: it.disc1Percent || undefined,
          disc2Percent: it.disc2Percent || undefined,
          disc3Percent: it.disc3Percent || undefined,
          disc4Percent: it.disc4Percent || undefined,
          cashDiscPercent: it.cashDiscPercent || undefined,
          casesReceived: it.casesReceived || undefined,
          looseQty: it.looseQty || undefined,
          packSize: it.packSize !== 1 ? it.packSize : undefined,
          freeCases: it.freeCases || undefined,
          freeLoose: it.freeLoose || undefined,
          mrp: it.mrp,
          sellingPrice: it.sellingPrice || undefined,
          cessRate: it.cessRate || undefined,
          batchNumber: it.batchNumber || undefined,
          expiryDate: it.expiryDate || undefined,
          rejectedQty: it.rejectedQty || undefined,
          rejectionReason: it.rejectionReason || undefined,
        })),
      });
      grnAutosave.clearSaved();
      toast.success(isDraft ? 'Saved as draft' : 'GRN submitted for approval');
      const w = res.data?.warning;
      if (w?.type === 'CREDIT_LIMIT_EXCEEDED') {
        const inrW = (v: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);
        toast(
          `Credit limit exceeded — Current: Rs.${inrW(w.currentOutstanding)} + This GRN: Rs.${inrW(w.newTotal)} = Rs.${inrW(w.projectedTotal)} (Limit: Rs.${inrW(w.creditLimit)}, Exceeded by: Rs.${inrW(w.exceededBy)})`,
          { duration: 8000 },
        );
      }
      router.push('/dashboard/grn');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save GRN');
    } finally {
      setSaving(false);
    }
  }

  const setAdjField = <K extends keyof Adj>(k: K, v: Adj[K]) => setAdj((a) => ({ ...a, [k]: v }));

  // ── Progress bar ─────────────────────────────────────────────────────────────

  const progressPct = invoiceControlTotal > 0 ? Math.min((totals.grandTotal / invoiceControlTotal) * 100, 110) : 0;
  const progressColor = !tolerance ? 'bg-gray-200' :
    tolerance.level <= 1 ? 'bg-green-500' :
    tolerance.level === 2 ? 'bg-amber-500' :
    tolerance.level === 3 ? 'bg-orange-500' : 'bg-red-500';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Header
        title="New GRN"
        actions={<BackButton fallbackHref="/dashboard/grn" className="ml-4" />}
      />

      {/* ── Start popup ───────────────────────────────────────────────────── */}
      {showStartPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh] overflow-hidden">

            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">New GRN — Invoice Details</h2>
              <p className="text-xs text-gray-400 mt-0.5">These details are locked once you start entering items.</p>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

              {/* Section A: Business info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                <div className="text-sm">
                  <p className="font-semibold text-blue-900">{businessInfo.name || 'Loading…'}</p>
                  <p className="text-blue-700 text-xs mt-0.5">
                    GSTIN: {businessInfo.gstin || 'Not set — update in settings'}
                    {businessInfo.branchName ? ` · Branch: ${businessInfo.branchName}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => router.push('/dashboard/settings')}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
                >
                  <Settings className="w-3.5 h-3.5" /> Go to Settings
                </button>
              </div>

              {/* Section B: Supplier */}
              <div className="space-y-1">
                <label className="label">Supplier *</label>
                <SupplierCombo suppliers={suppliers} value={popupData.supplierId} onSelect={handlePopupSupplierSelect} />
                <button
                  type="button"
                  onClick={() => openInNewWindow('/dashboard/suppliers/new')}
                  className="text-xs text-[#1B4F8A] hover:underline"
                >
                  + Add Supplier in New Window
                </button>
                {popupErrors.supplier && <p className="text-xs text-red-500">{popupErrors.supplier}</p>}
                {popupLoadingSupplier && <p className="text-xs text-gray-400">Checking previous GRNs…</p>}
                {popupData.supplierGstin && !popupLoadingSupplier && (() => {
                  const g = popupData.supplierGstin;
                  const isInterstate = businessState ? g.slice(0, 2) !== businessState : false;
                  return (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isInterstate ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {isInterstate ? 'INTERSTATE' : 'INTRASTATE'}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{g}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Draft banner */}
              {popupDraft && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm font-medium text-amber-800">Unfinished draft found</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Invoice: {popupDraft.invoiceNumber || 'No invoice number'} &middot;
                    Started: {popupDraft.createdAt ? new Date(popupDraft.createdAt).toLocaleDateString('en-GB') : '—'} &middot;
                    {popupDraft._count?.items ?? 0} items
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => router.push(`/dashboard/grn/${popupDraft.id}/edit`)}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg font-medium hover:bg-amber-700"
                    >
                      Load Draft
                    </button>
                    <button
                      onClick={() => setPopupDraft(null)}
                      className="px-3 py-1.5 bg-white text-amber-700 text-xs rounded-lg border border-amber-200 hover:bg-amber-50"
                    >
                      Start Fresh
                    </button>
                  </div>
                </div>
              )}

              {/* Section C: Invoice details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="label">Invoice Number *</label>
                  <input
                    value={popupData.invoiceNumber}
                    onChange={(e) => setPopupData((p) => ({ ...p, invoiceNumber: e.target.value }))}
                    className={`finp ${popupErrors.invoiceNumber ? 'border-red-400' : ''}`}
                    placeholder="e.g. HYD/2026/04521"
                  />
                  {popupErrors.invoiceNumber && <p className="text-xs text-red-500">{popupErrors.invoiceNumber}</p>}
                </div>

                <div className="space-y-1">
                  <label className="label">Invoice Date *</label>
                  <DateField
                    raw={popupData.invoiceDateRaw}
                    onRaw={handlePopupDateRaw}
                    error={popupErrors.invoiceDate || popupInvDateError}
                    warn={popupInvDateWarn}
                    calRef={popupCalRef}
                    maxISO={todayISO}
                  />
                </div>

                <div className="space-y-1">
                  <label className="label">Invoice Total * (Rs.)</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={popupData.invoiceControlTotal || ''}
                    onChange={(e) => setPopupData((p) => ({ ...p, invoiceControlTotal: Number(e.target.value) || 0 }))}
                    className={`finp text-right ${popupErrors.invoiceTotal ? 'border-red-400' : ''}`}
                    placeholder="0.00"
                  />
                  {popupErrors.invoiceTotal && <p className="text-xs text-red-500">{popupErrors.invoiceTotal}</p>}
                  <FieldHelp
                    level="critical"
                    title="Invoice Total — Enter First"
                    description="Enter the GRAND TOTAL from the bottom of your supplier's physical invoice BEFORE adding items. The system will show your progress towards this total and alert if there is a mismatch."
                    example="If invoice shows Grand Total: Rs.10,523.50, enter exactly 10523.50"
                  />
                </div>
              </div>

              {/* Section D: Tax type */}
              <div className="space-y-2">
                <label className="label">Tax Type *</label>
                <div className="flex flex-col gap-2">
                  {(['TAX_EXCLUSIVE', 'TAX_INCLUSIVE'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio" name="popupTaxType" value={t}
                        checked={popupData.taxType === t}
                        onChange={() => setPopupData((p) => ({ ...p, taxType: t }))}
                        className="accent-[#1B4F8A]"
                      />
                      <span className="text-sm text-gray-700">
                        {t === 'TAX_EXCLUSIVE' ? 'Tax Exclusive — GST is added on top of price' : 'Tax Inclusive — GST is already included in price'}
                      </span>
                    </label>
                  ))}
                </div>
                <FieldHelp
                  level="warning"
                  title="Tax Type — Cannot Change After Saving"
                  description="TAX EXCLUSIVE: supplier shows base price + GST separately (most branded suppliers like HUL, ITC). TAX INCLUSIVE: supplier shows a single rate that already includes GST. Check your invoice carefully."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => router.push('/dashboard/grn')}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartGrn}
                className="px-5 py-2 bg-[#1B4F8A] text-white text-sm font-semibold rounded-xl hover:bg-[#163f6e] flex items-center gap-2"
              >
                Start GRN <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main form ─────────────────────────────────────────────────────── */}
      {!showStartPopup && (
        <main className="flex-1 p-6 space-y-4">
          <Breadcrumbs items={[
            { label: 'GRN', href: '/dashboard/grn' },
            { label: 'New GRN' },
          ]} />

          {/* Autosave restore */}
          {showGrnRestore && (() => {
            const saved = grnAutosave.getSaved();
            return saved ? (
              <RestoreBanner
                savedAt={saved.savedAt}
                onRestore={() => {
                  const s = saved.data;
                  setItems(s.items);
                  setAdj(s.adj);
                  setNotes(s.notes);
                  setItcEligibility(s.itcEligibility);
                  setPlaceOfSupply(s.placeOfSupply);
                  setPoNumber(s.poNumber);
                  setShowGrnRestore(false);
                }}
                onDiscard={() => { grnAutosave.clearSaved(); setShowGrnRestore(false); }}
              />
            ) : null;
          })()}

          {/* Locked header */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span>
                  <span className="text-gray-400 text-xs">Supplier:</span>{' '}
                  <span className="font-medium">{lockedSupplierName}</span>
                  {supplierGstin && <span className="text-gray-400 text-xs ml-1">· {supplierGstin}</span>}
                </span>
                <span><span className="text-gray-400 text-xs">Invoice:</span> <span className="font-medium">{invoiceNumber}</span></span>
                <span><span className="text-gray-400 text-xs">Date:</span> <span className="font-medium">{isoToDMY(invoiceDateISO)}</span></span>
                <span><span className="text-gray-400 text-xs">Tax:</span> <span className="font-medium">{taxType === 'TAX_EXCLUSIVE' ? 'Exclusive' : 'Inclusive'}</span></span>
                {supplierBalance !== null && supplierBalance > 0 && (
                  <span className="text-green-600 text-xs font-medium">Advance: Rs.{inr(supplierBalance)}</span>
                )}
              </div>
              <button onClick={() => setShowStartPopup(true)} className="text-xs text-[#1B4F8A] hover:underline shrink-0">
                Edit Details
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Rs.{inr(totals.grandTotal)} of Rs.{inr(invoiceControlTotal)}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              {tolerance ? (
                <p className={`text-xs mt-1.5 px-2 py-0.5 rounded-md inline-block border ${tolerance.cls}`}>
                  {tolerance.msg}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Difference: Rs.{inr(invoiceControlTotal)} (no items added yet)</p>
              )}
            </div>
          </div>

          {/* Additional details */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Additional Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

              <div className="space-y-1 col-span-2 md:col-span-1">
                <label className="label">Received Date</label>
                <DateField
                  raw={receivedDateRaw}
                  onRaw={handleReceivedDateRaw}
                  error={receivedDateError}
                  calRef={receivedCalRef}
                  maxISO={todayISO}
                />
              </div>

              <div className="space-y-1">
                <label className="label">Document Type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="finp">
                  <option value="INVOICE">Invoice</option>
                  <option value="DEBIT_NOTE">Debit Note</option>
                  <option value="BILL_OF_SUPPLY">Bill of Supply</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-0.5">
                  <label className="label">ITC Eligibility</label>
                  <FieldHelp
                    title="ITC Eligibility"
                    description="ELIGIBLE: you can offset the GST you paid on this purchase against GST you collect from customers. NOT ELIGIBLE: for purchases from unregistered suppliers or items for personal use."
                  />
                </div>
                <select value={itcEligibility} onChange={(e) => setItcEligibility(e.target.value)} className="finp">
                  <option value="ELIGIBLE">Eligible</option>
                  <option value="INELIGIBLE">Ineligible</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
                <FieldHelp hint="Whether you can claim input tax credit on this purchase" />
              </div>

              {branches.length > 1 && (
                <div className="space-y-1">
                  <label className="label">Branch *</label>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="finp">
                    <option value="">-- Select --</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="label">PO Number</label>
                <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="finp" placeholder="Optional" />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="label">Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="finp" placeholder="Optional notes…" />
              </div>
            </div>

            {isInterState && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
                Interstate supply — IGST will apply
              </p>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                Items {items.length > 0 && <span className="ml-1 text-xs font-normal text-gray-400">({items.length})</span>}
              </h3>
            </div>

            {/* Product search */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchRef}
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setProductActiveIdx(-1); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const q = productSearch.trim();
                      if (!q) return;
                      if (productResults.length > 0) {
                        const exact = productResults.find(r => r.barcode === q);
                        const target = exact ?? (productResults.length === 1 ? productResults[0] : null);
                        if (target) { addProduct(target); return; }
                        if (productActiveIdx >= 0) { addProduct(productResults[productActiveIdx]); return; }
                        return; // multiple results, no exact match — user picks
                      }
                      // Results not loaded yet — scanner intent: search immediately
                      grnScanIntentRef.current = q;
                      api.get('/pos/search', { params: { q } })
                        .then(r => setProductResults(r.data ?? []))
                        .catch(() => {});
                      return;
                    }
                    onProductKeyDown(e);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="Search product to add…"
                />
                {productResults.length > 0 && (
                  <div className="absolute top-full left-0 w-[400px] bg-white border border-gray-200 rounded-xl shadow-xl z-20 mt-1 max-h-56 overflow-y-auto">
                    {productResults.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => addProduct(p)}
                        className={`w-full text-left px-4 py-2.5 text-sm flex justify-between gap-4 ${i === productActiveIdx ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                      >
                        <span className="font-medium text-gray-800 truncate">{p.name}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {p.unitOfMeasure} · GST {p.gstRatePercent ?? 0}% · MRP {inr(n(p.mrp))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {productSearch.trim() && productResults.length === 0 && (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={openQuickCreate}
                    className="text-xs bg-[#1B4F8A] text-white px-3 py-1.5 rounded-lg hover:bg-[#163d6d] font-medium"
                  >
                    + Create New Product
                  </button>
                  <button
                    onClick={() => openInNewWindow('/dashboard/products?source=grn')}
                    className="text-xs text-gray-500 hover:text-[#1B4F8A] hover:underline"
                  >
                    Open Products page
                  </button>
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Search for products above to add items</div>
            ) : (
              <div className="px-4 py-3 space-y-3">
                {items.map((it, idx) => {
                  const c = calcs[idx];
                  const isCollapsed = collapsedItems.has(idx);
                  const levelCls: Record<string, string> = {
                    red:    'bg-red-50 text-red-700 border-red-200',
                    orange: 'bg-orange-50 text-orange-700 border-orange-200',
                    amber:  'bg-amber-50 text-amber-700 border-amber-200',
                    green:  'bg-green-50 text-green-700 border-green-200',
                  };
                  return (
                    <div key={idx} className="rounded-xl border border-gray-200 overflow-hidden bg-white">

                      {/* Card header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800 text-sm truncate">{it.productName}</p>
                          <p className="text-xs text-gray-400">{it.unitOfMeasure}{it.hsnCode ? ` · HSN ${it.hsnCode}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className="text-sm font-bold text-[#1B4F8A]">Rs.{inr(c.lineTotal)}</span>
                          <button
                            onClick={() => toggleCollapse(idx)}
                            className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                          </button>
                          <button onClick={() => removeItem(idx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Card body — collapsible */}
                      {!isCollapsed && (
                        <div className="p-4 space-y-4">

                          {/* Row 1: Quantities */}
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quantities</p>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Cases</label>
                                <Num value={it.casesReceived} onChange={(v) => updateItem(idx, { casesReceived: v })} step="1" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Pack Size</label>
                                <Num value={it.packSize} onChange={(v) => updateItem(idx, { packSize: Math.max(1, v) })} step="1" min={1} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Loose Qty</label>
                                <Num value={it.looseQty} onChange={(v) => updateItem(idx, { looseQty: v })} step="0.001" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-0.5">
                                  <label className="text-xs text-gray-500">Free Cases</label>
                                  <FieldHelp title="Free Quantity" description="Quantity received free under supplier scheme. Adds to stock but not included in cost calculation." />
                                </div>
                                <Num value={it.freeCases} onChange={(v) => updateItem(idx, { freeCases: v })} step="1" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Free Loose</label>
                                <Num value={it.freeLoose} onChange={(v) => updateItem(idx, { freeLoose: v })} step="0.001" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Rcvd Qty</label>
                                <div className="finp bg-gray-50 font-bold text-gray-700">{c.totalReceivedQty}</div>
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Pricing */}
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Pricing</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-0.5">
                                  <label className="text-xs text-gray-500">Basic Cost</label>
                                  <FieldHelp title="Basic Cost Price" description="Rate from supplier invoice before discounts. Enter per unit." />
                                </div>
                                <Num value={it.basicCostPrice} onChange={(v) => updateItem(idx, { basicCostPrice: v })} step="0.01" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Net Cost</label>
                                <div className="finp bg-gray-50 text-gray-600">{inr(c.netCostPrice)}</div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">MRP</label>
                                <Num value={it.mrp} onChange={(v) => updateItem(idx, { mrp: v })} step="0.01" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Selling Price</label>
                                <Num value={it.sellingPrice} onChange={(v) => updateItem(idx, { sellingPrice: v })} step="0.01" />
                              </div>
                            </div>
                          </div>

                          {/* Row 3: Discounts */}
                          <div>
                            <div className="flex items-center gap-1 mb-2">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Discounts</p>
                              <FieldHelp title="Discount Levels" description="Applied in cascade: D1 on basic cost, D2 on result of D1, etc." example="Basic: 100, D1 5%: 95, D2 2%: 93.10" />
                            </div>
                            <div className="grid grid-cols-5 gap-3">
                              <div className="space-y-1"><label className="text-xs text-gray-500">D1%</label><Num value={it.disc1Percent} onChange={(v) => updateItem(idx, { disc1Percent: v })} step="0.01" placeholder="0" /></div>
                              <div className="space-y-1"><label className="text-xs text-gray-500">D2%</label><Num value={it.disc2Percent} onChange={(v) => updateItem(idx, { disc2Percent: v })} step="0.01" placeholder="0" /></div>
                              <div className="space-y-1"><label className="text-xs text-gray-500">D3%</label><Num value={it.disc3Percent} onChange={(v) => updateItem(idx, { disc3Percent: v })} step="0.01" placeholder="0" /></div>
                              <div className="space-y-1"><label className="text-xs text-gray-500">D4%</label><Num value={it.disc4Percent} onChange={(v) => updateItem(idx, { disc4Percent: v })} step="0.01" placeholder="0" /></div>
                              <div className="space-y-1"><label className="text-xs text-gray-500">Cash D%</label><Num value={it.cashDiscPercent} onChange={(v) => updateItem(idx, { cashDiscPercent: v })} step="0.01" placeholder="0" /></div>
                            </div>
                          </div>

                          {/* Row 4: Tax + Batch */}
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Tax &amp; Batch</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">GST Rate</label>
                                <select
                                  value={it.gstRate}
                                  onChange={(e) => handleGstRateChange(idx, Number(e.target.value))}
                                  className="finp"
                                >
                                  {gstRates.map((rate) => (
                                    <option key={rate} value={rate}>{rate}%</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Cess%</label>
                                <Num value={it.cessRate} onChange={(v) => updateItem(idx, { cessRate: v })} step="0.01" placeholder="0" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-500">Batch #</label>
                                <input
                                  value={it.batchNumber}
                                  onChange={(e) => updateItem(idx, { batchNumber: e.target.value })}
                                  className="finp"
                                  placeholder="Batch number"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-0.5">
                                  <label className="text-xs text-gray-500">Expiry Date</label>
                                  <FieldHelp title="Expiry Date" description="Best Before or Expiry date from the product packaging." />
                                </div>
                                <input
                                  type="date"
                                  value={it.expiryDate}
                                  onChange={(e) => updateItem(idx, { expiryDate: e.target.value })}
                                  className="finp"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Row 5: Rejection */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-gray-500">Rejected Qty</label>
                              <Num value={it.rejectedQty} onChange={(v) => updateItem(idx, { rejectedQty: v })} step="1" placeholder="0" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-500">Rejection Reason</label>
                              <input
                                value={it.rejectionReason}
                                onChange={(e) => updateItem(idx, { rejectionReason: e.target.value })}
                                className="finp"
                                placeholder="Reason…"
                              />
                            </div>
                          </div>

                          {/* Tax summary */}
                          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                            Taxable: {inr(c.taxable)}
                            {isInterState
                              ? <span className="ml-2">IGST: {inr(c.igst)}</span>
                              : <span className="ml-2">GST: {inr(r2(c.cgst + c.sgst))}</span>}
                            {c.cess > 0 && <span className="ml-2 text-orange-500">Cess: {inr(c.cess)}</span>}
                            <span className="ml-2 font-semibold text-gray-700">Line Total: {inr(c.lineTotal)}</span>
                          </div>
                        </div>
                      )}

                      {/* GST update suggestion */}
                      {taxUpdateSuggestion?.idx === idx && (
                        <div className="bg-blue-50 border-t border-blue-100 px-3 py-2 text-xs text-blue-700 flex items-center gap-3 flex-wrap">
                          <span>Tax changed to {taxUpdateSuggestion.newGstRate}% for this item. Update product's default tax too?</span>
                          <button
                            onClick={() => updateProductTax(taxUpdateSuggestion.productId, taxUpdateSuggestion.newGstRate)}
                            className="px-2 py-0.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                          >
                            Yes, Update Product
                          </button>
                          <button
                            onClick={() => setTaxUpdateSuggestion(null)}
                            className="px-2 py-0.5 bg-white text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                          >
                            No, This GRN Only
                          </button>
                        </div>
                      )}

                      {/* GRN Intelligence Alerts */}
                      {(() => {
                        const pid = it.productId;
                        const priceAlert = priceAlerts[pid];
                        const computed = computedAlerts[pid] ?? [];
                        const allAlerts: Array<{ key: string; level: 'red' | 'orange' | 'amber' | 'green'; message: string }> = [];
                        if (priceAlert && !dismissedAlerts.has(`${pid}:${it.basicCostPrice}`)) {
                          allAlerts.push({ key: 'price', level: priceAlert.level, message: priceAlert.message });
                        }
                        for (const ca of computed) {
                          if (!dismissedAlerts.has(`${pid}:${ca.key}`)) {
                            allAlerts.push({ key: ca.key, level: ca.level, message: ca.message });
                          }
                        }
                        if (allAlerts.length === 0) return null;
                        return (
                          <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
                            {allAlerts.map((alert) => (
                              <div key={alert.key} className={`flex items-start justify-between gap-2 rounded px-2.5 py-1.5 border text-xs ${levelCls[alert.level]}`}>
                                <span>{alert.message}</span>
                                <button
                                  onClick={() => setDismissedAlerts((prev) => {
                                    const next = new Set(prev);
                                    next.add(alert.key === 'price' ? `${pid}:${it.basicCostPrice}` : `${pid}:${alert.key}`);
                                    return next;
                                  })}
                                  className="shrink-0 opacity-60 hover:opacity-100"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Adjustments + Totals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Adjustments & Payment</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {([
                  { label: 'Bill Discount %', key: 'billDiscountPercent' },
                  { label: 'Freight Charges', key: 'freightCharges' },
                  { label: 'Hamali Charges',  key: 'hamaliCharges' },
                  { label: 'Other Charges',   key: 'otherCharges' },
                  { label: 'Rounding Amount', key: 'roundingAmount' },
                  { label: 'Advance Adjusted',key: 'advanceAdjusted' },
                ] as { label: string; key: keyof Adj }[]).map(({ label, key }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center gap-0.5">
                      <label className="label">{label}</label>
                      {key === 'hamaliCharges' && (
                        <FieldHelp
                          title="Hamali Charges"
                          description="Labor charges for loading/unloading goods at your store. Click SPREAD to distribute this cost proportionally across all items. This gives you the true landed cost per product."
                        />
                      )}
                    </div>
                    <input
                      type="number"
                      value={(adj[key] as number) || ''}
                      onChange={(e) => setAdjField(key, (Number(e.target.value) || 0) as any)}
                      step="0.01"
                      className="finp text-right"
                      placeholder="0.00"
                    />
                    {key === 'hamaliCharges' && (
                      <FieldHelp hint="Loading/unloading labor cost" />
                    )}
                  </div>
                ))}

                <div className="space-y-1">
                  <label className="label">Payment Due Date</label>
                  <input type="date" value={adj.paymentDueDate} onChange={(e) => setAdjField('paymentDueDate', e.target.value)} className="finp" />
                </div>

                <div className="space-y-1">
                  <label className="label">Payment Mode</label>
                  <select value={adj.paymentMode} onChange={(e) => setAdjField('paymentMode', e.target.value)} className="finp">
                    <option value="">-- Select --</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="NEFT">NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="label">Payment Reference</label>
                  <input value={adj.paymentReference} onChange={(e) => setAdjField('paymentReference', e.target.value)} className="finp" placeholder="Ref / UTR #" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Bill Summary</h3>
              <div className="flex-1 space-y-1.5 text-sm">
                {[
                  { label: 'Taxable Amount', value: totals.taxableTotal, cls: 'text-gray-600' },
                  ...(!isInterState
                    ? [{ label: 'CGST', value: totals.cgstTotal, cls: 'text-gray-500' }, { label: 'SGST', value: totals.sgstTotal, cls: 'text-gray-500' }]
                    : [{ label: 'IGST', value: totals.igstTotal, cls: 'text-gray-500' }]),
                  ...(totals.cessTotal > 0 ? [{ label: 'CESS', value: totals.cessTotal, cls: 'text-orange-600' }] : []),
                  ...(totals.billDiscAmt > 0 ? [{ label: `Bill Discount (${adj.billDiscountPercent}%)`, value: -totals.billDiscAmt, cls: 'text-green-600' }] : []),
                  ...(adj.freightCharges > 0 ? [{ label: 'Freight', value: adj.freightCharges, cls: 'text-gray-500' }] : []),
                  ...(adj.hamaliCharges > 0  ? [{ label: 'Hamali', value: adj.hamaliCharges, cls: 'text-gray-500' }] : []),
                  ...(adj.otherCharges > 0   ? [{ label: 'Other Charges', value: adj.otherCharges, cls: 'text-gray-500' }] : []),
                  ...(adj.roundingAmount !== 0 ? [{ label: 'Rounding', value: adj.roundingAmount, cls: 'text-gray-500' }] : []),
                ].map(({ label, value, cls }) => (
                  <div key={label} className={`flex justify-between ${cls}`}>
                    <span>{label}</span>
                    <span className="font-medium">{value < 0 ? `- Rs.${inr(Math.abs(value))}` : `Rs.${inr(value)}`}</span>
                  </div>
                ))}

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-base font-bold text-gray-800">
                    <span>Grand Total</span>
                    <span>Rs.{inr(totals.grandTotal)}</span>
                  </div>
                  {adj.advanceAdjusted > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-green-600 mt-1">
                        <span>Advance Adjusted</span>
                        <span>- Rs.{inr(adj.advanceAdjusted)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold text-gray-800 mt-0.5">
                        <span>Amount Payable</span>
                        <span>Rs.{inr(totals.amtPayable)}</span>
                      </div>
                    </>
                  )}
                </div>

                {tolerance && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${tolerance.cls}`}>
                    {tolerance.level === 0 && 'Matched perfectly'}
                    {tolerance.level === 1 && `Acceptable difference Rs.${inr(tolerance.diff)}`}
                    {tolerance.level === 2 && `Small difference Rs.${inr(tolerance.diff)} — Recheck rates`}
                    {tolerance.level === 3 && `Difference Rs.${inr(tolerance.diff)} — Please verify rates`}
                    {tolerance.level === 4 && `Difference Rs.${inr(tolerance.diff)} — Cannot submit. Check item rates.`}
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2.5">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || (tolerance ? !tolerance.canSubmit : false)}
                  className="w-full py-3 bg-[#1B4F8A] text-white text-sm font-semibold rounded-xl hover:bg-[#163f6e] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {saving ? 'Submitting…' : 'Submit for Approval'}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="w-full py-3 bg-white text-gray-700 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save as Draft'}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ERP broadcast toast */}
      {erpToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-green-700 text-white px-4 py-3 rounded-xl shadow-2xl max-w-xs">
          <span className="text-sm flex-1 leading-snug">{erpToast.message}</span>
          <button
            onClick={erpToast.onAction}
            className="text-xs bg-white text-green-700 px-2.5 py-1 rounded-lg font-semibold hover:bg-green-50 shrink-0"
          >
            {erpToast.actionLabel}
          </button>
          <button onClick={() => setErpToast(null)} className="text-white/70 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Quick Product Create Panel ── */}
      {showQuickCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Quick Create Product</h2>
              <button onClick={() => setShowQuickCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500">Fill essentials only — you can complete the rest from the Products page later.</p>
            <div className="space-y-3">
              <div>
                <label className="label">Product Name *</label>
                <input autoFocus value={quickCreateForm.name} onChange={(e) => setQuickCreateForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                  className="finp mt-1" placeholder="e.g. FORTUNE SUNFLOWER OIL 1L" />
              </div>
              <div>
                <label className="label">Sub-Category *</label>
                <select value={quickCreateForm.categoryId} onChange={(e) => setQuickCreateForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="finp mt-1">
                  <option value="">— Select sub-category —</option>
                  {quickCreateCats.map((c) => <option key={c.id} value={c.id}>{c.label || c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">HSN Code *</label>
                  <input value={quickCreateForm.hsnCode} onChange={(e) => setQuickCreateForm(f => ({ ...f, hsnCode: e.target.value.replace(/\D/g,'').slice(0,8) }))}
                    className="finp mt-1 font-mono" placeholder="4/6/8 digits" />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select value={quickCreateForm.unitOfMeasure} onChange={(e) => setQuickCreateForm(f => ({ ...f, unitOfMeasure: e.target.value }))}
                    className="finp mt-1">
                    {['PCS','KG','LTR','BTL','PKT','BOX','CASE'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">MRP *</label>
                  <input type="number" value={quickCreateForm.mrp} onChange={(e) => setQuickCreateForm(f => ({ ...f, mrp: e.target.value }))}
                    className="finp mt-1" placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Selling Price *</label>
                  <input type="number" value={quickCreateForm.sellingPrice} onChange={(e) => setQuickCreateForm(f => ({ ...f, sellingPrice: e.target.value }))}
                    className="finp mt-1" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="label">GST Slab *</label>
                <select value={quickCreateForm.taxId} onChange={(e) => setQuickCreateForm(f => ({ ...f, taxId: e.target.value }))}
                  className="finp mt-1">
                  <option value="">— Select GST —</option>
                  {quickCreateTaxes.map((t) => <option key={t.id} value={t.id}>{t.taxName}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowQuickCreate(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={saveQuickCreate} disabled={quickCreateSaving}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163d6d] disabled:opacity-60 font-medium">
                {quickCreateSaving ? 'Creating…' : 'Create & Add to GRN'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .label { font-size: 0.75rem; font-weight: 500; color: #4B5563; display: block; }
        .finp {
          width: 100%; padding: 0.4375rem 0.625rem; font-size: 0.875rem;
          border: 1px solid #E5E7EB; border-radius: 0.5rem;
          outline: none; background: white; transition: border-color 0.15s;
        }
        .finp:focus { border-color: #1B4F8A; }
      `}</style>
    </>
  );
}

'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ChevronDown, ChevronUp, Save, Send, Settings, Camera } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { openInNewWindow } from '@/lib/new-window';
import { FieldHelp } from '@/components/ui/FieldHelp';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchProduct {
  id: string; name: string; productCode?: string; hsnCode?: string;
  unitOfMeasure: string; mrp: number | string; sellingPrice: number | string;
  costPrice?: number | string | null; cessRate?: number | string;
  gstRatePercent?: number | string;
}

interface GrnItem {
  productId: string; productName: string; productCode: string;
  hsnCode: string; unitOfMeasure: string; gstRate: number;
  dbGstRate: number;   // GST rate from product DB — for mismatch warning only
  basicCostPrice: number;
  tradePercent: number; tradeRs: number;
  schemePercent: number; schemeRs: number;
  cashPercent: number; cashRs: number;
  casesReceived: number; looseQty: number; packSize: number;
  freeCases: number; freeLoose: number;
  mrp: number; sellingPrice: number; cessRate: number;
  batchNumber: string; expiryDate: string;
  rejectedQty: number; rejectionReason: string;
}

interface Adj {
  billDiscountPercent: number;
  billCashDiscPercent: number;
  billCashDiscRs: number;
  freightCharges: number;
  hamaliCharges: number; otherCharges: number; roundingAmount: number;
  advanceAdjusted: number; paymentDueDate: string;
  paymentMode: string; paymentReference: string; paymentNotes: string;
}

interface PopupData {
  supplierId: string; supplierName: string; supplierGstin: string;
  invoiceNumber: string; invoiceDateRaw: string; invoiceDateISO: string;
  invoiceControlTotal: number; taxType: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';
}

type PairMaster = { trade: 'pct' | 'rs'; scheme: 'pct' | 'rs'; cash: 'pct' | 'rs' };

// ── Date helpers ──────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');
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
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const r6 = (x: number) => Math.round(x * 1000000) / 1000000;
const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function calcItem(item: GrnItem, taxType: string, isInterState: boolean) {
  const totalReceivedQty = (item.casesReceived || 0) * (item.packSize || 1) + (item.looseQty || 0);
  const acceptedQty = Math.max(0, totalReceivedQty - (item.rejectedQty || 0));

  // ── LINE-LEVEL discount calculation ────────────────────────────────────────
  // Discounts are applied at LINE level (gross - lineDiscount), not per-unit.
  // This matches how every supplier bill works — the "Sch Disc" and "RS Disc"
  // columns show LINE totals, and any per-unit rounding is done at the line level.
  // r2() each line discount so it matches the 2dp amounts on the bill exactly.
  const grossLine      = item.basicCostPrice * acceptedQty;
  const tradeDiscLine  = r2(item.tradeRs  * acceptedQty);
  const schemeDiscLine = r2(item.schemeRs * acceptedQty);
  const cashDiscLine   = r2(item.cashRs   * acceptedQty);
  const netLine        = Math.max(0, grossLine - tradeDiscLine - schemeDiscLine - cashDiscLine);

  // netCostPrice per unit (for display in grid NET column)
  const netCostPrice = acceptedQty > 0 ? r4(netLine / acceptedQty) : 0;

  const taxable = taxType === 'TAX_INCLUSIVE'
    ? netLine / (1 + item.gstRate / 100)
    : netLine;
  const cessAmount = taxable * item.cessRate / 100;
  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) { igst = taxable * item.gstRate / 100; }
  else { cgst = taxable * item.gstRate / 2 / 100; sgst = cgst; }
  const lineTotal = taxable + cgst + sgst + igst + cessAmount;
  return { netCostPrice, totalReceivedQty, acceptedQty, taxable, cgst, sgst, igst, cess: cessAmount, lineTotal };
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultAdj: Adj = {
  billDiscountPercent: 0, billCashDiscPercent: 0, billCashDiscRs: 0,
  freightCharges: 0, hamaliCharges: 0, otherCharges: 0, roundingAmount: 0,
  advanceAdjusted: 0, paymentDueDate: '', paymentMode: '', paymentReference: '', paymentNotes: '',
};
const DEFAULT_GST_RATES = [0, 5, 12, 18, 28];

const defaultItem = (): GrnItem => ({
  productId: '', productName: '', productCode: '', hsnCode: '',
  unitOfMeasure: 'PCS', gstRate: 18, dbGstRate: 18,
  basicCostPrice: 0,
  tradePercent: 0, tradeRs: 0,
  schemePercent: 0, schemeRs: 0,
  cashPercent: 0, cashRs: 0,
  casesReceived: 0, looseQty: 0, packSize: 1,
  freeCases: 0, freeLoose: 0, mrp: 0, sellingPrice: 0,
  cessRate: 0, batchNumber: '', expiryDate: '',
  rejectedQty: 0, rejectionReason: '',
});

// ── Num input ─────────────────────────────────────────────────────────────────

function Num({ value, onChange, min = 0, step = '0.01', placeholder = '', className = '' }: {
  value: number; onChange: (v: number) => void;
  min?: number; step?: string; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="number"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      min={min} step={step} placeholder={placeholder}
      className={`w-full px-2 py-1.5 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1B4F8A] focus:ring-1 focus:ring-[#1B4F8A]/20 placeholder:text-slate-400 ${className}`}
    />
  );
}

// ── Supplier combo ────────────────────────────────────────────────────────────

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
      }).slice(0, 10)
    : suppliers.slice(0, 10);

  return (
    <div ref={ref} className="relative">
      <div
        className="finp flex items-center justify-between cursor-pointer"
        onClick={() => { setOpen((o) => !o); setSearch(''); setActiveIdx(-1); }}
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? selected.name : 'Select supplier…'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </div>
      {open && (
        <div className="absolute top-full left-0 bg-white border border-gray-200 rounded-xl shadow-xl z-30 mt-1"
          style={{ minWidth: 'max(100%, min(600px, 90vw))' }}>
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveIdx(-1); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === 'Enter' && activeIdx >= 0) {
                  const s = filtered[activeIdx];
                  onSelect(s.id, s.name, s.gstin ?? '');
                  setOpen(false);
                }
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Search supplier by name or GSTIN…"
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id, s.name, s.gstin ?? ''); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-4 ${i === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <span className="font-semibold text-gray-800">{s.name}</span>
                {s.gstin && <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded shrink-0">{s.gstin}</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No suppliers found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Date field ────────────────────────────────────────────────────────────────

function DateField({ raw, onRaw, error, warn, calRef, maxISO }: {
  raw: string; onRaw: (v: string) => void;
  error?: string; warn?: string;
  calRef: React.RefObject<HTMLInputElement>;
  maxISO: string;
}) {
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={raw}
          onChange={(e) => onRaw(e.target.value)}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          className={`finp flex-1 font-mono ${error ? 'border-red-400' : ''}`}
        />
        <input
          ref={calRef}
          type="date"
          max={maxISO}
          onChange={(e) => onRaw(isoToDMY(e.target.value))}
          className="finp w-10 px-1 text-center cursor-pointer"
          title="Pick date"
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      {!error && warn && <p className="text-xs text-amber-600 mt-0.5">{warn}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GrnV2Page() {
  const router = useRouter();

  // ── Popup state ──────────────────────────────────────────────────────────────
  const [showStartPopup, setShowStartPopup] = useState(true);
  const [popupData, setPopupData] = useState<PopupData>({
    supplierId: '', supplierName: '', supplierGstin: '',
    invoiceNumber: '', invoiceDateRaw: '', invoiceDateISO: '',
    invoiceControlTotal: 0, taxType: 'TAX_EXCLUSIVE',
  });
  const [popupInvDateError, setPopupInvDateError] = useState('');
  const [popupInvDateWarn, setPopupInvDateWarn] = useState('');
  const [popupErrors, setPopupErrors] = useState<Record<string, string>>({});
  const [popupDraft, setPopupDraft] = useState<any>(null);
  const [popupLoadingSupplier, setPopupLoadingSupplier] = useState(false);
  const popupCalRef = useRef<HTMLInputElement>(null);

  // ── Business info ────────────────────────────────────────────────────────────
  const [businessInfo, setBusinessInfo] = useState({ name: '', gstin: '', branchName: '' });
  const [businessState, setBusinessState] = useState('');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; gstin?: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [gstRates, setGstRates] = useState<number[]>(DEFAULT_GST_RATES);

  // ── Add PLU from GRN ─────────────────────────────────────────────────────────
  const [showAddPluModal, setShowAddPluModal] = useState(false);
  const [addPluForm, setAddPluForm] = useState({ mrp: '', sellingPrice: '', gstRate: '', cessRate: '0', packLabel: '' });
  const [addPluSaving, setAddPluSaving] = useState(false);

  // ── Header state ─────────────────────────────────────────────────────────────
  const [headerExpanded, setHeaderExpanded] = useState(false);

  // ── Main form ─────────────────────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDateISO, setInvoiceDateISO] = useState('');
  const [invoiceControlTotal, setInvoiceControlTotal] = useState(0);
  const [taxType, setTaxType] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE'>('TAX_EXCLUSIVE');
  const [branchId, setBranchId] = useState('');
  const [adj, setAdj] = useState<Adj>(defaultAdj);
  const [grnId, setGrnId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editGrnStatus, setEditGrnStatus] = useState<string | null>(null);

  // ── Items grid ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<GrnItem[]>([]);
  const [gridFocusIdx, setGridFocusIdx] = useState(-1);
  const lastRatesCache = useRef<Record<string, any[]>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Detail panel ─────────────────────────────────────────────────────────────
  const [panelMode, setPanelMode] = useState<'empty' | 'loaded'>('empty');
  const [editIdx, setEditIdx] = useState(-1);
  const [panelItem, setPanelItem] = useState<GrnItem>(defaultItem());
  const [marginAllowedIds, setMarginAllowedIds] = useState<Set<string>>(new Set());
  const [marginFlagSaving, setMarginFlagSaving] = useState(false);
  const [pairMaster, setPairMaster] = useState<PairMaster>({ trade: 'pct', scheme: 'pct', cash: 'pct' });
  const [showBatch, setShowBatch] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const [panelResults, setPanelResults] = useState<SearchProduct[]>([]);
  const [panelActiveIdx, setPanelActiveIdx] = useState(-1);
  const panelSearchRef   = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef   = useRef(0);   // timestamp of last keypress — detects scanner speed
  const isScannerInput   = useRef(false); // true when chars arrived scanner-fast (< 80ms apart)
  const firstPanelInputRef = useRef<HTMLInputElement>(null);

  // ── Camera barcode scanner ────────────────────────────────────────────────────
  const [showCamera,      setShowCamera]      = useState(false);
  const [cameraError,     setCameraError]     = useState('');
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);


  // ── Auto-save state ───────────────────────────────────────────────────────────
  const [userId, setUserId] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [savedDraft, setSavedDraft] = useState<{
    savedAt: number; popupData: PopupData; items: GrnItem[]; adj: Adj;
  } | null>(null);
  const [draftDuplicateStatus, setDraftDuplicateStatus] = useState<string | null>(null);
  const [localSaveStatus, setLocalSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [localSavedAt, setLocalSavedAt] = useState<number | null>(null);
  const [localNow, setLocalNow] = useState(Date.now());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<{ popupData: PopupData; items: GrnItem[]; adj: Adj }>({
    popupData: {
      supplierId: '', supplierName: '', supplierGstin: '',
      invoiceNumber: '', invoiceDateRaw: '', invoiceDateISO: '',
      invoiceControlTotal: 0, taxType: 'TAX_EXCLUSIVE',
    },
    items: [],
    adj: defaultAdj,
  });

  const todayISO = getTodayISO();

  // ── Camera scanner functions ──────────────────────────────────────────────────
  useEffect(() => {
    setCameraSupported('BarcodeDetector' in window);
  }, []);

  const stopCamera = useCallback(() => {
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'],
      });
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanFrameRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            stopCamera();
            isScannerInput.current = true;
            setPanelSearch(code);
          } else {
            scanFrameRef.current = requestAnimationFrame(scan);
          }
        } catch {
          scanFrameRef.current = requestAnimationFrame(scan);
        }
      };
      scanFrameRef.current = requestAnimationFrame(scan);
    } catch (err: any) {
      setCameraError(err?.message ?? 'Camera access denied');
      setShowCamera(false);
    }
  }, [stopCamera]);

  // ── Init ─────────────────────────────────────────────────────────────────────
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
    api.get('/auth/me').then((r) => {
      const uid = String(r.data?.id ?? r.data?.userId ?? r.data?.sub ?? 'default');
      setUserId(uid);
      try {
        const saved = localStorage.getItem('grn_v2_draft_' + uid);
        if (saved) {
          const data = JSON.parse(saved);
          if (data?.items?.length > 0) {
            setSavedDraft(data);
            setShowRestoreDialog(true);
            checkDraftDuplicate(data.popupData?.invoiceNumber, data.popupData?.supplierId);
          }
        }
      } catch {}
    }).catch(() => {
      setUserId('default');
      try {
        const saved = localStorage.getItem('grn_v2_draft_default');
        if (saved) {
          const data = JSON.parse(saved);
          if (data?.items?.length > 0) {
            setSavedDraft(data);
            setShowRestoreDialog(true);
            checkDraftDuplicate(data.popupData?.invoiceNumber, data.popupData?.supplierId);
          }
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (!showStartPopup) {
      setTimeout(() => panelSearchRef.current?.focus(), 100);
    }
  }, [showStartPopup]);

  // ── Load existing draft from ?id= URL param ───────────────────────────────────
  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get('id');
    if (!urlId) return;
    api.get(`/grn/${urlId}`)
      .then((r) => {
        const g = r.data;
        if (g.status === 'CANCELLED') {
          toast.error('Cancelled GRNs cannot be edited');
          router.push('/dashboard/grn');
          return;
        }
        setEditGrnStatus(g.status);
        const basicCost = (it: any) => Number(it.basicCostPrice ?? 0);
        const tradeP    = (it: any) => Number(it.disc1Percent ?? 0);
        const schemeP   = (it: any) => Number(it.disc2Percent ?? 0);
        const cashP     = (it: any) => Number(it.disc3Percent ?? 0);

        const mapped: GrnItem[] = (g.items ?? []).map((it: any) => {
          const bcp = basicCost(it);
          const td  = tradeP(it);
          const sd  = schemeP(it);
          const cd  = cashP(it);
          const tradeRs  = r2(bcp * td / 100);
          const schemeRs = r2(bcp * sd / 100);
          const cashRs   = r2(bcp * cd / 100);
          return {
            productId:       it.product?.id ?? it.productId ?? '',
            productName:     it.productName ?? '',
            productCode:     it.productCode ?? '',
            hsnCode:         it.hsnCode ?? '',
            unitOfMeasure:   it.product?.unitOfMeasure ?? 'PCS',
            gstRate:         Number(it.gstRatePercent ?? 0),
            dbGstRate:       Number(it.gstRatePercent ?? 0),  // loaded from saved GRN
            basicCostPrice:  bcp,
            tradePercent:    td,  tradeRs,
            schemePercent:   sd,  schemeRs,
            cashPercent:     cd,  cashRs,
            casesReceived:   Number(it.casesReceived ?? 0),
            looseQty:        Number(it.looseQty ?? 0),
            packSize:        Number(it.packSize ?? 1),
            freeCases:       Number(it.freeCases ?? 0),
            freeLoose:       Number(it.freeLoose ?? 0),
            mrp:             Number(it.mrp ?? 0),
            sellingPrice:    Number(it.sellingPrice ?? 0),
            cessRate:        Number(it.cessRate ?? 0),
            batchNumber:     it.batchNumber ?? '',
            expiryDate:      it.expiryDate ? String(it.expiryDate).split('T')[0] : '',
            rejectedQty:     Number(it.rejectedQty ?? 0),
            rejectionReason: it.rejectionReason ?? '',
          };
        });

        setSupplierId(g.supplierId ?? '');
        setSupplierName(g.supplierName ?? '');
        setSupplierGstin(g.supplierGstin ?? '');
        setInvoiceNumber(g.invoiceNumber ?? '');
        setInvoiceDateISO(String(g.invoiceDate ?? '').split('T')[0]);
        setInvoiceControlTotal(Number(g.invoiceControlTotal ?? 0));
        setTaxType((g.taxType ?? 'TAX_EXCLUSIVE') as 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE');
        setBranchId(g.branchId ?? '');
        setGrnId(g.id);
        setAdj({
          billDiscountPercent:  Number(g.billDiscountPercent  ?? 0),
          billCashDiscPercent:  Number(g.cashDiscountPercent  ?? 0),
          billCashDiscRs:       0,
          freightCharges:       Number(g.freightCharges       ?? 0),
          hamaliCharges:        Number(g.hamaliCharges        ?? 0),
          otherCharges:         Number(g.otherCharges         ?? 0),
          roundingAmount:       Number(g.roundingAmount       ?? 0),
          advanceAdjusted:      Number(g.advanceAdjusted      ?? 0),
          paymentDueDate:       g.paymentDueDate ? String(g.paymentDueDate).split('T')[0] : '',
          paymentMode:          g.paymentMode     ?? '',
          paymentReference:     g.paymentReference ?? '',
          paymentNotes:         g.paymentNotes    ?? '',
        });
        setItems(mapped);
        setShowStartPopup(false);
        setShowRestoreDialog(false);
        toast.success('Draft loaded for editing');
      })
      .catch(() => {
        toast.error('Failed to load GRN draft');
        router.push('/dashboard/grn');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep draftRef in sync with latest state (stale-closure-safe) ──────────────
  useEffect(() => {
    draftRef.current = {
      popupData: {
        supplierId, supplierName, supplierGstin,
        invoiceNumber,
        invoiceDateRaw: isoToDMY(invoiceDateISO),
        invoiceDateISO, invoiceControlTotal, taxType,
      },
      items,
      adj,
    };
  });

  // ── Debounced auto-save (10s after any items/adj change) ──────────────────────
  useEffect(() => {
    if (items.length === 0) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { saveToLocal(); }, 10000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, adj]);

  // ── localNow ticker (for "Xs ago" display) ────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setLocalNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // ── saveToLocal ───────────────────────────────────────────────────────────────
  function saveToLocal() {
    const key = 'grn_v2_draft_' + (userId || 'default');
    setLocalSaveStatus('saving');
    try {
      const data = { savedAt: Date.now(), grnId: grnId ?? null, ...draftRef.current };
      localStorage.setItem(key, JSON.stringify(data));
      setLocalSavedAt(Date.now());
      setLocalSaveStatus('saved');
    } catch {
      setLocalSaveStatus('failed');
    }
  }

  // ── handleRestore ─────────────────────────────────────────────────────────────
  function handleRestore() {
    if (!savedDraft) return;
    const d = savedDraft;
    setSupplierId(d.popupData.supplierId);
    setSupplierName(d.popupData.supplierName);
    setSupplierGstin(d.popupData.supplierGstin);
    setInvoiceNumber(d.popupData.invoiceNumber);
    setInvoiceDateISO(d.popupData.invoiceDateISO);
    setInvoiceControlTotal(d.popupData.invoiceControlTotal);
    setTaxType(d.popupData.taxType);
    setItems(d.items);
    setAdj(d.adj);
    setShowRestoreDialog(false);
    setShowStartPopup(false);
    toast.success('Draft restored');
  }

  // ── checkDraftDuplicate ───────────────────────────────────────────────────────
  function checkDraftDuplicate(invoiceNumber?: string, supplierId?: string) {
    if (!invoiceNumber || !supplierId) return;
    api.get('/grn', { params: { invoiceNumber, supplierId, excludeStatus: 'DRAFT', limit: 5 } })
      .then((r) => {
        const hits = (r.data.data ?? []).filter((g: any) => g.status !== 'DRAFT');
        if (hits.length > 0) setDraftDuplicateStatus(hits[0].status as string);
        else setDraftDuplicateStatus(null);
      })
      .catch(() => setDraftDuplicateStatus(null));
  }

  // ── handleStartFresh ──────────────────────────────────────────────────────────
  function handleStartFresh() {
    try { localStorage.removeItem('grn_v2_draft_' + (userId || 'default')); } catch {}
    setSavedDraft(null);
    setDraftDuplicateStatus(null);
    setShowRestoreDialog(false);
  }

  // ── Product search (panel) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!panelSearch.trim()) { setPanelResults([]); isScannerInput.current = false; return; }

    // Shorter debounce for scanner (fast input), normal for keyboard
    const delay = isScannerInput.current ? 120 : 280;

    const t = setTimeout(() => {
      api.get('/grn/search-products', { params: { q: panelSearch } })
        .then((r) => {
          const results = r.data ?? [];
          setPanelResults(results);

          // Auto-load if scanner input returned exactly 1 match
          if (isScannerInput.current && results.length === 1) {
            loadProductIntoPanel(results[0]);
          }
        })
        .catch(() => setPanelResults([]));
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelSearch]);

  // ── Interstate check ──────────────────────────────────────────────────────────
  const isInterState = useMemo(() => {
    if (!supplierGstin || !businessState) return false;
    return supplierGstin.substring(0, 2) !== businessState;
  }, [supplierGstin, businessState]);

  // ── Panel discount calculation (linked pairs) ─────────────────────────────────
  const panelDiscCalc = useMemo(() => {
    if (panelMode === 'empty') return null;
    const bcp = panelItem.basicCostPrice;

    // All three discounts are independent — each % applied on basicCostPrice (not cascaded)
    // Pair 1: Trade
    let tradeRs: number, tradePercent: number;
    if (pairMaster.trade === 'pct') {
      tradeRs = bcp > 0 ? bcp * panelItem.tradePercent / 100 : 0;
      tradePercent = panelItem.tradePercent;
    } else {
      tradeRs = panelItem.tradeRs;
      tradePercent = bcp > 0 ? r4(panelItem.tradeRs / bcp * 100) : 0;
    }

    // Pair 2: Scheme — on bcp directly, not on (bcp - tradeRs)
    let schemeRs: number, schemePercent: number;
    if (pairMaster.scheme === 'pct') {
      schemeRs = bcp > 0 ? bcp * panelItem.schemePercent / 100 : 0;
      schemePercent = panelItem.schemePercent;
    } else {
      schemeRs = panelItem.schemeRs;
      schemePercent = bcp > 0 ? r4(panelItem.schemeRs / bcp * 100) : 0;
    }

    // Pair 3: Cash — on bcp directly, not on (bcp - tradeRs - schemeRs)
    let cashRs: number, cashPercent: number;
    if (pairMaster.cash === 'pct') {
      cashRs = bcp > 0 ? bcp * panelItem.cashPercent / 100 : 0;
      cashPercent = panelItem.cashPercent;
    } else {
      cashRs = panelItem.cashRs;
      cashPercent = bcp > 0 ? r4(panelItem.cashRs / bcp * 100) : 0;
    }

    const netCostPrice = Math.max(0, bcp - tradeRs - schemeRs - cashRs);
    const discExceeds = panelItem.basicCostPrice > 0 && netCostPrice <= 0 && (tradeRs + schemeRs + cashRs) > 0;

    // Line-level Rs: what the supplier bill actually shows (per-unit × received qty)
    const totalQty = (panelItem.casesReceived || 0) * (panelItem.packSize || 1) + (panelItem.looseQty || 0);
    const tradeLineRs  = r2(tradeRs  * totalQty);
    const schemeLineRs = r2(schemeRs * totalQty);
    const cashLineRs   = r2(cashRs   * totalQty);

    return { tradeRs, tradePercent, schemeRs, schemePercent, cashRs, cashPercent,
             tradeLineRs, schemeLineRs, cashLineRs, totalQty,
             netCostPrice, discExceeds };
  }, [panelItem.basicCostPrice, panelItem.tradePercent, panelItem.tradeRs,
      panelItem.schemePercent, panelItem.schemeRs, panelItem.cashPercent, panelItem.cashRs,
      panelItem.casesReceived, panelItem.packSize, panelItem.looseQty,
      pairMaster, panelMode]);

  // ── Calculations ──────────────────────────────────────────────────────────────
  const calcs = useMemo(
    () => items.map((it) => calcItem(it, taxType, isInterState)),
    [items, taxType, isInterState],
  );

  const totals = useMemo(() => {
    const taxableTotal    = calcs.reduce((s, c) => s + c.taxable, 0);
    const cgstTotal       = calcs.reduce((s, c) => s + c.cgst, 0);
    const sgstTotal       = calcs.reduce((s, c) => s + c.sgst, 0);
    const igstTotal       = calcs.reduce((s, c) => s + c.igst, 0);
    const cessTotal       = calcs.reduce((s, c) => s + c.cess, 0);
    const itemsTotal      = calcs.reduce((s, c) => s + c.lineTotal, 0);
    // Bill discount is on itemsTotal (taxable+tax), matching supplier bill behaviour
    const billDiscAmt     = itemsTotal * adj.billDiscountPercent / 100;
    const billCashDiscAmt = adj.billCashDiscRs;
    // preGrand: base for cash-disc % calc (includes rounding so cash% applies after rounding)
    const preGrand        = itemsTotal - billDiscAmt + adj.freightCharges + adj.hamaliCharges + adj.otherCharges + adj.roundingAmount;
    const grandTotal      = preGrand - billCashDiscAmt;
    // grandPreRound: grand total excluding rounding — used for auto-rounding calculation
    const grandPreRound   = itemsTotal - billDiscAmt + adj.freightCharges + adj.hamaliCharges + adj.otherCharges - billCashDiscAmt;
    const amtPayable      = grandTotal - adj.advanceAdjusted;
    return { taxableTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, itemsTotal, billDiscAmt, billCashDiscAmt, preGrand, grandTotal, grandPreRound, amtPayable };
  }, [calcs, adj]);

  const panelCalc = useMemo(() => {
    if (panelMode === 'empty' || !panelDiscCalc) return null;
    const resolved = { ...panelItem, tradeRs: panelDiscCalc.tradeRs, schemeRs: panelDiscCalc.schemeRs, cashRs: panelDiscCalc.cashRs };
    return calcItem(resolved, taxType, isInterState);
  }, [panelItem, panelDiscCalc, panelMode, taxType, isInterState]);

  // ── Margin guard (mirrors backend: cost-incl-tax × (1 + 4%)) ──────────────────
  const MIN_MARGIN_PCT = 4;
  const marginInfo = useMemo(() => {
    if (!panelDiscCalc) return null;
    const netCost = panelDiscCalc.netCostPrice;          // per-unit net cost
    const gst  = Number(panelItem.gstRate ?? 0);
    const cess = Number(panelItem.cessRate ?? 0);
    const sp   = Number(panelItem.sellingPrice ?? 0);
    if (netCost <= 0 || sp <= 0) return null;
    // For TAX_INCLUSIVE the net cost already has GST → strip it to get the ex-GST cost
    const exGstCost = (taxType === 'TAX_INCLUSIVE' && gst > 0) ? netCost / (1 + gst / 100) : netCost;
    const costIncl  = exGstCost * (1 + (gst + cess) / 100);
    const minSp     = Math.round(costIncl * (1 + MIN_MARGIN_PCT / 100) * 100) / 100;
    const below     = sp < minSp - 0.001;
    const allowed   = marginAllowedIds.has(panelItem.productId);
    return { below, minSp, allowed };
  }, [panelDiscCalc, panelItem.gstRate, panelItem.cessRate, panelItem.sellingPrice, panelItem.productId, taxType, marginAllowedIds]);

  async function allowBelowMarginForPanel() {
    if (!panelItem.productId) return;
    setMarginFlagSaving(true);
    try {
      await api.patch(`/products/${panelItem.productId}/allow-below-margin`, { allow: true });
      setMarginAllowedIds((prev) => new Set(prev).add(panelItem.productId));
      toast.success('Below-margin pricing allowed for this product');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed (manager access required)');
    } finally { setMarginFlagSaving(false); }
  }

  // ── Tolerance ─────────────────────────────────────────────────────────────────
  const tolerance = useMemo(() => {
    if (!invoiceControlTotal) return null;
    const diff = r2(Math.abs(totals.grandTotal - invoiceControlTotal));
    if (diff === 0) return { diff, canSubmit: true, needsConfirm: false, color: 'green',  msg: 'Matched' };
    if (diff <= 1)  return { diff, canSubmit: true, needsConfirm: false, color: 'green',  msg: `Acceptable — Rs.${inr(diff)}` };
    if (diff <= 10) return { diff, canSubmit: true, needsConfirm: false, color: 'amber',  msg: `Small difference — Rs.${inr(diff)}` };
    if (diff <= 50) return { diff, canSubmit: true, needsConfirm: true,  color: 'orange', msg: `Verify difference — Rs.${inr(diff)}` };
    return           { diff, canSubmit: false, needsConfirm: false, color: 'red',    msg: `Cannot save — Rs.${inr(diff)}` };
  }, [totals.grandTotal, invoiceControlTotal]);

  const progressPct = invoiceControlTotal > 0
    ? Math.min((totals.grandTotal / invoiceControlTotal) * 100, 110) : 0;

  // ── Popup handlers ────────────────────────────────────────────────────────────
  function handlePopupDateRaw(raw: string) {
    const formatted = formatDateInput(raw);
    setPopupInvDateError(''); setPopupInvDateWarn('');
    setPopupData((p) => ({ ...p, invoiceDateRaw: formatted, invoiceDateISO: '' }));
    if (formatted.length < 10) return;
    if (!isValidDMY(formatted)) { setPopupInvDateError('Invalid date'); return; }
    const iso = dmyToISO(formatted);
    if (iso > getTodayISO()) { setPopupInvDateError('Invoice date cannot be in the future'); return; }
    if (iso < getSixMonthsAgoISO()) setPopupInvDateWarn('Invoice older than 6 months — ITC may not be eligible');
    setPopupData((p) => ({ ...p, invoiceDateRaw: formatted, invoiceDateISO: iso }));
  }

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
    setSupplierName(popupData.supplierName);
    setSupplierGstin(popupData.supplierGstin);
    setInvoiceNumber(popupData.invoiceNumber);
    setInvoiceDateISO(popupData.invoiceDateISO);
    setTaxType(popupData.taxType);
    setInvoiceControlTotal(popupData.invoiceControlTotal);
    setShowStartPopup(false);
    // Fix 3: warn if this invoice already exists for this supplier
    if (popupData.invoiceNumber && popupData.supplierId) {
      api.get('/grn', {
        params: { invoiceNumber: popupData.invoiceNumber, supplierId: popupData.supplierId, excludeStatus: 'DRAFT', limit: 5 },
      }).then((r) => {
        const hits = (r.data.data ?? []).filter((g: any) => g.status !== 'DRAFT');
        if (hits.length > 0) {
          const st = (hits[0].status as string).replace('_', ' ');
          toast(`Invoice ${popupData.invoiceNumber} already exists for this supplier as ${st}. This GRN cannot be submitted as-is.`, { duration: 6000 });
        }
      }).catch(() => {});
    }
  }

  // ── Panel handlers ────────────────────────────────────────────────────────────
  async function loadProductIntoPanel(p: SearchProduct) {
    setPanelSearch('');
    setPanelResults([]);
    let lastRate: any = null;
    try {
      const r = await api.get(`/grn/product/${p.id}/last-rates`);
      lastRatesCache.current[p.id] = r.data ?? [];
      lastRate = r.data?.[0] ?? null;
    } catch {}
    const dbRate = n(p.gstRatePercent);
    setPanelItem({
      productId: p.id,
      productName: p.name,
      productCode: p.productCode ?? '',
      hsnCode: p.hsnCode ?? '',
      unitOfMeasure: p.unitOfMeasure,
      gstRate: lastRate?.gstRatePercent ?? dbRate,
      dbGstRate: dbRate,
      basicCostPrice: lastRate?.basicCostPrice ?? n(p.costPrice),
      tradePercent: 0, tradeRs: 0,
      schemePercent: 0, schemeRs: 0,
      cashPercent: 0, cashRs: 0,
      casesReceived: 0, looseQty: 0, packSize: 1, freeCases: 0, freeLoose: 0,
      mrp: lastRate?.mrp ?? n(p.mrp),
      sellingPrice: lastRate?.sellingPrice ?? n(p.sellingPrice),
      cessRate: lastRate?.cessRate ?? n(p.cessRate),
      batchNumber: '', expiryDate: '', rejectedQty: 0, rejectionReason: '',
    });
    setPairMaster({ trade: 'pct', scheme: 'pct', cash: 'pct' });
    // Seed the allowed-set if this product is already flagged to skip the margin rule
    if ((p as any).allowBelowMargin) setMarginAllowedIds((prev) => new Set(prev).add(p.id));
    setPanelMode('loaded');
    setEditIdx(-1);
    setShowBatch(false);
    setTimeout(() => firstPanelInputRef.current?.focus(), 60);
  }

  function selectRow(idx: number) {
    if (idx < 0 || idx >= items.length) return;
    const item = items[idx];
    setPanelItem({ ...item });

    // Infer which field was master when the row was saved (all discounts are on bcp)
    const bcp = item.basicCostPrice;
    const tradeMaster: 'pct' | 'rs' =
      bcp > 0 && r2(bcp * item.tradePercent / 100) === item.tradeRs ? 'pct' : 'rs';
    const schemeMaster: 'pct' | 'rs' =
      bcp > 0 && r2(bcp * item.schemePercent / 100) === item.schemeRs ? 'pct' : 'rs';
    const cashMaster: 'pct' | 'rs' =
      bcp > 0 && r2(bcp * item.cashPercent / 100) === item.cashRs ? 'pct' : 'rs';
    setPairMaster({ trade: tradeMaster, scheme: schemeMaster, cash: cashMaster });

    setPanelMode('loaded');
    setEditIdx(idx);
    setGridFocusIdx(idx);
    setShowBatch(!!(item.batchNumber || item.expiryDate || item.rejectedQty));
    setTimeout(() => firstPanelInputRef.current?.focus(), 60);
  }

  async function handleAddPluFromGrn() {
    if (!panelItem.productId) return;
    if (!addPluForm.mrp)          { toast.error('MRP required'); return; }
    if (!addPluForm.sellingPrice) { toast.error('Selling price required'); return; }
    setAddPluSaving(true);
    try {
      const res = await api.post(`/products/${panelItem.productId}/plus`, {
        mrp:          Number(addPluForm.mrp),
        sellingPrice: Number(addPluForm.sellingPrice),
        gstRate:      addPluForm.gstRate ? Number(addPluForm.gstRate) : undefined,
        cessRate:     addPluForm.cessRate ? Number(addPluForm.cessRate) : undefined,
        packLabel:    addPluForm.packLabel.trim() || undefined,
      });
      toast.success('PLU created — prices updated in panel');
      // Auto-fill GRN panel with the new PLU values
      updatePanel({ mrp: Number(addPluForm.mrp), sellingPrice: Number(addPluForm.sellingPrice) });
      if (addPluForm.gstRate) updatePanel({ gstRate: Number(addPluForm.gstRate) });
      setShowAddPluModal(false);
      setAddPluForm({ mrp: '', sellingPrice: '', gstRate: '', cessRate: '0', packLabel: '' });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create PLU');
    } finally { setAddPluSaving(false); }
  }

  function clearPanel() {
    setPanelMode('empty');
    setEditIdx(-1);
    setPanelItem(defaultItem());
    setPairMaster({ trade: 'pct', scheme: 'pct', cash: 'pct' });
    setPanelSearch('');
    setPanelResults([]);
    setShowBatch(false);
    setGridFocusIdx(-1);
    setTimeout(() => panelSearchRef.current?.focus(), 60);
  }

  function savePanel() {
    if (!panelItem.productId) { toast.error('No product selected'); return; }
    if (!panelDiscCalc) return;
    // Resolve effective values from the linked-pair calculation; round Rs to 2dp for storage
    const resolvedItem: GrnItem = {
      ...panelItem,
      tradePercent:  panelDiscCalc.tradePercent,
      tradeRs:       r4(panelDiscCalc.tradeRs),   // 4dp — preserves line Rs round-trip
      schemePercent: panelDiscCalc.schemePercent,
      schemeRs:      r4(panelDiscCalc.schemeRs),
      cashPercent:   panelDiscCalc.cashPercent,
      cashRs:        r4(panelDiscCalc.cashRs),
    };
    const c = calcItem(resolvedItem, taxType, isInterState);
    if (c.totalReceivedQty <= 0) { toast.error('Enter quantity received'); return; }
    if (panelItem.basicCostPrice <= 0) { toast.error('Enter basic cost price'); return; }
    if (panelItem.mrp <= 0) { toast.error('Enter MRP'); return; }

    let newItems: GrnItem[];
    if (editIdx >= 0) {
      newItems = items.map((it, i) => i === editIdx ? resolvedItem : it);
      setItems(newItems);
      toast.success('Row updated');
    } else {
      // Allow same product with a DIFFERENT MRP (mixed-batch scenario).
      // Block only if MRP is identical — that would be a true accidental duplicate.
      const sameMrpExists = items.some(
        (i) => i.productId === panelItem.productId && Math.abs(i.mrp - panelItem.mrp) < 0.01,
      );
      if (sameMrpExists) {
        toast.error('This product with the same MRP is already in the list. Click the row to edit it.');
        return;
      }
      newItems = [...items, resolvedItem];
      setItems(newItems);
      const batchCount = items.filter((i) => i.productId === panelItem.productId).length;
      toast.success(batchCount > 0 ? `${panelItem.productName} added as Batch ${batchCount + 1}` : `${panelItem.productName} added`);
    }
    // Immediately persist — React state is async so we update the ref directly
    draftRef.current = { ...draftRef.current, items: newItems };
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    saveToLocal();
    clearPanel();
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (editIdx === idx) clearPanel();
    else if (editIdx > idx) setEditIdx((e) => e - 1);
    setGridFocusIdx(-1);
  }

  function updatePanel(patch: Partial<GrnItem>) {
    setPanelItem((prev) => ({ ...prev, ...patch }));
  }

  // ── Spread charges ────────────────────────────────────────────────────────────
  function spreadCharges() {
    const totalCharges = adj.hamaliCharges + adj.freightCharges;
    if (totalCharges <= 0) { toast('No freight/hamali to spread'); return; }
    if (items.length === 0) { toast('Add items first'); return; }
    const totalTaxable = calcs.reduce((s, c) => s + c.taxable, 0);
    if (totalTaxable <= 0) { toast('Enter quantities and costs first'); return; }
    setItems((prev) => prev.map((item, idx) => {
      const c = calcs[idx];
      if (c.totalReceivedQty <= 0) return item;
      const proportion = c.taxable / totalTaxable;
      const chargePerUnit = r2((totalCharges * proportion) / c.totalReceivedQty);
      return { ...item, basicCostPrice: r2(item.basicCostPrice + chargePerUnit) };
    }));
    toast.success('Charges spread across items by value');
  }

  // ── Grid keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showStartPopup) return;
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        savePanel();
        return;
      }
      if (e.key === 'Escape' && panelMode === 'loaded') {
        clearPanel();
        return;
      }
      if (panelMode !== 'empty') return;
      if (document.activeElement && (document.activeElement as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setGridFocusIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setGridFocusIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && gridFocusIdx >= 0) {
        e.preventDefault();
        selectRow(gridFocusIdx);
      } else if (e.key === 'Delete' && gridFocusIdx >= 0) {
        e.preventDefault();
        if (window.confirm(`Remove ${items[gridFocusIdx]?.productName}?`)) {
          removeRow(gridFocusIdx);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStartPopup, panelMode, gridFocusIdx, items, panelItem, editIdx]);

  // ── Save/Submit ───────────────────────────────────────────────────────────────
  const validate = useCallback((isDraft: boolean) => {
    if (!supplierId)           { toast.error('Supplier required'); return false; }
    if (!branchId)             { toast.error('Branch required'); return false; }
    if (!invoiceNumber.trim()) { toast.error('Invoice number required'); return false; }
    if (!invoiceDateISO)       { toast.error('Invoice date required'); return false; }
    if (!isDraft && tolerance && !tolerance.canSubmit) { toast.error('Invoice total difference too large — must reconcile before submitting'); return false; }
    if (items.length === 0)    { toast.error('Add at least one item'); return false; }
    for (const it of items) {
      const c = calcs[items.indexOf(it)];
      if (c.totalReceivedQty <= 0) { toast.error(`${it.productName}: enter qty`); return false; }
      if (it.basicCostPrice <= 0)  { toast.error(`${it.productName}: enter cost price`); return false; }
      if (it.mrp <= 0)             { toast.error(`${it.productName}: enter MRP`); return false; }
    }
    return true;
  }, [supplierId, branchId, invoiceNumber, invoiceDateISO, tolerance, items, calcs]);

  async function handleSave(isDraft: boolean) {
    if (!validate(isDraft)) return;
    if (!isDraft && tolerance?.needsConfirm) {
      if (!confirm(`Difference of Rs.${inr(tolerance.diff)} exists. Submit anyway?`)) return;
    }
    setSaving(true);
    try {
      const payload = {
        supplierId, branchId, invoiceNumber,
        invoiceDate: invoiceDateISO,
        taxType, isDraft,
        // Numeric adjustment fields: always send explicit value (even 0).
        // Using `|| undefined` was wrong — `0 || undefined` sends undefined,
        // causing the backend to keep the old value when user clears a charge.
        billDiscountPercent: adj.billDiscountPercent,
        billCashDiscPercent: adj.billCashDiscPercent,
        billCashDiscRs:      adj.billCashDiscRs,
        freightCharges:      adj.freightCharges,
        hamaliCharges:       adj.hamaliCharges,
        otherCharges:        adj.otherCharges,
        roundingAmount:      adj.roundingAmount,
        invoiceControlTotal: invoiceControlTotal,
        advanceAdjusted:     adj.advanceAdjusted,
        // String/optional fields: only send when non-empty
        paymentDueDate:    adj.paymentDueDate    || undefined,
        paymentMode:       adj.paymentMode       || undefined,
        paymentReference:  adj.paymentReference  || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          basicCostPrice: it.basicCostPrice,
          // Always send the GST rate the user sees so backend calculation
          // matches the frontend exactly (backend falls back to DB rate if absent).
          gstRatePercent: it.gstRate,
          // Send 4dp precision so Rs-entered discounts round-trip cleanly (DB now stores Decimal(8,4))
          disc1Percent: it.tradePercent  ? r4(it.tradePercent)  : 0,
          disc2Percent: it.schemePercent ? r4(it.schemePercent) : 0,
          disc3Percent: it.cashPercent   ? r4(it.cashPercent)   : 0,
          casesReceived: it.casesReceived || 0,
          looseQty:      it.looseQty      || 0,
          packSize:      it.packSize,
          freeCases:     it.freeCases     || 0,
          freeLoose:     it.freeLoose     || 0,
          mrp: it.mrp,
          sellingPrice: it.sellingPrice || undefined,
          cessRate:     it.cessRate     || undefined,
          batchNumber:       it.batchNumber       || undefined,
          expiryDate:        it.expiryDate        || undefined,
          rejectedQty:       it.rejectedQty       || undefined,
          rejectionReason:   it.rejectionReason   || undefined,
        })),
      };
      let savedId = grnId;
      let savedGrnNumber: string | null = null;

      if (grnId) {
        // For PENDING/APPROVED GRNs: only PUT (no submit — backend preserves status)
        if (!isDraft && !editGrnStatus) {
          const putRes = await api.put(`/grn/${grnId}`, { ...payload, isDraft: false });
          const subRes = await api.post(`/grn/${grnId}/submit`);
          savedGrnNumber = subRes.data?.grnNumber ?? putRes.data?.grnNumber ?? null;
        } else {
          const putRes = await api.put(`/grn/${grnId}`, payload);
          savedGrnNumber = putRes.data?.grnNumber ?? null;
        }
      } else {
        const res = await api.post('/grn', payload);
        savedId = res.data?.id ?? null;
        savedGrnNumber = res.data?.grnNumber ?? null;
        if (savedId) setGrnId(savedId);
      }

      try { localStorage.removeItem('grn_v2_draft_' + (userId || 'default')); } catch {}

      if (editGrnStatus && editGrnStatus !== 'DRAFT') {
        // Saving changes to an existing PENDING or APPROVED GRN
        const label = savedGrnNumber ?? grnId ?? '';
        toast.success(`Changes saved — ${label}`, { duration: 5000 });
        router.push(savedId ? `/dashboard/grn/${savedId}` : '/dashboard/grn');
      } else if (isDraft) {
        toast.success(savedGrnNumber ? `Draft saved — ${savedGrnNumber}` : 'Draft saved');
        router.push('/dashboard/grn');
      } else {
        // Fresh GRN submitted for approval — navigate to view page so GRN number is visible
        const grnLabel = savedGrnNumber ? ` — ${savedGrnNumber}` : '';
        toast.success(`GRN submitted for approval${grnLabel}`, { duration: 6000 });
        router.push(savedId ? `/dashboard/grn/${savedId}` : '/dashboard/grn');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save GRN');
    } finally {
      setSaving(false);
    }
  }

  // ── Auto-rounding: recalculate whenever the pre-rounding grand total changes ──
  useEffect(() => {
    const autoRounding = parseFloat((Math.round(totals.grandPreRound) - totals.grandPreRound).toFixed(2));
    setAdj((a) => ({ ...a, roundingAmount: autoRounding }));
  // grandPreRound excludes roundingAmount, so user edits to rounding don't retrigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.grandPreRound]);

  // ── Render ────────────────────────────────────────────────────────────────────

  const isInterStateBadge = isInterState ? 'INTERSTATE' : 'INTRASTATE';
  const invoiceDateDisplay = invoiceDateISO
    ? new Date(invoiceDateISO).toLocaleDateString('en-IN') : '';

  // Shared input class for detail panel fields
  const fi = 'w-full px-2 py-1.5 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1B4F8A] focus:ring-1 focus:ring-[#1B4F8A]/20 placeholder:text-slate-400';
  const fiCenter = 'w-full px-2 py-1.5 text-center text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1B4F8A] focus:ring-1 focus:ring-[#1B4F8A]/20 placeholder:text-slate-400';

  useEscapeKey(() => setShowRestoreDialog(false), showRestoreDialog);

  // ── Restore dialog helpers ────────────────────────────────────────────────────
  const draftAgoSec = savedDraft ? Math.round((Date.now() - savedDraft.savedAt) / 1000) : 0;
  const draftAgoMin = Math.round(draftAgoSec / 60);
  const draftAgoLabel = draftAgoSec < 60 ? `${draftAgoSec}s ago` : `${draftAgoMin} min ago`;
  const draftCalcs = savedDraft ? savedDraft.items.map((it) => calcItem(it, savedDraft.popupData.taxType, false)) : [];
  const draftGrandTotal = r2(draftCalcs.reduce((s, c) => s + c.lineTotal, 0));

  return (
    <>

      {/* ── Restore dialog ───────────────────────────────────────────────────── */}
      {showRestoreDialog && savedDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRestoreDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Unsaved GRN Draft Found</h2>
              <p className="text-xs text-gray-400 mt-0.5">A draft was auto-saved while you were entering items.</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className={`border rounded-xl px-4 py-3 space-y-1.5 text-sm ${draftDuplicateStatus ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier</span>
                  <span className="font-medium text-gray-800">{savedDraft.popupData.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice</span>
                  <span className="font-mono text-gray-800">{savedDraft.popupData.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Items</span>
                  <span className="font-medium text-gray-800">{savedDraft.items.length} item{savedDraft.items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className={`font-semibold ${draftDuplicateStatus ? 'text-amber-700' : 'text-blue-700'}`}>Rs.{inr(draftGrandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Saved</span>
                  <span className="text-gray-600">{draftAgoLabel}</span>
                </div>
              </div>

              {draftDuplicateStatus && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm space-y-1">
                  <p className="font-semibold text-red-700">Warning: Invoice already exists</p>
                  <p className="text-red-600 text-xs">
                    Invoice {savedDraft.popupData.invoiceNumber} already exists for{' '}
                    {savedDraft.popupData.supplierName} as{' '}
                    <span className="font-semibold">{draftDuplicateStatus.replace(/_/g, ' ')}</span>.
                  </p>
                  <p className="text-red-500 text-xs">
                    This draft cannot be submitted — it will always fail the duplicate check.
                    Recommended: Start Fresh.
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={handleStartFresh}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                  draftDuplicateStatus
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Start Fresh
              </button>
              <button
                onClick={handleRestore}
                disabled={!!draftDuplicateStatus}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                  draftDuplicateStatus
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#1B4F8A] text-white hover:bg-[#163f6e]'
                }`}
              >
                Restore Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Start popup ─────────────────────────────────────────────────────── */}
      {showStartPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">

            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">New GRN — Invoice Details</h2>
              <p className="text-xs text-gray-400 mt-0.5">These details are locked once you start entering items.</p>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Business info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                <div className="text-sm">
                  <p className="font-semibold text-blue-900">{businessInfo.name || 'Loading…'}</p>
                  <p className="text-blue-700 text-xs mt-0.5">
                    GSTIN: {businessInfo.gstin || 'Not set'}{businessInfo.branchName ? ` · Branch: ${businessInfo.branchName}` : ''}
                  </p>
                </div>
                <button onClick={() => router.push('/dashboard/settings')} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0">
                  <Settings className="w-3.5 h-3.5" /> Settings
                </button>
              </div>

              {/* Supplier */}
              <div className="space-y-1">
                <label className="label">Supplier *</label>
                <SupplierCombo suppliers={suppliers} value={popupData.supplierId} onSelect={handlePopupSupplierSelect} />
                <button type="button" onClick={() => openInNewWindow('/dashboard/suppliers/new')} className="text-xs text-[#1B4F8A] hover:underline">
                  + Add Supplier in New Window
                </button>
                {popupErrors.supplier && <p className="text-xs text-red-500">{popupErrors.supplier}</p>}
                {popupLoadingSupplier && <p className="text-xs text-gray-400">Checking previous GRNs…</p>}
                {popupData.supplierGstin && !popupLoadingSupplier && (() => {
                  const g = popupData.supplierGstin;
                  const interstate = businessState ? g.slice(0, 2) !== businessState : false;
                  return (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${interstate ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {interstate ? 'INTERSTATE' : 'INTRASTATE'}
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
                    Invoice: {popupDraft.invoiceNumber || 'No invoice number'} &middot; {popupDraft._count?.items ?? 0} items
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => router.push(`/dashboard/grn/${popupDraft.id}/edit`)} className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg font-medium hover:bg-amber-700">Load Draft</button>
                    <button onClick={() => setPopupDraft(null)} className="px-3 py-1.5 bg-white text-amber-700 text-xs rounded-lg border border-amber-200 hover:bg-amber-50">Start Fresh</button>
                  </div>
                </div>
              )}

              {/* Invoice details */}
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
                </div>
              </div>

              {/* Branch */}
              {branches.length > 1 && (
                <div className="space-y-1">
                  <label className="label">Branch *</label>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="finp">
                    <option value="">Select branch…</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {/* Tax type */}
              <div className="space-y-2">
                <label className="label">Tax Type *</label>
                <div className="flex flex-col gap-2">
                  {(['TAX_EXCLUSIVE', 'TAX_INCLUSIVE'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="v2TaxType" value={t}
                        checked={popupData.taxType === t}
                        onChange={() => setPopupData((p) => ({ ...p, taxType: t }))}
                        className="accent-[#1B4F8A]"
                      />
                      <span className="text-sm text-gray-700">
                        {t === 'TAX_EXCLUSIVE' ? 'Tax Exclusive — GST added on top of price' : 'Tax Inclusive — GST already included in price'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => router.push('/dashboard/grn')} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleStartGrn} className="flex-1 py-2.5 bg-[#1B4F8A] text-white font-semibold rounded-xl hover:bg-[#163f6e] text-sm">
                Start GRN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5-section grid layout ───────────────────────────────────────────── */}
      {!showStartPopup && (
        <div
          className="overflow-hidden bg-gray-50"
          style={{ display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', height: '100vh' }}
        >

          {/* ── Status banner when editing existing GRN ─────────────────── */}
          {editGrnStatus && editGrnStatus !== 'DRAFT' && (
            <div className={`px-4 py-2 text-xs font-medium flex items-center gap-2 ${
              editGrnStatus === 'APPROVED'
                ? 'bg-blue-50 text-blue-700 border-b border-blue-100'
                : editGrnStatus === 'PENDING_APPROVAL'
                ? 'bg-amber-50 text-amber-700 border-b border-amber-100'
                : 'bg-gray-50 text-gray-600 border-b border-gray-100'
            }`}>
              <span className={`inline-block w-2 h-2 rounded-full ${
                editGrnStatus === 'APPROVED' ? 'bg-blue-500' : 'bg-amber-500'
              }`} />
              {editGrnStatus === 'APPROVED'
                ? 'This GRN is approved. Editing items or quantities will update stock automatically. Changing supplier or invoice number will reset status to Draft.'
                : 'This GRN is pending approval. You can edit and save — the manager can approve the updated version.'}
            </div>
          )}

          {/* ── SECTION 1: Header bar ─────────────────────────────────────── */}
          <div className="bg-white border-b border-gray-200">
            <div className="flex items-center justify-between px-4 h-12">
              <div className="flex items-center gap-3 min-w-0">
                <BackButton fallbackHref="/dashboard/grn" />
                <div className="min-w-0">
                  <span className="font-semibold text-gray-800 text-sm truncate">{supplierName}</span>
                  <span className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded ${isInterState ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {isInterStateBadge}
                  </span>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
                <span className="font-mono font-medium text-gray-700">#{invoiceNumber}</span>
                <span>|</span>
                <span>{invoiceDateDisplay}</span>
                <span>|</span>
                <span className="uppercase">{taxType.replace('_', ' ')}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Auto-save indicator — hidden on mobile to save space */}
                {localSaveStatus === 'saving' && (
                  <span className="hidden md:inline text-xs text-gray-400">Saving locally…</span>
                )}
                {localSaveStatus === 'saved' && localSavedAt && (
                  <span className="hidden md:inline text-xs text-green-600">
                    Saved {Math.max(0, Math.round((localNow - localSavedAt) / 1000))}s ago
                  </span>
                )}
                {localSaveStatus === 'failed' && (
                  <span className="hidden md:inline text-xs text-red-500">Auto-save failed</span>
                )}
                <button
                  onClick={() => { setShowStartPopup(true); }}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  <span className="hidden md:inline">Edit Details</span>
                  <span className="md:hidden">Edit</span>
                </button>

                {/* Cancel / Back button */}
                <button
                  onClick={() => {
                    if (grnId) {
                      // Editing an existing DB GRN — unsaved edits only live in memory,
                      // so simply navigate back; DB record is untouched.
                      try { localStorage.removeItem('grn_v2_draft_' + (userId || 'default')); } catch {}
                      router.push('/dashboard/grn');
                      return;
                    }
                    if (items.length === 0) {
                      try { localStorage.removeItem('grn_v2_draft_' + (userId || 'default')); } catch {}
                      router.push('/dashboard/grn');
                      return;
                    }
                    // New GRN with items — confirm before discarding
                    if (confirm(`You have ${items.length} item(s) entered that haven't been saved.\nDiscard and go back?`)) {
                      try { localStorage.removeItem('grn_v2_draft_' + (userId || 'default')); } catch {}
                      router.push('/dashboard/grn');
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  title={grnId ? 'Go back without saving changes' : 'Cancel and go back to GRN list'}
                >
                  {grnId ? '← Back' : items.length === 0 ? 'Cancel' : <><span className="hidden md:inline">Discard ({items.length})</span><span className="md:hidden">✕</span></>}
                </button>
                <button onClick={() => setHeaderExpanded((v) => !v)} className="p-1.5 text-gray-400 hover:text-gray-700">
                  {headerExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {headerExpanded && (
              <div className="px-4 pb-3 pt-0 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t border-gray-100 bg-gray-50">
                <div><p className="text-gray-400">Supplier</p><p className="font-medium text-gray-700">{supplierName}</p></div>
                <div><p className="text-gray-400">GSTIN</p><p className="font-mono text-gray-700">{supplierGstin || '—'}</p></div>
                <div><p className="text-gray-400">Invoice #</p><p className="font-mono text-gray-700">{invoiceNumber}</p></div>
                <div><p className="text-gray-400">Invoice Date</p><p className="text-gray-700">{invoiceDateDisplay}</p></div>
                <div><p className="text-gray-400">Tax Type</p><p className="text-gray-700">{taxType.replace('_', ' ')}</p></div>
                <div><p className="text-gray-400">Supply Type</p><p className="text-gray-700">{isInterStateBadge}</p></div>
                <div><p className="text-gray-400">Invoice Total</p><p className="font-medium text-gray-700">Rs.{inr(invoiceControlTotal)}</p></div>
                <div><p className="text-gray-400">Status</p><p className="text-gray-700">{editGrnStatus ?? (grnId ? 'DRAFT' : 'New')}</p></div>
              </div>
            )}
          </div>

          {/* ── SECTION 2: Invoice control bar ───────────────────────────── */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 flex items-center gap-4 h-9">
            <span className="text-xs text-gray-500 shrink-0">
              Invoice: <span className="font-semibold text-gray-700">Rs.{inr(invoiceControlTotal)}</span>
            </span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressPct > 105 ? 'bg-red-500' : progressPct >= 98 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                <span className="hidden md:inline">Rs.{inr(totals.grandTotal)} entered </span>({progressPct.toFixed(0)}%)
              </span>
            </div>
            {tolerance ? (
              <span className={`text-xs font-semibold shrink-0 ${
                tolerance.color === 'green'  ? 'text-green-600'  :
                tolerance.color === 'amber'  ? 'text-amber-600'  :
                tolerance.color === 'orange' ? 'text-orange-600' : 'text-red-600'
              }`}>
                {tolerance.msg}
              </span>
            ) : null}
          </div>

          {/* ── SECTION 3: Search + Detail panel ────────────────────────── */}
          <div className="bg-slate-50 border-b-2 border-slate-200 px-4 py-3.5">
            {panelMode === 'empty' ? (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={panelSearchRef}
                    value={panelSearch}
                    onChange={(e) => {
                      // Detect scanner: chars arriving < 80ms apart = barcode scanner
                      const now = Date.now();
                      const gap = now - lastKeyTimeRef.current;
                      lastKeyTimeRef.current = now;
                      isScannerInput.current = gap < 80;
                      setPanelSearch(e.target.value);
                      setPanelActiveIdx(-1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setPanelActiveIdx((i) => Math.min(i + 1, panelResults.length - 1)); }
                      if (e.key === 'ArrowUp')   { e.preventDefault(); setPanelActiveIdx((i) => Math.max(i - 1, 0)); }
                      if (e.key === 'Enter') {
                        // Highlighted item → load that
                        if (panelActiveIdx >= 0 && panelResults[panelActiveIdx]) {
                          loadProductIntoPanel(panelResults[panelActiveIdx]);
                        // Nothing highlighted but 1+ results → load first (scanner sends Enter after barcode)
                        } else if (panelResults.length > 0) {
                          loadProductIntoPanel(panelResults[0]);
                        }
                      }
                      if (e.key === 'Escape') { setPanelSearch(''); setPanelResults([]); isScannerInput.current = false; }
                    }}
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="Search product by name, code or scan barcode..."
                  />
                  <button
                    type="button"
                    onClick={cameraSupported ? (showCamera ? stopCamera : startCamera) : () => toast.error('Camera scanning not supported. Use Chrome on Android or Safari 17+ on iPhone.')}
                    title={showCamera ? 'Stop camera' : 'Scan barcode with camera'}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${cameraSupported ? (showCamera ? 'text-red-500 hover:text-red-700' : 'text-[#1B4F8A] hover:text-blue-700') : 'text-gray-300'}`}
                  >
                    {showCamera ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  </button>
                  {panelResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-xl shadow-lg z-50 max-h-[250px] overflow-y-auto">
                      {panelResults.map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => loadProductIntoPanel(p)}
                          className={`w-full text-left px-4 py-2.5 text-sm flex justify-between gap-4 ${i === panelActiveIdx ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.productCode}</p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                            {p.unitOfMeasure} · GST {p.gstRatePercent ?? 0}%
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Inline camera strip ──────────────────────────────────── */}
                {showCamera && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 bg-black relative" style={{ height: 140 }}>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                    {/* Thin scanning line */}
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-green-400 opacity-80 animate-pulse" />
                    <p className="absolute bottom-1 left-0 right-0 text-center text-white text-[10px] opacity-70">
                      Point at barcode · Scanning automatically
                    </p>
                  </div>
                )}
                {cameraError && (
                  <p className="text-xs text-red-500 mt-1">{cameraError}</p>
                )}

                <p className="text-xs text-gray-300 text-center mt-2">
                  Type to search or use barcode scanner · Arrow keys to navigate grid · Ctrl+Enter to save row
                </p>
              </div>
            ) : (
              <div>
                {/* Strip: product name + calc summary (buttons moved to ROW C) */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-gray-900 text-sm truncate">{panelItem.productName}</span>
                    {panelItem.productCode && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono shrink-0">{panelItem.productCode}</span>
                    )}
                    {editIdx >= 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">Editing row {editIdx + 1}</span>
                    )}
                  </div>
                  {panelCalc && (
                    <span className="text-xs text-gray-500 shrink-0">
                      Taxable: {inr(panelCalc.taxable)} · {isInterState ? 'IGST' : 'GST'}: {inr(isInterState ? panelCalc.igst : r2(panelCalc.cgst + panelCalc.sgst))}
                      {panelCalc.cess > 0 && ` · Cess: ${inr(panelCalc.cess)}`}
                      {' · '}<span className="font-semibold text-gray-900">Total: Rs.{inr(panelCalc.lineTotal)}</span>
                    </span>
                  )}
                  {/* + New PLU button */}
                  <button
                    onClick={() => {
                      setAddPluForm({ mrp: String(panelItem.mrp || ''), sellingPrice: String(panelItem.sellingPrice || ''), gstRate: String(panelItem.gstRate || ''), cessRate: String(panelItem.cessRate || '0'), packLabel: '' });
                      setShowAddPluModal(true);
                    }}
                    title="Create a new PLU (pack size) for this product"
                    className="text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-2 py-1 rounded-md font-medium transition-colors shrink-0"
                  >+ New PLU</button>
                  {/* Delete button stays in strip */}
                  {editIdx >= 0 && (
                    <button
                      onClick={() => { if (confirm('Remove this item?')) removeRow(editIdx); }}
                      className="ml-auto px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 shrink-0"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {/* Field rows */}
                <div className="overflow-x-auto">
                  <div className="min-w-[920px] space-y-2">

                    {/* ROW A: Quantities */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 pt-2 pb-2.5">
                      <div className="grid grid-cols-6 gap-2 mb-1.5">
                        {['Cases', 'Pack Size', 'Loose Qty', 'Free Cases', 'Free Loose', 'Rcvd Qty'].map((l) => (
                          <label key={l} className="text-[11px] font-bold text-blue-700 text-center uppercase tracking-wider">{l}</label>
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-2">
                        <input ref={firstPanelInputRef} type="number" min="0" step="1"
                          value={panelItem.casesReceived === 0 ? '' : panelItem.casesReceived}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updatePanel({ casesReceived: isNaN(v) ? 0 : Math.max(0, v) });
                          }}
                          className={fiCenter}
                          placeholder="0 = loose only"
                        />
                        <input type="number" min="1" step="1"
                          value={panelItem.packSize === 1 ? '' : panelItem.packSize}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updatePanel({ packSize: isNaN(v) || v < 1 ? 1 : v });
                          }}
                          className={fiCenter}
                          placeholder="1"
                        />
                        <input type="number" min="0" step="0.001"
                          value={panelItem.looseQty || ''}
                          onChange={(e) => updatePanel({ looseQty: Number(e.target.value) || 0 })}
                          className={fiCenter}
                          placeholder="0"
                        />
                        <input type="number" min="0" step="1"
                          value={panelItem.freeCases || ''}
                          onChange={(e) => updatePanel({ freeCases: Number(e.target.value) || 0 })}
                          className={fiCenter}
                          placeholder="0"
                        />
                        <input type="number" min="0" step="0.001"
                          value={panelItem.freeLoose || ''}
                          onChange={(e) => updatePanel({ freeLoose: Number(e.target.value) || 0 })}
                          className={fiCenter}
                          placeholder="0"
                        />
                        <div className={`${fiCenter} !bg-blue-100 !border-blue-400 !text-blue-900 font-bold text-base`}>
                          {panelCalc?.totalReceivedQty ?? 0}
                        </div>
                      </div>
                    </div>

                    {/* ROW B: Pricing — 8 equal columns, auto-resize with screen */}
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 pt-2 pb-2.5">
                      {/* Discount section header — shows tax type and discount base note */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-amber-600 font-medium">
                          All discounts independent — % on Basic CP · Rs fields = LINE TOTAL (copy directly from bill)
                          {taxType === 'TAX_INCLUSIVE' ? ' · TAX INCLUSIVE' : ' · TAX EXCLUSIVE'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Trade=Disc/Colgate/RAJ · Scheme=Sch/HUL/Nestle · Cash=CD/RS
                        </span>
                      </div>

                      {/* Labels row */}
                      <div className="grid grid-cols-8 gap-2 mb-1">
                        {[
                          { label: 'Basic CP ₹',      hint: 'Purchase rate per unit (from bill)' },
                          { label: 'Trade / Disc %',  hint: 'Colgate: Disc% · Hari Hara: Dis% · RAJ: combined disc%' },
                          { label: 'Trade Rs (LINE)',  hint: 'Total Trade/Disc Rs for this line — enter directly from bill (e.g. HUL RS Disc column). Divided by qty internally.' },
                          { label: 'Scheme / Sch %',  hint: 'HUL: Sch% · Nestle: 2nd disc% · Kashnar: Sch Disc%' },
                          { label: 'Scheme Rs (LINE)', hint: 'Total Scheme Rs for this line — enter directly from bill (e.g. Kashnar "Sch Disc" column). Divided by qty internally.' },
                          { label: 'Cash / CD %',     hint: 'Nestle: CD/RD/WSH% · HUL: RS Disc%' },
                          { label: 'Cash Rs (LINE)',   hint: 'Total Cash/CD Rs for this line — enter directly from bill (e.g. Kashnar "RS Disc" column). Divided by qty internally.' },
                          { label: 'Net Cost (Total)', hint: 'Net cost price per unit × accepted qty' },
                        ].map(({ label, hint }) => (
                          <label key={label} title={hint} className="text-[11px] font-bold text-amber-700 text-center uppercase tracking-wider cursor-help leading-tight">
                            {label}
                          </label>
                        ))}
                      </div>

                      {/* Inputs row */}
                      <div className="grid grid-cols-8 gap-2">
                        {/* Basic CP */}
                        <input type="number" min="0" step="0.01"
                          value={panelItem.basicCostPrice || ''}
                          onChange={(e) => updatePanel({ basicCostPrice: Number(e.target.value) || 0 })}
                          className={fi}
                          placeholder="0.00"
                        />

                        {/* Trade % */}
                        <input type="number" min="0" max="100" step="0.0001"
                          value={panelDiscCalc ? (r4(panelDiscCalc.tradePercent) || '') : ''}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setPairMaster((m) => ({ ...m, trade: 'pct' }));
                            updatePanel({ tradePercent: v });
                          }}
                          className={fi}
                          placeholder="0"
                        />
                        {/* Trade Rs — LINE TOTAL (what the bill shows) */}
                        <input type="number" min="0" step="0.01"
                          value={panelDiscCalc ? (panelDiscCalc.tradeLineRs || '') : ''}
                          onChange={(e) => {
                            const lineRs = Number(e.target.value) || 0;
                            const qty = (panelItem.casesReceived || 0) * (panelItem.packSize || 1) + (panelItem.looseQty || 0);
                            const bcp = panelItem.basicCostPrice;
                            if (qty > 0 && bcp > 0) {
                              const pct = r4(lineRs / (bcp * qty) * 100);
                              setPairMaster((m) => ({ ...m, trade: 'pct' }));
                              updatePanel({ tradePercent: pct, tradeRs: r6(bcp * pct / 100) });
                            } else {
                              // No qty yet — store as per-unit Rs
                              setPairMaster((m) => ({ ...m, trade: 'rs' }));
                              updatePanel({ tradeRs: lineRs });
                            }
                          }}
                          className={fi}
                          placeholder="0.00"
                        />

                        {/* Scheme % */}
                        <input type="number" min="0" max="100" step="0.0001"
                          value={panelDiscCalc ? (r4(panelDiscCalc.schemePercent) || '') : ''}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setPairMaster((m) => ({ ...m, scheme: 'pct' }));
                            updatePanel({ schemePercent: v });
                          }}
                          className={fi}
                          placeholder="0"
                        />
                        {/* Scheme Rs — LINE TOTAL */}
                        <input type="number" min="0" step="0.01"
                          value={panelDiscCalc ? (panelDiscCalc.schemeLineRs || '') : ''}
                          onChange={(e) => {
                            const lineRs = Number(e.target.value) || 0;
                            const qty = (panelItem.casesReceived || 0) * (panelItem.packSize || 1) + (panelItem.looseQty || 0);
                            const bcp = panelItem.basicCostPrice;
                            if (qty > 0 && bcp > 0) {
                              const pct = r4(lineRs / (bcp * qty) * 100);
                              setPairMaster((m) => ({ ...m, scheme: 'pct' }));
                              updatePanel({ schemePercent: pct, schemeRs: r6(bcp * pct / 100) });
                            } else {
                              setPairMaster((m) => ({ ...m, scheme: 'rs' }));
                              updatePanel({ schemeRs: lineRs });
                            }
                          }}
                          className={fi}
                          placeholder="0.00"
                        />

                        {/* Cash % */}
                        <input type="number" min="0" max="100" step="0.0001"
                          value={panelDiscCalc ? (r4(panelDiscCalc.cashPercent) || '') : ''}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setPairMaster((m) => ({ ...m, cash: 'pct' }));
                            updatePanel({ cashPercent: v });
                          }}
                          className={fi}
                          placeholder="0"
                        />
                        {/* Cash Rs — LINE TOTAL */}
                        <input type="number" min="0" step="0.01"
                          value={panelDiscCalc ? (panelDiscCalc.cashLineRs || '') : ''}
                          onChange={(e) => {
                            const lineRs = Number(e.target.value) || 0;
                            const qty = (panelItem.casesReceived || 0) * (panelItem.packSize || 1) + (panelItem.looseQty || 0);
                            const bcp = panelItem.basicCostPrice;
                            if (qty > 0 && bcp > 0) {
                              const pct = r4(lineRs / (bcp * qty) * 100);
                              setPairMaster((m) => ({ ...m, cash: 'pct' }));
                              updatePanel({ cashPercent: pct, cashRs: r6(bcp * pct / 100) });
                            } else {
                              setPairMaster((m) => ({ ...m, cash: 'rs' }));
                              updatePanel({ cashRs: lineRs });
                            }
                          }}
                          className={fi}
                          placeholder="0.00"
                        />

                        {/* Net Cost = unit price × qty received */}
                        <div className={`w-full px-2 py-2 text-right text-sm font-bold border-2 rounded-md ${panelDiscCalc?.discExceeds ? 'border-red-400 bg-red-50 text-red-700' : 'border-green-400 bg-green-50 text-green-700'}`}>
                          {panelDiscCalc
                            ? inr(panelDiscCalc.netCostPrice * (panelCalc?.totalReceivedQty ?? 0))
                            : '0.00'}
                          {(panelCalc?.totalReceivedQty ?? 0) > 0 && panelDiscCalc && (
                            <div className="text-[10px] font-normal opacity-70 leading-tight">
                              {inr(panelDiscCalc.netCostPrice)} × {panelCalc?.totalReceivedQty}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Per-unit cost breakdown — shown only when discounts are active */}
                      {panelDiscCalc && (panelCalc?.totalReceivedQty ?? 0) > 0 &&
                        (panelDiscCalc.tradeRs > 0 || panelDiscCalc.schemeRs > 0 || panelDiscCalc.cashRs > 0) && (
                        <div className="grid grid-cols-8 gap-2 mt-0.5">
                          <div />
                          <div className="col-span-2 text-center text-[10px] text-amber-500">
                            {panelDiscCalc.tradeRs > 0 && (
                              <span title="per-unit trade discount">₹{r4(panelDiscCalc.tradeRs)}/unit</span>
                            )}
                          </div>
                          <div className="col-span-2 text-center text-[10px] text-amber-500">
                            {panelDiscCalc.schemeRs > 0 && (
                              <span title="per-unit scheme discount">₹{r4(panelDiscCalc.schemeRs)}/unit</span>
                            )}
                          </div>
                          <div className="col-span-2 text-center text-[10px] text-amber-500">
                            {panelDiscCalc.cashRs > 0 && (
                              <span title="per-unit cash/CD discount">₹{r4(panelDiscCalc.cashRs)}/unit</span>
                            )}
                          </div>
                          <div />
                        </div>
                      )}

                      {panelDiscCalc?.discExceeds && (
                        <p className="text-[10px] text-red-500 mt-0.5">Discount exceeds cost price</p>
                      )}
                    </div>

                    {/* ROW C: Prices + Tax + Action Buttons (all in one row) */}
                    <div className="bg-green-50 border border-green-100 rounded-lg px-3 pt-2 pb-2.5">
                      {/* Labels row — 4 input labels + 2 button placeholders */}
                      <div className="flex gap-2 mb-1.5 items-end">
                        {['MRP ₹', 'Selling Price ₹', 'GST Rate', 'CESS %'].map((l) => (
                          <label key={l} className="flex-1 text-[11px] font-bold text-green-700 text-center uppercase tracking-wider">{l}</label>
                        ))}
                        <div className="shrink-0" style={{ width: '160px' }} />
                      </div>
                      {/* Inputs + Clear + Save — all on same row */}
                      <div className="flex gap-2 items-start">
                        {/* MRP */}
                        <input type="number" min="0" step="0.01"
                          value={panelItem.mrp || ''}
                          onChange={(e) => updatePanel({ mrp: Number(e.target.value) || 0 })}
                          className={`${fi} flex-1`}
                          placeholder="0.00"
                        />
                        {/* Selling Price */}
                        <input type="number" min="0" step="0.01"
                          value={panelItem.sellingPrice || ''}
                          onChange={(e) => updatePanel({ sellingPrice: Number(e.target.value) || 0 })}
                          className={`${fi} flex-1`}
                          placeholder="0.00"
                        />
                        {/* GST Rate */}
                        <div className="flex-1 flex flex-col gap-0.5">
                          <select
                            value={panelItem.gstRate}
                            onChange={(e) => updatePanel({ gstRate: Number(e.target.value) })}
                            className={`w-full px-2 py-2 text-sm font-semibold text-slate-800 bg-white rounded-md focus:outline-none focus:border-[#1B4F8A] ${
                              panelItem.gstRate !== panelItem.dbGstRate
                                ? 'border-2 border-amber-400 bg-amber-50'
                                : 'border border-slate-300'
                            }`}
                          >
                            {gstRates.map((rate) => (
                              <option key={rate} value={rate}>{rate}%</option>
                            ))}
                          </select>
                          {panelItem.gstRate !== panelItem.dbGstRate && (
                            <p className="text-[9px] text-amber-600 font-semibold leading-tight">
                              ⚠ DB: {panelItem.dbGstRate}%
                            </p>
                          )}
                        </div>
                        {/* CESS % */}
                        <input type="number" min="0" step="0.01"
                          value={panelItem.cessRate || ''}
                          onChange={(e) => updatePanel({ cessRate: Number(e.target.value) || 0 })}
                          className={`${fi} flex-1`}
                          placeholder="0"
                        />
                        {/* ── Action buttons — same row as fields ── */}
                        <button
                          onClick={clearPanel}
                          className="shrink-0 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-600 rounded-md hover:bg-gray-100 bg-white transition-colors"
                          title="Clear panel (Esc)"
                        >
                          ✕ Clear
                        </button>
                        <button
                          onClick={savePanel}
                          className="shrink-0 px-4 py-2 text-sm font-bold bg-[#1B4F8A] text-white rounded-md hover:bg-[#163f6e] transition-colors"
                          title="Save row (Ctrl+Enter)"
                        >
                          {editIdx >= 0 ? '✓ Update' : '✓ Save'}
                        </button>
                      </div>

                      {/* Below-margin inline guard */}
                      {marginInfo?.below && !marginInfo.allowed && (
                        <div className="mt-2 flex items-center justify-between gap-2 bg-amber-50 border border-amber-300 rounded-md px-3 py-1.5">
                          <span className="text-[11px] text-amber-800">
                            ⚠ Selling price below {MIN_MARGIN_PCT}% margin — minimum is <b>₹{marginInfo.minSp.toFixed(2)}</b>.
                          </span>
                          <button
                            onClick={allowBelowMarginForPanel}
                            disabled={marginFlagSaving}
                            className="shrink-0 text-[11px] font-semibold bg-amber-500 text-white px-2.5 py-1 rounded-md hover:bg-amber-600 disabled:opacity-50"
                          >
                            {marginFlagSaving ? 'Saving…' : 'Allow for this product'}
                          </button>
                        </div>
                      )}
                      {marginInfo?.below && marginInfo.allowed && (
                        <div className="mt-2 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
                          <span className="text-[11px] text-green-700">✓ Below-margin pricing allowed for this product.</span>
                        </div>
                      )}
                    </div>

                    {/* Batch details toggle */}
                    {!showBatch && (
                      <button
                        onClick={() => setShowBatch(true)}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-800 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-md transition-colors"
                      >
                        + Batch / Expiry Details
                      </button>
                    )}

                    {/* BATCH ROW */}
                    {showBatch && (
                      <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 pt-2 pb-2.5">
                        <div className="grid grid-cols-4 gap-2 mb-1.5">
                          {['Batch #', 'Expiry Date', 'Rejected Qty', 'Reason'].map((l) => (
                            <label key={l} className="text-[11px] font-bold text-purple-700 text-center uppercase tracking-wider">{l}</label>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <input
                            value={panelItem.batchNumber}
                            onChange={(e) => updatePanel({ batchNumber: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1B4F8A]"
                            placeholder="Batch #"
                          />
                          <input
                            type="date"
                            value={panelItem.expiryDate}
                            onChange={(e) => updatePanel({ expiryDate: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1B4F8A]"
                          />
                          <input type="number" min="0" step="1"
                            value={panelItem.rejectedQty || ''}
                            onChange={(e) => updatePanel({ rejectedQty: Number(e.target.value) || 0 })}
                            className={fi}
                            placeholder="0"
                          />
                          <input
                            value={panelItem.rejectionReason}
                            onChange={(e) => updatePanel({ rejectionReason: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1B4F8A]"
                            placeholder="Reason…"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 4: Grid + Summary ────────────────────────────────── */}
          <div className="flex overflow-hidden">

            {/* Items table */}
            <div ref={gridRef} className="flex-1 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-center text-gray-700 font-semibold uppercase tracking-wide w-9">#</th>
                    <th className="px-2 py-2 text-left text-gray-700 font-semibold uppercase tracking-wide">Product</th>
                    <th className="px-2 py-2 text-center text-gray-700 font-semibold uppercase tracking-wide w-16">Cases</th>
                    <th className="px-2 py-2 text-center text-gray-700 font-semibold uppercase tracking-wide w-16">Rcvd</th>
                    <th className="px-2 py-2 text-center text-gray-700 font-semibold uppercase tracking-wide w-14">Free</th>
                    <th className="px-2 py-2 text-right text-gray-700 font-semibold uppercase tracking-wide w-20">CP</th>
                    <th className="px-2 py-2 text-right text-gray-700 font-semibold uppercase tracking-wide w-20">Net</th>
                    <th className="px-2 py-2 text-right text-gray-700 font-semibold uppercase tracking-wide w-20">MRP</th>
                    <th className="px-2 py-2 text-right text-gray-700 font-semibold uppercase tracking-wide w-24">Total</th>
                    <th className="px-2 py-2 w-8" title="Click any row to edit that item"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="mx-8 border-2 border-dashed border-gray-200 rounded-xl py-10">
                          <p className="text-gray-400 text-sm">No items added yet.</p>
                          <p className="text-gray-300 text-xs mt-1">Search or scan product above to begin.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const c = calcs[idx];
                      const isFocused = gridFocusIdx === idx;
                      const isEditing = editIdx === idx;
                      return (
                        <tr
                          key={idx}
                          onClick={() => selectRow(idx)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors h-10 ${
                            isEditing
                              ? 'bg-blue-100 border-l-[3px] border-l-blue-500'
                              : isFocused
                              ? 'bg-blue-50'
                              : 'bg-white hover:bg-blue-50'
                          }`}
                        >
                          <td className="px-2 py-1.5 text-center text-gray-600">{idx + 1}</td>
                          <td className="px-2 py-1.5 min-w-0 max-w-0">
                            <p className="font-semibold text-gray-900 truncate flex items-center gap-1">
                              {it.productName}
                              {items.filter((x) => x.productId === it.productId).length > 1 && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 rounded px-1 shrink-0">
                                  MRP {it.mrp}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-600 truncate">{it.productCode || it.unitOfMeasure}</p>
                          </td>
                          <td className="px-2 py-1.5 text-center text-gray-900">{it.casesReceived || '—'}</td>
                          <td className="px-2 py-1.5 text-center font-bold text-gray-900">{c.totalReceivedQty || '—'}</td>
                          <td className="px-2 py-1.5 text-center text-gray-700">{(it.freeCases * it.packSize + it.freeLoose) || '—'}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-gray-900">{inr(it.basicCostPrice)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-gray-900">{inr(c.netCostPrice)}</td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{inr(it.mrp)}</td>
                          <td className="px-2 py-1.5 text-right font-bold text-blue-700">Rs.{inr(c.lineTotal)}</td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); removeRow(idx); }}
                              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {items.length > 0 && editIdx < 0 && (
              <p className="text-center text-[11px] text-blue-500 py-1.5 bg-blue-50 border-t border-blue-100">
                ✏️ Click any row above to edit that item
              </p>
            )}

            {/* Totals panel */}
            <div className="w-56 border-l border-gray-200 bg-gray-50 overflow-y-auto flex-shrink-0">
              <div className="p-3 space-y-1.5 text-xs">
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Summary</p>

                <div className="flex justify-between text-gray-800">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900">Rs.{inr(totals.itemsTotal)}</span>
                </div>
                {totals.billDiscAmt > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Bill Discount</span>
                    <span>- Rs.{inr(totals.billDiscAmt)}</span>
                  </div>
                )}
                {totals.billCashDiscAmt > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Cash Discount</span>
                    <span>- Rs.{inr(totals.billCashDiscAmt)}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-1.5 space-y-1">
                  <div className="flex justify-between text-gray-800">
                    <span>Taxable</span>
                    <span className="font-semibold text-gray-900">Rs.{inr(totals.taxableTotal)}</span>
                  </div>
                  {isInterState ? (
                    <div className="flex justify-between text-gray-700">
                      <span>IGST</span>
                      <span className="font-semibold text-gray-900">Rs.{inr(totals.igstTotal)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-gray-700">
                        <span>CGST</span>
                        <span className="font-semibold text-gray-900">Rs.{inr(totals.cgstTotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>SGST</span>
                        <span className="font-semibold text-gray-900">Rs.{inr(totals.sgstTotal)}</span>
                      </div>
                    </>
                  )}
                  {totals.cessTotal > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>CESS</span>
                      <span>Rs.{inr(totals.cessTotal)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-1.5 space-y-1.5">
                  {/* Freight */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700 flex-1 text-xs">Freight</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={adj.freightCharges || ''}
                      onChange={(e) => setAdj((a) => ({ ...a, freightCharges: Number(e.target.value) || 0 }))}
                      className="w-16 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[#1B4F8A]"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Hamali */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700 flex-1 text-xs">Hamali</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={adj.hamaliCharges || ''}
                      onChange={(e) => setAdj((a) => ({ ...a, hamaliCharges: Number(e.target.value) || 0 }))}
                      className="w-16 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[#1B4F8A]"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Other */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700 flex-1 text-xs">Other</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={adj.otherCharges || ''}
                      onChange={(e) => setAdj((a) => ({ ...a, otherCharges: Number(e.target.value) || 0 }))}
                      className="w-16 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[#1B4F8A]"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Rounding — auto-calculated, user-editable */}
                  <div className="flex items-center gap-1">
                    <span className={`flex-1 text-xs ${adj.roundingAmount > 0 ? 'text-orange-600' : adj.roundingAmount < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                      {adj.roundingAmount > 0 ? 'Rounding (+)' : adj.roundingAmount < 0 ? 'Rounding (-)' : 'Rounding'}
                    </span>
                    <input
                      type="number" step="0.01" min="-10" max="10"
                      value={adj.roundingAmount !== 0 ? adj.roundingAmount : ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAdj((a) => ({ ...a, roundingAmount: val }));
                      }}
                      className="w-16 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[#1B4F8A]"
                      placeholder="auto"
                    />
                  </div>

                  <button onClick={spreadCharges} className="text-[10px] text-blue-600 hover:underline">
                    SPREAD hamali+freight across items
                  </button>

                  {/* Bill Disc% */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700 flex-1 text-xs">Bill Disc%</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={adj.billDiscountPercent || ''}
                      onChange={(e) => setAdj((a) => ({ ...a, billDiscountPercent: Number(e.target.value) || 0 }))}
                      className="w-16 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[#1B4F8A]"
                      placeholder="0"
                    />
                  </div>

                  {/* Cash Discount (bill level) — linked pair */}
                  <div className="border-t border-gray-100 pt-1">
                    <p className="text-[10px] text-gray-600 font-semibold mb-1">Cash Discount (Bill)</p>
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-gray-700 flex-1 text-xs">Cash%</span>
                      <input
                        type="number" min="0" step="0.0001"
                        value={adj.billCashDiscPercent || ''}
                        onChange={(e) => {
                          const pct = Number(e.target.value) || 0;
                          const rs = r2(totals.preGrand * pct / 100);
                          setAdj((a) => ({ ...a, billCashDiscPercent: pct, billCashDiscRs: rs }));
                        }}
                        className="w-16 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[#1B4F8A]"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-700 flex-1 text-xs">Cash Rs</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={adj.billCashDiscRs || ''}
                        onChange={(e) => {
                          const rs = Number(e.target.value) || 0;
                          const pct = totals.preGrand > 0 ? r4(rs / totals.preGrand * 100) : 0;
                          setAdj((a) => ({ ...a, billCashDiscRs: rs, billCashDiscPercent: pct }));
                        }}
                        className="w-16 text-right text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-[#1B4F8A]"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between font-bold text-gray-900 text-xl">
                    <span>Grand Total</span>
                    <span className="text-blue-700">Rs.{inr(totals.grandTotal)}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-1.5 space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span>Invoice Total</span>
                    <span className="font-semibold text-gray-900">Rs.{inr(invoiceControlTotal)}</span>
                  </div>
                  {tolerance && (
                    <div className={`flex justify-between font-medium ${
                      tolerance.color === 'green'  ? 'text-green-600'  :
                      tolerance.color === 'amber'  ? 'text-amber-600'  :
                      tolerance.color === 'orange' ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      <span>Difference</span>
                      <span>{tolerance.msg}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* ── SECTION 5: Action buttons ─────────────────────────────────── */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              {/* For APPROVED/PENDING edits: single "Save Changes" button */}
              {editGrnStatus && editGrnStatus !== 'DRAFT' ? (
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {saving ? 'Submitting…' : 'Submit for Approval'}
                  </button>
                </>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {items.length} item{items.length !== 1 ? 's' : ''} · Grand Total: <span className="font-semibold text-gray-700">Rs.{inr(totals.grandTotal)}</span>
            </span>
          </div>

        </div>
      )}

      {/* ── Add New PLU modal (from GRN) ── */}
      {showAddPluModal && panelItem.productId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Create New PLU</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{panelItem.productName}</p>
              </div>
              <button onClick={() => setShowAddPluModal(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              New pack size / price point for this product. After saving, the GRN panel will use these prices.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">MRP (₹) *</label>
                <input autoFocus type="number" value={addPluForm.mrp}
                  onChange={e => setAddPluForm(f => ({ ...f, mrp: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" placeholder="0.00" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Selling Price (₹) *</label>
                <input type="number" value={addPluForm.sellingPrice}
                  onChange={e => setAddPluForm(f => ({ ...f, sellingPrice: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" placeholder="0.00" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">GST Rate %</label>
                <select value={addPluForm.gstRate}
                  onChange={e => setAddPluForm(f => ({ ...f, gstRate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]">
                  <option value="">— select —</option>
                  {gstRates.map(r => <option key={r} value={String(r)}>{r}%</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Pack Label</label>
                <input value={addPluForm.packLabel}
                  onChange={e => setAddPluForm(f => ({ ...f, packLabel: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" placeholder="e.g. 5L, 1 Kg" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleAddPluFromGrn} disabled={addPluSaving}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] hover:bg-[#163f6e] disabled:opacity-60 text-white rounded-xl font-semibold transition-colors">
                {addPluSaving ? 'Creating…' : 'Create & Use PLU'}
              </button>
              <button onClick={() => setShowAddPluModal(false)}
                className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

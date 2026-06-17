'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import {
  AlertTriangle, Plus, Trash2, X, Check, Upload,
  ChevronDown, Info, History,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Constants ───────────────────────────────────────────────────────────────

const FY_START      = new Date('2026-04-01');
const GST_RATES     = [0, 5, 12, 18, 28];
const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];

// ─── Types ───────────────────────────────────────────────────────────────────

interface B2CRow {
  id: string;
  gstRate: number;
  taxable: string;
  cgst: string;
  sgst: string;
}

interface B2CDayEntry {
  date: string;
  rows: B2CRow[];
}

interface HistoricalBill {
  id: string;
  billNumber: string;
  billDate: string;
  isB2B: boolean;
  customerName: string | null;
  customerGstin: string | null;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  notes: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const r2  = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const uid = () => Math.random().toString(36).slice(2, 9);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDisplay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function validateGstin(gstin: string): string | null {
  if (!gstin) return 'GSTIN required';
  if (gstin.length !== 15) return 'GSTIN must be 15 characters';
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
    return 'Invalid GSTIN format';
  }
  return null;
}

function gstinStateCode(gstin: string): string {
  return gstin.length >= 2 ? gstin.substring(0, 2) : '';
}

const STATE_CODES: Record<string, string> = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
  '25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra','28':'Andhra Pradesh (old)',
  '29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu',
  '34':'Puducherry','35':'Andaman & Nicobar','36':'Telangana','37':'Andhra Pradesh',
};

// ─── B2C Row component ────────────────────────────────────────────────────────

function B2CRowInput({
  row, onChange, onRemove, showRemove,
}: {
  row: B2CRow;
  onChange: (r: B2CRow) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const taxable = parseFloat(row.taxable) || 0;
  const autoCgst = r2(taxable * row.gstRate / 200);
  const autoSgst = autoCgst;
  const cgst     = parseFloat(row.cgst) || autoCgst;
  const sgst     = parseFloat(row.sgst) || autoSgst;
  const total    = r2(taxable + cgst + sgst);

  function handleTaxable(val: string) {
    const t = parseFloat(val) || 0;
    onChange({
      ...row,
      taxable: val,
      cgst: String(r2(t * row.gstRate / 200)),
      sgst: String(r2(t * row.gstRate / 200)),
    });
  }

  function handleRateChange(rate: number) {
    const t = parseFloat(row.taxable) || 0;
    onChange({
      ...row,
      gstRate: rate,
      cgst: String(r2(t * rate / 200)),
      sgst: String(r2(t * rate / 200)),
    });
  }

  return (
    <div className="grid grid-cols-[120px_1fr_100px_100px_100px_36px] gap-2 items-center">
      <select
        value={row.gstRate}
        onChange={(e) => handleRateChange(Number(e.target.value))}
        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
      >
        {GST_RATES.map((r) => (
          <option key={r} value={r}>{r}%</option>
        ))}
      </select>
      <input
        type="number"
        value={row.taxable}
        onChange={(e) => handleTaxable(e.target.value)}
        placeholder="Taxable amount"
        min={0}
        step="0.01"
        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
      />
      <input
        type="number"
        value={row.cgst}
        onChange={(e) => onChange({ ...row, cgst: e.target.value })}
        placeholder="CGST"
        min={0}
        step="0.01"
        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-blue-50"
      />
      <input
        type="number"
        value={row.sgst}
        onChange={(e) => onChange({ ...row, sgst: e.target.value })}
        placeholder="SGST"
        min={0}
        step="0.01"
        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-blue-50"
      />
      <div className="text-right text-sm font-medium text-gray-700 pr-1">
        Rs.{fmt(total)}
      </div>
      {showRemove ? (
        <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      ) : <div />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoricalBillsPage() {
  const [tab, setTab] = useState<'b2c' | 'b2b'>('b2c');

  // ── B2C state ────────────────────────────────────────
  const [b2cDays, setB2cDays] = useState<B2CDayEntry[]>([{
    date: todayIso(),
    rows: [{ id: uid(), gstRate: 5, taxable: '', cgst: '', sgst: '' }],
  }]);
  const [savingB2C, setSavingB2C] = useState(false);

  // ── B2B state ────────────────────────────────────────
  const [b2bForm, setB2bForm] = useState({
    billDate:      todayIso(),
    invoiceNumber: '',
    customerName:  '',
    customerGstin: '',
    gstRate:       18,
    taxable:       '',
    cgst:          '',
    sgst:          '',
    igst:          '',
    paymentMode:   'CASH',
  });
  const [gstinError, setGstinError] = useState('');
  const [savingB2B, setSavingB2B] = useState(false);
  const [isInterState, setIsInterState] = useState(false);

  // ── History state ─────────────────────────────────────
  const [history, setHistory] = useState<HistoricalBill[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histTotal, setHistTotal]     = useState(0);

  // ── CSV import state ─────────────────────────────────
  const [csvPreview, setCsvPreview]       = useState<any[] | null>(null);
  const [csvImporting, setCsvImporting]   = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(() => setCsvPreview(null), !!csvPreview);

  // ── Load history ──────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await api.get('/pos/historical-bills', {
        params: { type: tab === 'b2c' ? 'B2C' : 'B2B', limit: 50 },
      });
      setHistory(res.data.data ?? []);
      setHistTotal(res.data.meta?.total ?? 0);
    } catch { /* silent */ }
    finally { setHistLoading(false); }
  }, [tab]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Business state code (for B2B interstate detection) ─
  const [bizStateCode, setBizStateCode] = useState('36');
  useEffect(() => {
    api.get('/auth/me').then((r) => {
      setBizStateCode(r.data?.business?.stateCode ?? '36');
    }).catch(() => {});
  }, []);

  // ── B2B GSTIN change ─────────────────────────────────
  function handleGstinChange(gstin: string) {
    const upper = gstin.toUpperCase().replace(/\s/g, '');
    setB2bForm((f) => ({ ...f, customerGstin: upper }));
    setGstinError('');

    if (upper.length >= 2) {
      const custState = gstinStateCode(upper);
      const inter     = custState !== bizStateCode;
      setIsInterState(inter);
      if (upper.length === 15) {
        const err = validateGstin(upper);
        if (err) setGstinError(err);
      }
    }
  }

  // ── B2B GST auto-calc ─────────────────────────────────
  function recalcB2BTax(taxable: number, rate: number, inter: boolean) {
    if (inter) {
      setB2bForm((f) => ({
        ...f,
        cgst: '0',
        sgst: '0',
        igst: String(r2(taxable * rate / 100)),
      }));
    } else {
      const half = r2(taxable * rate / 200);
      setB2bForm((f) => ({ ...f, cgst: String(half), sgst: String(half), igst: '0' }));
    }
  }

  function handleB2BTaxableChange(val: string) {
    setB2bForm((f) => ({ ...f, taxable: val }));
    const t = parseFloat(val) || 0;
    recalcB2BTax(t, b2bForm.gstRate, isInterState);
  }

  function handleB2BRateChange(rate: number) {
    setB2bForm((f) => ({ ...f, gstRate: rate }));
    const t = parseFloat(b2bForm.taxable) || 0;
    recalcB2BTax(t, rate, isInterState);
  }

  // ── Validation helpers ───────────────────────────────
  function validateDate(dateStr: string): string | null {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Invalid date';
    const today = new Date(); today.setHours(23, 59, 59, 999);
    if (d > today)       return 'Cannot enter future date';
    if (d < FY_START)    return 'Cannot enter bills before April 1, 2026';
    return null;
  }

  // ── B2C Day management ───────────────────────────────
  function addDay() {
    setB2cDays((prev) => [
      ...prev,
      { date: todayIso(), rows: [{ id: uid(), gstRate: 5, taxable: '', cgst: '', sgst: '' }] },
    ]);
  }

  function removeDay(di: number) {
    setB2cDays((prev) => prev.filter((_, i) => i !== di));
  }

  function addRow(di: number) {
    setB2cDays((prev) => prev.map((d, i) =>
      i === di ? { ...d, rows: [...d.rows, { id: uid(), gstRate: 5, taxable: '', cgst: '', sgst: '' }] } : d,
    ));
  }

  function removeRow(di: number, rowId: string) {
    setB2cDays((prev) => prev.map((d, i) =>
      i === di ? { ...d, rows: d.rows.filter((r) => r.id !== rowId) } : d,
    ));
  }

  function updateRow(di: number, row: B2CRow) {
    setB2cDays((prev) => prev.map((d, i) =>
      i === di ? { ...d, rows: d.rows.map((r) => r.id === row.id ? row : r) } : d,
    ));
  }

  // ── Save B2C ─────────────────────────────────────────
  async function saveB2C() {
    const bills: any[] = [];
    for (const day of b2cDays) {
      const dateErr = validateDate(day.date);
      if (dateErr) { toast.error(`${isoToDisplay(day.date)}: ${dateErr}`); return; }
      for (const row of day.rows) {
        const t = parseFloat(row.taxable);
        if (!t || t <= 0) { toast.error('Each row needs a positive taxable amount'); return; }
        bills.push({
          type:          'B2C_SUMMARY',
          billDate:      day.date,
          gstRate:       row.gstRate,
          taxableAmount: t,
          cgstAmount:    parseFloat(row.cgst) || r2(t * row.gstRate / 200),
          sgstAmount:    parseFloat(row.sgst) || r2(t * row.gstRate / 200),
        });
      }
    }
    if (!bills.length) { toast.error('Nothing to save'); return; }

    setSavingB2C(true);
    try {
      const res = await api.post('/pos/historical-bills-bulk', { bills });
      const { created, errors } = res.data;
      if (errors.length > 0) {
        toast.error(`${created} saved, ${errors.length} failed: ${errors[0]?.message}`);
      } else {
        toast.success(`${created} bill${created !== 1 ? 's' : ''} saved`);
        setB2cDays([{ date: todayIso(), rows: [{ id: uid(), gstRate: 5, taxable: '', cgst: '', sgst: '' }] }]);
        loadHistory();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSavingB2C(false);
    }
  }

  // ── Save B2B ─────────────────────────────────────────
  async function saveB2B() {
    const dateErr = validateDate(b2bForm.billDate);
    if (dateErr)                           { toast.error(dateErr); return; }
    if (!b2bForm.invoiceNumber.trim())     { toast.error('Invoice number required'); return; }
    if (!b2bForm.customerName.trim())      { toast.error('Customer name required'); return; }
    const gstinErr = validateGstin(b2bForm.customerGstin);
    if (gstinErr)                          { toast.error(gstinErr); return; }
    const t = parseFloat(b2bForm.taxable);
    if (!t || t <= 0)                      { toast.error('Taxable amount required'); return; }

    setSavingB2B(true);
    try {
      await api.post('/pos/historical-bill', {
        type:          'B2B_INDIVIDUAL',
        billDate:      b2bForm.billDate,
        invoiceNumber: b2bForm.invoiceNumber.trim(),
        customerName:  b2bForm.customerName.trim(),
        customerGstin: b2bForm.customerGstin,
        gstRate:       b2bForm.gstRate,
        taxableAmount: t,
        cgstAmount:    parseFloat(b2bForm.cgst) || 0,
        sgstAmount:    parseFloat(b2bForm.sgst) || 0,
        igstAmount:    parseFloat(b2bForm.igst) || 0,
      });
      toast.success('B2B bill saved');
      setB2bForm({
        billDate: todayIso(), invoiceNumber: '', customerName: '', customerGstin: '',
        gstRate: 18, taxable: '', cgst: '', sgst: '', igst: '', paymentMode: 'CASH',
      });
      setGstinError('');
      setIsInterState(false);
      loadHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSavingB2B(false);
    }
  }

  // ── Delete historical bill ────────────────────────────
  async function deleteBill(id: string) {
    if (!confirm('Delete this historical bill? This cannot be undone.')) return;
    try {
      await api.delete(`/pos/historical-bills/${id}`);
      toast.success('Deleted');
      loadHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    }
  }

  // ── CSV Import ───────────────────────────────────────
  function parseB2CCSV(text: string): any[] {
    const lines  = text.trim().split('\n');
    const header = lines[0].toLowerCase().replace(/\s/g, '');
    if (!header.includes('date')) throw new Error('CSV must have Date column');
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 3) continue;
      const [date, gstRate, taxable, gstAmount] = cols;
      if (!date || !taxable) continue;
      const t = parseFloat(taxable);
      const r = parseFloat(gstRate) || 0;
      const g = parseFloat(gstAmount) || r2(t * r / 100);
      rows.push({
        type: 'B2C_SUMMARY',
        billDate:      new Date(date).toISOString().slice(0, 10),
        gstRate:       r,
        taxableAmount: t,
        cgstAmount:    r2(g / 2),
        sgstAmount:    r2(g / 2),
      });
    }
    return rows;
  }

  function parseB2BCSV(text: string): any[] {
    const lines = text.trim().split('\n');
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 7) continue;
      const [date, invoiceNo, customerName, gstin, taxable, gstRate, gstAmount] = cols;
      if (!date || !invoiceNo || !gstin) continue;
      const t = parseFloat(taxable);
      const r = parseFloat(gstRate) || 18;
      const g = parseFloat(gstAmount) || r2(t * r / 100);
      const custState = gstin.substring(0, 2);
      const inter     = custState !== bizStateCode;
      rows.push({
        type: 'B2B_INDIVIDUAL',
        billDate:      new Date(date).toISOString().slice(0, 10),
        invoiceNumber: invoiceNo,
        customerName,
        customerGstin: gstin,
        gstRate:       r,
        taxableAmount: t,
        cgstAmount:    inter ? 0 : r2(g / 2),
        sgstAmount:    inter ? 0 : r2(g / 2),
        igstAmount:    inter ? g : 0,
      });
    }
    return rows;
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text  = ev.target?.result as string;
        const rows  = tab === 'b2c' ? parseB2CCSV(text) : parseB2BCSV(text);
        if (rows.length === 0) { toast.error('No valid rows found in CSV'); return; }
        setCsvPreview(rows);
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function confirmCSVImport() {
    if (!csvPreview?.length) return;
    setCsvImporting(true);
    try {
      const res = await api.post('/pos/historical-bills-bulk', { bills: csvPreview });
      const { created, errors } = res.data;
      if (errors.length > 0) {
        toast.error(`${created} saved, ${errors.length} failed`);
      } else {
        toast.success(`${created} bills imported`);
      }
      setCsvPreview(null);
      loadHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Import failed');
    } finally {
      setCsvImporting(false);
    }
  }

  // ── Computed totals for B2C form ──────────────────────
  const b2cTotals = b2cDays.reduce((acc, day) => {
    for (const row of day.rows) {
      const t = parseFloat(row.taxable) || 0;
      const c = parseFloat(row.cgst)    || r2(t * row.gstRate / 200);
      const s = parseFloat(row.sgst)    || r2(t * row.gstRate / 200);
      acc.taxable += t;
      acc.gst     += c + s;
    }
    return acc;
  }, { taxable: 0, gst: 0 });

  const b2bTaxable = parseFloat(b2bForm.taxable) || 0;
  const b2bCgst    = parseFloat(b2bForm.cgst)    || 0;
  const b2bSgst    = parseFloat(b2bForm.sgst)    || 0;
  const b2bIgst    = parseFloat(b2bForm.igst)    || 0;
  const b2bTotal   = r2(b2bTaxable + b2bCgst + b2bSgst + b2bIgst);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Header title="Historical Bills Entry" />
      <main className="flex-1 p-6 space-y-4 max-w-5xl">

        {/* Warning banner */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">For GST filing records only</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Stock levels will NOT be affected. Enter bills from before system go-live date (April 1, 2026 onwards, up to today).
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(['b2c', 'b2b'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-white text-[#1B4F8A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'b2c' ? 'B2C Daily Summary' : 'B2B Individual Bills'}
            </button>
          ))}
        </div>

        {/* ─── B2C TAB ─────────────────────────────────────── */}
        {tab === 'b2c' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Daily Sales Entry</h2>
                <div className="flex gap-2">
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCSVFile}
                  />
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Import CSV
                  </button>
                </div>
              </div>

              {/* CSV format hint */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  CSV format: <code className="bg-blue-100 px-1 rounded">Date, GST_Rate, Taxable_Amount, GST_Amount</code>
                  &nbsp;— e.g. <code className="bg-blue-100 px-1 rounded">2026-04-01, 5, 10000, 500</code>
                </p>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[120px_1fr_100px_100px_100px_36px] gap-2 text-xs font-medium text-gray-500 px-0.5">
                <span>GST Rate</span>
                <span>Taxable Amount (Rs.)</span>
                <span>CGST (Rs.)</span>
                <span>SGST (Rs.)</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {b2cDays.map((day, di) => {
                const dayTaxable = day.rows.reduce((s, r) => s + (parseFloat(r.taxable) || 0), 0);
                const dayGst     = day.rows.reduce((s, r) => {
                  const t = parseFloat(r.taxable) || 0;
                  const c = parseFloat(r.cgst)    || r2(t * r.gstRate / 200);
                  const sg = parseFloat(r.sgst)   || r2(t * r.gstRate / 200);
                  return s + c + sg;
                }, 0);

                return (
                  <div key={di} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                    {/* Date row */}
                    <div className="flex items-center gap-3">
                      <div className="space-y-1 flex-1 max-w-[200px]">
                        <label className="text-xs font-medium text-gray-600">Bill Date</label>
                        <input
                          type="date"
                          value={day.date}
                          max={todayIso()}
                          min="2026-04-01"
                          onChange={(e) => setB2cDays((prev) => prev.map((d, i) => i === di ? { ...d, date: e.target.value } : d))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                        />
                      </div>
                      <div className="ml-auto flex items-center gap-3 pt-5">
                        <span className="text-xs text-gray-500">
                          Day total: <span className="font-semibold text-gray-700">Rs.{fmt(r2(dayTaxable + dayGst))}</span>
                          <span className="text-gray-400 ml-1">(GST Rs.{fmt(r2(dayGst))})</span>
                        </span>
                        {b2cDays.length > 1 && (
                          <button onClick={() => removeDay(di)} className="text-xs text-red-500 hover:text-red-700">
                            Remove Day
                          </button>
                        )}
                      </div>
                    </div>

                    {/* GST rate rows */}
                    <div className="space-y-2">
                      {day.rows.map((row) => (
                        <B2CRowInput
                          key={row.id}
                          row={row}
                          onChange={(r) => updateRow(di, r)}
                          onRemove={() => removeRow(di, row.id)}
                          showRemove={day.rows.length > 1}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => addRow(di)}
                      className="flex items-center gap-1 text-xs text-[#1B4F8A] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add GST Rate
                    </button>
                  </div>
                );
              })}

              <button
                onClick={addDay}
                className="flex items-center gap-1.5 text-sm text-[#1B4F8A] hover:underline font-medium"
              >
                <Plus className="w-4 h-4" /> Add Another Day
              </button>

              {/* Footer totals */}
              <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Total Sales: <span className="font-bold text-gray-800">Rs.{fmt(r2(b2cTotals.taxable + b2cTotals.gst))}</span>
                  <span className="text-gray-400 ml-2">Taxable Rs.{fmt(r2(b2cTotals.taxable))} + GST Rs.{fmt(r2(b2cTotals.gst))}</span>
                </div>
                <button
                  onClick={saveB2C}
                  disabled={savingB2C}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {savingB2C ? 'Saving...' : 'Save Day Summary'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── B2B TAB ─────────────────────────────────────── */}
        {tab === 'b2b' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">B2B Invoice Entry</h2>
              <div className="flex gap-2">
                <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
                <button
                  onClick={() => csvInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Import CSV
                </button>
              </div>
            </div>

            {/* CSV format hint */}
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                CSV format: <code className="bg-blue-100 px-1 rounded">Date, Invoice_No, Customer_Name, GSTIN, Taxable, GST_Rate, GST_Amount, Total</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Bill Date *</label>
                <input
                  type="date"
                  value={b2bForm.billDate}
                  max={todayIso()}
                  min="2026-04-01"
                  onChange={(e) => setB2bForm((f) => ({ ...f, billDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Original Invoice Number *</label>
                <input
                  value={b2bForm.invoiceNumber}
                  onChange={(e) => setB2bForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  placeholder="e.g. INV/2026/001"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Customer Name *</label>
                <input
                  value={b2bForm.customerName}
                  onChange={(e) => setB2bForm((f) => ({ ...f, customerName: e.target.value }))}
                  placeholder="Company or person name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Customer GSTIN *</label>
                <input
                  value={b2bForm.customerGstin}
                  onChange={(e) => handleGstinChange(e.target.value)}
                  placeholder="e.g. 36AABCC1234D1Z5"
                  maxLength={15}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none font-mono ${gstinError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-[#1B4F8A]'}`}
                />
                {gstinError && <p className="text-xs text-red-500">{gstinError}</p>}
                {b2bForm.customerGstin.length >= 2 && !gstinError && (
                  <p className="text-xs text-gray-500">
                    State: {STATE_CODES[gstinStateCode(b2bForm.customerGstin)] ?? gstinStateCode(b2bForm.customerGstin)}
                    &nbsp;·&nbsp;
                    <span className={isInterState ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>
                      {isInterState ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">GST Breakdown</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">GST Rate</label>
                  <select
                    value={b2bForm.gstRate}
                    onChange={(e) => handleB2BRateChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  >
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Taxable Amount (Rs.) *</label>
                  <input
                    type="number"
                    value={b2bForm.taxable}
                    onChange={(e) => handleB2BTaxableChange(e.target.value)}
                    min={0}
                    step="0.01"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  />
                </div>
                {!isInterState ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">CGST (Rs.)</label>
                      <input
                        type="number"
                        value={b2bForm.cgst}
                        onChange={(e) => setB2bForm((f) => ({ ...f, cgst: e.target.value }))}
                        min={0}
                        step="0.01"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-blue-50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">SGST (Rs.)</label>
                      <input
                        type="number"
                        value={b2bForm.sgst}
                        onChange={(e) => setB2bForm((f) => ({ ...f, sgst: e.target.value }))}
                        min={0}
                        step="0.01"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-blue-50"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-gray-600">IGST (Rs.)</label>
                    <input
                      type="number"
                      value={b2bForm.igst}
                      onChange={(e) => setB2bForm((f) => ({ ...f, igst: e.target.value }))}
                      min={0}
                      step="0.01"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-amber-50"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Grand Total: <span className="font-bold text-gray-800 text-base">Rs.{fmt(b2bTotal)}</span>
                {b2bTaxable > 0 && (
                  <span className="text-gray-400 ml-2">
                    Taxable Rs.{fmt(b2bTaxable)} + Tax Rs.{fmt(r2(b2bCgst + b2bSgst + b2bIgst))}
                  </span>
                )}
              </div>
              <button
                onClick={saveB2B}
                disabled={savingB2B}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 transition-colors"
              >
                <Check className="w-4 h-4" />
                {savingB2B ? 'Saving...' : 'Save B2B Bill'}
              </button>
            </div>
          </div>
        )}

        {/* ─── CSV PREVIEW MODAL ─────────────────────────── */}
        {csvPreview && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCsvPreview(null)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-800">CSV Preview — {csvPreview.length} rows</h3>
                <button onClick={() => setCsvPreview(null)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      {tab === 'b2c' ? (
                        <>
                          <th className="text-left px-2 py-1.5">Date</th>
                          <th className="text-right px-2 py-1.5">GST %</th>
                          <th className="text-right px-2 py-1.5">Taxable</th>
                          <th className="text-right px-2 py-1.5">CGST</th>
                          <th className="text-right px-2 py-1.5">SGST</th>
                        </>
                      ) : (
                        <>
                          <th className="text-left px-2 py-1.5">Date</th>
                          <th className="text-left px-2 py-1.5">Invoice#</th>
                          <th className="text-left px-2 py-1.5">Customer</th>
                          <th className="text-right px-2 py-1.5">Taxable</th>
                          <th className="text-right px-2 py-1.5">Tax</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {tab === 'b2c' ? (
                          <>
                            <td className="px-2 py-1">{row.billDate}</td>
                            <td className="px-2 py-1 text-right">{row.gstRate}%</td>
                            <td className="px-2 py-1 text-right">Rs.{fmt(row.taxableAmount)}</td>
                            <td className="px-2 py-1 text-right">Rs.{fmt(row.cgstAmount)}</td>
                            <td className="px-2 py-1 text-right">Rs.{fmt(row.sgstAmount)}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-1">{row.billDate}</td>
                            <td className="px-2 py-1">{row.invoiceNumber}</td>
                            <td className="px-2 py-1">{row.customerName}</td>
                            <td className="px-2 py-1 text-right">Rs.{fmt(row.taxableAmount)}</td>
                            <td className="px-2 py-1 text-right">Rs.{fmt(r2((row.cgstAmount || 0) + (row.sgstAmount || 0) + (row.igstAmount || 0)))}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
                <button
                  onClick={() => setCsvPreview(null)}
                  className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCSVImport}
                  disabled={csvImporting}
                  className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {csvImporting ? 'Importing...' : `Import ${csvPreview.length} rows`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── HISTORY ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">
                {tab === 'b2c' ? 'B2C' : 'B2B'} Historical Bills
              </span>
              {histTotal > 0 && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{histTotal}</span>
              )}
            </div>
          </div>

          {histLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No historical bills entered yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Bill #</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  {tab === 'b2b' && <th className="text-left px-4 py-2.5">Customer / GSTIN</th>}
                  <th className="text-right px-4 py-2.5">Taxable</th>
                  <th className="text-right px-4 py-2.5">GST</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((b) => {
                  const gst = r2(b.cgstTotal + b.sgstTotal + b.igstTotal);
                  let gstRateParsed: number | null = null;
                  try { const n = JSON.parse(b.notes ?? '{}'); gstRateParsed = n.gstRate ?? null; } catch { /* skip */ }
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{b.billNumber}</td>
                      <td className="px-4 py-2.5 text-gray-600">{isoToDisplay(b.billDate)}</td>
                      {tab === 'b2b' && (
                        <td className="px-4 py-2.5">
                          <p className="text-gray-800 font-medium">{b.customerName}</p>
                          <p className="text-xs text-gray-400 font-mono">{b.customerGstin}</p>
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right text-gray-700">Rs.{fmt(b.taxableAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">
                        Rs.{fmt(gst)}
                        {gstRateParsed !== null && (
                          <span className="ml-1 text-xs text-gray-400">@{gstRateParsed}%</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">Rs.{fmt(b.grandTotal)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => deleteBill(b.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {history.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200 text-xs font-medium text-gray-600">
                  <tr>
                    <td colSpan={tab === 'b2b' ? 3 : 2} className="px-4 py-2.5">Total ({history.length} bills)</td>
                    <td className="px-4 py-2.5 text-right">
                      Rs.{fmt(r2(history.reduce((s, b) => s + b.taxableAmount, 0)))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      Rs.{fmt(r2(history.reduce((s, b) => s + b.cgstTotal + b.sgstTotal + b.igstTotal, 0)))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#1B4F8A]">
                      Rs.{fmt(r2(history.reduce((s, b) => s + b.grandTotal, 0)))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </main>
    </>
  );
}

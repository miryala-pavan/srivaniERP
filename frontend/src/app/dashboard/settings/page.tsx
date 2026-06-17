'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Settings, Receipt, Save, RefreshCw, CheckCircle2, Keyboard, AlertCircle, Store, Clock, FileText, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingSettings {
  defaultBillType: string;
  estimateValidityDays: string;
  autoB2BOnGstin: string;
  defaultPrintFormat: string;
  showGstBreakupOnRetail: string;
}

type ShortcutMap = Record<string, string>;

const DEFAULT_BILLING: BillingSettings = {
  defaultBillType: 'TAX_INVOICE',
  estimateValidityDays: '3',
  autoB2BOnGstin: 'true',
  defaultPrintFormat: 'THERMAL',
  showGstBreakupOnRetail: 'true',
};

const DEFAULT_SHORTCUTS: ShortcutMap = {
  cash:         'F5',
  upi:          'F6',
  card:         'F7',
  print:        'F8',
  estimate:     'F9',
  hold:         'Ctrl+H',
  heldbills:    'Ctrl+B',
  newbill:      'Ctrl+N',
  estimatemode: 'Ctrl+E',
};

const SHORTCUT_LABELS: Record<string, string> = {
  cash:         'Pay with Cash',
  upi:          'Pay with UPI',
  card:         'Pay with Card',
  print:        'Print Bill',
  estimate:     'Save as Estimate',
  hold:         'Hold Current Bill',
  heldbills:    'View Held Bills',
  newbill:      'New Bill',
  estimatemode: 'Toggle Estimate Mode',
};

const DANGEROUS_KEYS = new Set([
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z',
  'Ctrl+W', 'Ctrl+T', 'Ctrl+R', 'Alt+F4',
]);

function captureKeyCombo(e: KeyboardEvent): string | null {
  // Ignore pure modifier presses
  if (['Control', 'Alt', 'Meta', 'Shift'].includes(e.key)) return null;
  if (e.key === 'Escape') return '';
  if (e.key === 'Enter') return null;

  if (e.ctrlKey || e.metaKey) {
    return `Ctrl+${e.key.toUpperCase()}`;
  }
  if (e.altKey) {
    return `Alt+${e.key.toUpperCase()}`;
  }
  return e.key;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

function RadioGroup({
  label, description, options, value, onChange,
}: {
  label: string; description?: string;
  options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="py-3">
      <div className="text-sm font-medium text-gray-900">{label}</div>
      {description && <div className="text-xs text-gray-500 mt-0.5 mb-2">{description}</div>}
      <div className="flex gap-2 mt-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              value === opt.value
                ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {value === opt.value && <CheckCircle2 className="w-3 h-3 inline mr-1 text-blue-600" />}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shortcut Key Capture Button ──────────────────────────────────────────────

function KeyCapture({
  action, value, isCapturing, isDuplicate, isDangerous,
  onStartCapture, onCaptured,
}: {
  action: string;
  value: string;
  isCapturing: boolean;
  isDuplicate: boolean;
  isDangerous: boolean;
  onStartCapture: (action: string) => void;
  onCaptured: (action: string, key: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isCapturing) return;
    ref.current?.focus();

    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      const combo = captureKeyCombo(e);
      if (combo === null) return;
      if (combo === '') {
        onCaptured(action, value);
        return;
      }
      onCaptured(action, combo);
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isCapturing, action, value, onCaptured]);

  const hasConflict = isDuplicate || isDangerous;

  return (
    <button
      ref={ref}
      onClick={() => onStartCapture(action)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-mono transition-colors focus:outline-none ${
        isCapturing
          ? 'border-blue-500 bg-blue-50 text-blue-700 animate-pulse'
          : hasConflict
          ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100 hover:border-gray-400'
      }`}
      title={isCapturing ? 'Press a key combination. Esc to cancel.' : 'Click to change shortcut'}
    >
      {isCapturing ? (
        <span className="text-blue-600 text-xs font-sans">Press key... (Esc to cancel)</span>
      ) : (
        <>
          <span>{value}</span>
          {isDangerous && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
          {isDuplicate && !isDangerous && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
        </>
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = 'billing' | 'shortcuts' | 'pos' | 'gst' | 'system' | 'loyalty';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('billing');

  // Billing
  const [billing, setBilling]     = useState<BillingSettings>(DEFAULT_BILLING);
  const [original, setOriginal]   = useState<BillingSettings>(DEFAULT_BILLING);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingSaving, setBillingSaving]   = useState(false);

  // Shortcuts
  const [shortcuts, setShortcuts]         = useState<ShortcutMap>(DEFAULT_SHORTCUTS);
  const [savedShortcuts, setSavedShortcuts] = useState<ShortcutMap>(DEFAULT_SHORTCUTS);
  const [shortcutsLoading, setShortcutsLoading] = useState(false);
  const [shortcutsSaving, setShortcutsSaving]   = useState(false);
  const [capturingAction, setCapturingAction]   = useState<string | null>(null);

  // GST settings
  const [gstDeadlineDay, setGstDeadlineDay]         = useState('10');
  const [savedGstDeadlineDay, setSavedGstDeadlineDay] = useState('10');
  const [gstLoading, setGstLoading]                 = useState(false);
  const [gstSaving, setGstSaving]                   = useState(false);

  // System settings
  const [sessionTimeout, setSessionTimeout]     = useState('0');
  const [savedSessionTimeout, setSavedSessionTimeout] = useState('0');
  const [systemLoading, setSystemLoading]       = useState(false);
  const [systemSaving, setSystemSaving]         = useState(false);

  // POS settings
  const [singleCashierMode, setSingleCashierMode] = useState(true);
  const [savedSingleCashierMode, setSavedSingleCashierMode] = useState(true);
  const [posLoading, setPosLoading]   = useState(false);
  const [posSaving, setPosSaving]     = useState(false);

  // Loyalty settings
  const [loyaltyEnabled,      setLoyaltyEnabled]      = useState(false);
  const [loyaltyEarnPer100,   setLoyaltyEarnPer100]   = useState('1');
  const [loyaltyValuePt,      setLoyaltyValuePt]      = useState('0.50');
  const [loyaltyMinPoints,    setLoyaltyMinPoints]     = useState('100');
  const [loyaltyMaxPct,       setLoyaltyMaxPct]        = useState('20');
  const [loyaltyMinMarginPct, setLoyaltyMinMarginPct]  = useState('5');
  const [loyaltySavedState,   setLoyaltySavedState]    = useState({ enabled: false, earn_per_100: '1', value_per_point: '0.50', min_redeem_points: '100', max_redeem_pct: '20', min_margin_pct: '5' });
  const [loyaltyLoading,      setLoyaltyLoading]       = useState(false);
  const [loyaltySaving,       setLoyaltySaving]        = useState(false);

  const loyaltyChanged = loyaltyEnabled !== loyaltySavedState.enabled
    || loyaltyEarnPer100    !== loyaltySavedState.earn_per_100
    || loyaltyValuePt       !== loyaltySavedState.value_per_point
    || loyaltyMinPoints     !== loyaltySavedState.min_redeem_points
    || loyaltyMaxPct        !== loyaltySavedState.max_redeem_pct
    || loyaltyMinMarginPct  !== loyaltySavedState.min_margin_pct;

  const loadLoyaltySettings = useCallback(async () => {
    setLoyaltyLoading(true);
    try {
      const { data } = await api.get('/settings/loyalty');
      const s = { enabled: data.enabled === 'true', earn_per_100: data.earn_per_100 ?? '1', value_per_point: data.value_per_point ?? '0.50', min_redeem_points: data.min_redeem_points ?? '100', max_redeem_pct: data.max_redeem_pct ?? '20', min_margin_pct: data.min_margin_pct ?? '5' };
      setLoyaltyEnabled(s.enabled);
      setLoyaltyEarnPer100(s.earn_per_100);
      setLoyaltyValuePt(s.value_per_point);
      setLoyaltyMinPoints(s.min_redeem_points);
      setLoyaltyMaxPct(s.max_redeem_pct);
      setLoyaltyMinMarginPct(s.min_margin_pct);
      setLoyaltySavedState(s);
    } catch { toast.error('Failed to load loyalty settings'); }
    finally { setLoyaltyLoading(false); }
  }, []);

  const saveLoyaltySettings = async () => {
    setLoyaltySaving(true);
    try {
      await api.put('/settings/loyalty', {
        enabled:           String(loyaltyEnabled),
        earn_per_100:      loyaltyEarnPer100,
        value_per_point:   loyaltyValuePt,
        min_redeem_points: loyaltyMinPoints,
        max_redeem_pct:    loyaltyMaxPct,
        min_margin_pct:    loyaltyMinMarginPct,
      });
      setLoyaltySavedState({ enabled: loyaltyEnabled, earn_per_100: loyaltyEarnPer100, value_per_point: loyaltyValuePt, min_redeem_points: loyaltyMinPoints, max_redeem_pct: loyaltyMaxPct, min_margin_pct: loyaltyMinMarginPct });
      toast.success('Loyalty settings saved!');
    } catch { toast.error('Failed to save loyalty settings'); }
    finally { setLoyaltySaving(false); }
  };

  // Bill starting numbers
  const [taxInvoiceStart, setTaxInvoiceStart]       = useState('');
  const [retailInvoiceStart, setRetailInvoiceStart] = useState('');
  const [estimateStart, setEstimateStart]           = useState('');
  const [billSeriesConfirm, setBillSeriesConfirm]   = useState(false);
  const [billSeriesSaving, setBillSeriesSaving]     = useState(false);

  // ─── Billing ────────────────────────────────────────────

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const { data } = await api.get('/settings/billing');
      setBilling({ ...DEFAULT_BILLING, ...data });
      setOriginal({ ...DEFAULT_BILLING, ...data });
    } catch {
      toast.error('Failed to load billing settings');
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => { loadBilling(); }, [loadBilling]);

  const saveBilling = async () => {
    setBillingSaving(true);
    try {
      const { data } = await api.put('/settings/billing', {
        ...billing,
        estimateValidityDays: String(billing.estimateValidityDays),
      });
      setBilling({ ...DEFAULT_BILLING, ...data });
      setOriginal({ ...DEFAULT_BILLING, ...data });
      toast.success('Billing settings saved');
    } catch {
      toast.error('Failed to save billing settings');
    } finally {
      setBillingSaving(false);
    }
  };

  const billingChanged = JSON.stringify(billing) !== JSON.stringify(original);
  const setBillingField = (key: keyof BillingSettings, value: string) =>
    setBilling(prev => ({ ...prev, [key]: value }));

  // ─── Shortcuts ──────────────────────────────────────────

  const loadShortcuts = useCallback(async () => {
    setShortcutsLoading(true);
    try {
      const { data } = await api.get('/settings/pos-shortcuts');
      setShortcuts({ ...DEFAULT_SHORTCUTS, ...data });
      setSavedShortcuts({ ...DEFAULT_SHORTCUTS, ...data });
    } catch {
      toast.error('Failed to load shortcuts');
    } finally {
      setShortcutsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'shortcuts') loadShortcuts();
  }, [activeTab, loadShortcuts]);

  // Detect duplicates: key -> list of actions that use it
  const keyToActions = new Map<string, string[]>();
  for (const [action, key] of Object.entries(shortcuts)) {
    if (!keyToActions.has(key)) keyToActions.set(key, []);
    keyToActions.get(key)!.push(action);
  }
  const duplicateActions = new Set<string>();
  for (const [, actions] of Array.from(keyToActions)) {
    if (actions.length > 1) actions.forEach((a: string) => duplicateActions.add(a));
  }
  const dangerousActions = new Set(
    Object.entries(shortcuts)
      .filter(([, v]) => DANGEROUS_KEYS.has(v))
      .map(([k]) => k)
  );

  const hasDuplicates  = duplicateActions.size > 0;
  const hasDangerous   = dangerousActions.size > 0;
  const shortcutsChanged = JSON.stringify(shortcuts) !== JSON.stringify(savedShortcuts);

  const handleStartCapture = useCallback((action: string) => {
    setCapturingAction(action);
  }, []);

  const handleCaptured = useCallback((action: string, key: string) => {
    setCapturingAction(null);
    if (key && key !== shortcuts[action]) {
      setShortcuts(prev => ({ ...prev, [action]: key }));
    }
  }, [shortcuts]);

  const resetShortcuts = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    setCapturingAction(null);
  };

  const saveShortcuts = async () => {
    if (hasDuplicates) { toast.error('Fix duplicate key assignments before saving'); return; }
    if (hasDangerous) { toast.error('Remove dangerous key assignments before saving'); return; }
    setShortcutsSaving(true);
    try {
      const { data } = await api.put('/settings/pos-shortcuts', shortcuts);
      setShortcuts({ ...DEFAULT_SHORTCUTS, ...data });
      setSavedShortcuts({ ...DEFAULT_SHORTCUTS, ...data });
      toast.success('Shortcuts saved');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save shortcuts';
      toast.error(msg);
    } finally {
      setShortcutsSaving(false);
    }
  };

  // ─── GST settings ───────────────────────────────────────

  const loadGstSettings = useCallback(async () => {
    setGstLoading(true);
    try {
      const { data } = await api.get('/settings/gst');
      const day = data.filing_deadline_day ?? '10';
      setGstDeadlineDay(day);
      setSavedGstDeadlineDay(day);
    } catch {
      toast.error('Failed to load GST settings');
    } finally {
      setGstLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'gst') loadGstSettings();
  }, [activeTab, loadGstSettings]);

  const saveGstSettings = async () => {
    const day = parseInt(gstDeadlineDay, 10);
    if (isNaN(day) || day < 1 || day > 28) {
      toast.error('Deadline day must be between 1 and 28');
      return;
    }
    setGstSaving(true);
    try {
      await api.put('/settings/gst', { filing_deadline_day: String(day) });
      setSavedGstDeadlineDay(String(day));
      toast.success('GST settings saved');
    } catch {
      toast.error('Failed to save GST settings');
    } finally {
      setGstSaving(false);
    }
  };

  const gstChanged = gstDeadlineDay !== savedGstDeadlineDay;

  // ─── System settings ────────────────────────────────────

  const loadSystemSettings = useCallback(async () => {
    setSystemLoading(true);
    try {
      const { data } = await api.get('/settings/system');
      setSessionTimeout(data.session_timeout ?? '0');
      setSavedSessionTimeout(data.session_timeout ?? '0');
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setSystemLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'system') loadSystemSettings();
  }, [activeTab, loadSystemSettings]);

  const saveSystemSettings = async () => {
    setSystemSaving(true);
    try {
      await api.put('/settings/system', { session_timeout: sessionTimeout });
      setSavedSessionTimeout(sessionTimeout);
      toast.success('System settings saved');
    } catch {
      toast.error('Failed to save system settings');
    } finally {
      setSystemSaving(false);
    }
  };

  const systemChanged = sessionTimeout !== savedSessionTimeout;

  // ─── POS settings ───────────────────────────────────────

  const loadPosSettings = useCallback(async () => {
    setPosLoading(true);
    try {
      const { data } = await api.get('/settings/pos');
      const val = data.single_cashier_mode !== 'false';
      setSingleCashierMode(val);
      setSavedSingleCashierMode(val);
    } catch {
      toast.error('Failed to load POS settings');
    } finally {
      setPosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'pos') loadPosSettings();
  }, [activeTab, loadPosSettings]);

  const savePosSettings = async () => {
    setPosSaving(true);
    try {
      await api.put('/settings/pos', { single_cashier_mode: String(singleCashierMode) });
      setSavedSingleCashierMode(singleCashierMode);
      toast.success('POS settings saved');
    } catch {
      toast.error('Failed to save POS settings');
    } finally {
      setPosSaving(false);
    }
  };

  const posChanged = singleCashierMode !== savedSingleCashierMode;

  // ─── Bill Series ────────────────────────────────────────

  const applyBillStartingNumbers = async () => {
    const body: Record<string, number> = {};
    if (taxInvoiceStart)    body.taxInvoiceStart    = parseInt(taxInvoiceStart, 10);
    if (retailInvoiceStart) body.retailInvoiceStart = parseInt(retailInvoiceStart, 10);
    if (estimateStart)      body.estimateStart      = parseInt(estimateStart, 10);
    if (Object.keys(body).length === 0) {
      toast.error('Enter at least one starting number');
      return;
    }
    setBillSeriesSaving(true);
    try {
      const { data } = await api.post('/admin/reset-bill-series', body);
      toast.success(data.results?.join(' | ') ?? 'Bill series updated');
      setTaxInvoiceStart('');
      setRetailInvoiceStart('');
      setEstimateStart('');
      setBillSeriesConfirm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update bill series');
    } finally {
      setBillSeriesSaving(false);
    }
  };

  // ─── Tabs ────────────────────────────────────────────────

  const tabs = [
    { id: 'billing'   as TabId, label: 'Billing',       icon: Receipt },
    { id: 'shortcuts' as TabId, label: 'POS Shortcuts', icon: Keyboard },
    { id: 'pos'       as TabId, label: 'POS',           icon: Store },
    { id: 'gst'       as TabId, label: 'GST',           icon: FileText },
    { id: 'system'    as TabId, label: 'System',        icon: Clock },
    { id: 'loyalty'   as TabId, label: 'Loyalty',       icon: Star },
  ];

  useEffect(() => { if (activeTab === 'loyalty') loadLoyaltySettings(); }, [activeTab, loadLoyaltySettings]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Settings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure your store preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Billing Tab ─── */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {billingLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading settings...
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Invoice Defaults</h2>
                <div className="divide-y divide-gray-100">
                  <RadioGroup
                    label="Default Bill Type"
                    description="Bill type pre-selected when opening POS"
                    options={[
                      { value: 'TAX_INVOICE',    label: 'Tax Invoice (GST/)' },
                      { value: 'RETAIL_INVOICE', label: 'Retail Invoice (INV/)' },
                    ]}
                    value={billing.defaultBillType}
                    onChange={v => setBillingField('defaultBillType', v)}
                  />
                  <RadioGroup
                    label="Default Print Format"
                    description="Format used when printing from POS"
                    options={[
                      { value: 'THERMAL', label: 'Thermal (80mm)' },
                      { value: 'A4',      label: 'A4' },
                    ]}
                    value={billing.defaultPrintFormat}
                    onChange={v => setBillingField('defaultPrintFormat', v)}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Estimates</h2>
                <div className="py-3">
                  <div className="text-sm font-medium text-gray-900">Estimate Validity</div>
                  <div className="text-xs text-gray-500 mt-0.5 mb-3">Number of days an estimate remains valid after creation</div>
                  <div className="flex gap-2 flex-wrap">
                    {['1', '3', '7', '15', '30'].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setBillingField('estimateValidityDays', d)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          billing.estimateValidityDays === d
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {d === '1' ? '1 day' : `${d} days`}
                      </button>
                    ))}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">or custom:</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={billing.estimateValidityDays}
                        onChange={e => setBillingField('estimateValidityDays', e.target.value)}
                        className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">GST &amp; B2B</h2>
                <div className="divide-y divide-gray-100">
                  <Toggle
                    checked={billing.autoB2BOnGstin === 'true'}
                    onChange={v => setBillingField('autoB2BOnGstin', String(v))}
                    label="Auto B2B on GSTIN"
                    description="Automatically switch to Tax Invoice and mark as B2B when a customer GSTIN is entered"
                  />
                  <Toggle
                    checked={billing.showGstBreakupOnRetail === 'true'}
                    onChange={v => setBillingField('showGstBreakupOnRetail', String(v))}
                    label="Show GST Breakup on Retail Invoice"
                    description="Display CGST/SGST breakdown even on retail (non-GST) invoices"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Bill Starting Numbers</h2>
                <p className="text-xs text-gray-500 mb-4">
                  Set the starting bill number for this financial year. Only enter a number higher than the current count.
                  Leave blank to keep the current series.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    This operation cannot be undone. Bills already issued will not be affected but there will be a gap in the numbering sequence.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tax Invoice (GST/)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 1001"
                      value={taxInvoiceStart}
                      onChange={e => setTaxInvoiceStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Retail Invoice (INV/)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 1001"
                      value={retailInvoiceStart}
                      onChange={e => setRetailInvoiceStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Estimate (EST/)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 1"
                      value={estimateStart}
                      onChange={e => setEstimateStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {!billSeriesConfirm ? (
                  <button
                    onClick={() => setBillSeriesConfirm(true)}
                    disabled={!taxInvoiceStart && !retailInvoiceStart && !estimateStart}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Apply Starting Numbers
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">Are you sure? This cannot be undone.</span>
                    <button
                      onClick={applyBillStartingNumbers}
                      disabled={billSeriesSaving}
                      className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {billSeriesSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                      Confirm
                    </button>
                    <button
                      onClick={() => setBillSeriesConfirm(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={loadBilling}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Discard changes
                </button>
                <button
                  onClick={saveBilling}
                  disabled={!billingChanged || billingSaving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {billingSaving
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />}
                  {billingSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Shortcuts Tab ─── */}
      {activeTab === 'shortcuts' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {shortcutsLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading shortcuts...
            </div>
          ) : (
            <>
              {/* Conflict/danger banners */}
              {hasDangerous && (
                <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    One or more shortcuts use reserved browser keys (Ctrl+C, Ctrl+V, etc.) and cannot be saved.
                    Click the highlighted key to change it.
                  </span>
                </div>
              )}
              {hasDuplicates && !hasDangerous && (
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2 text-sm text-amber-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Two or more actions share the same key. Each action must have a unique shortcut.
                  </span>
                </div>
              )}

              {/* Instruction */}
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-500">
                  Click any key button to capture a new shortcut. Press the desired key or key combination,
                  or press <span className="font-mono bg-gray-100 px-1 rounded">Esc</span> to cancel.
                </p>
              </div>

              {/* Shortcuts table */}
              <div className="divide-y divide-gray-50">
                {Object.keys(DEFAULT_SHORTCUTS).map(action => {
                  const isDuplicate = duplicateActions.has(action);
                  const isDangerous = dangerousActions.has(action);
                  const isCapturing = capturingAction === action;

                  return (
                    <div
                      key={action}
                      className={`flex items-center justify-between px-6 py-3.5 ${
                        isDuplicate || isDangerous ? 'bg-red-50' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {SHORTCUT_LABELS[action] ?? action}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">
                          pos.shortcut.{action}
                        </div>
                        {isDangerous && (
                          <div className="text-xs text-red-600 mt-0.5">
                            This key is reserved by the browser
                          </div>
                        )}
                        {isDuplicate && !isDangerous && (
                          <div className="text-xs text-amber-600 mt-0.5">
                            Duplicate key assignment
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <KeyCapture
                          action={action}
                          value={shortcuts[action] ?? DEFAULT_SHORTCUTS[action]}
                          isCapturing={isCapturing}
                          isDuplicate={isDuplicate}
                          isDangerous={isDangerous}
                          onStartCapture={handleStartCapture}
                          onCaptured={handleCaptured}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={resetShortcuts}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset to defaults
                </button>
                <button
                  onClick={saveShortcuts}
                  disabled={!shortcutsChanged || shortcutsSaving || hasDuplicates || hasDangerous}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {shortcutsSaving
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />}
                  {shortcutsSaving ? 'Saving...' : 'Save Shortcuts'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── POS Tab ─── */}
      {activeTab === 'pos' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {posLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading POS settings...
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Store Operation Mode</h2>
                <div className="divide-y divide-gray-100">
                  <Toggle
                    checked={singleCashierMode}
                    onChange={setSingleCashierMode}
                    label="Single Cashier Mode"
                    description="Combines day and shift open/close into a single action. Recommended for one-person stores. When enabled, POS shows Open Store and Close Store instead of separate day and shift controls."
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={loadPosSettings}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Discard changes
                </button>
                <button
                  onClick={savePosSettings}
                  disabled={!posChanged || posSaving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {posSaving
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />}
                  {posSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── GST Tab ─── */}
      {activeTab === 'gst' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {gstLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading GST settings...
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">GST Filing Deadline</h2>
                <div className="py-3 space-y-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Filing Deadline Day of Month</div>
                    <div className="text-xs text-gray-500 mt-0.5 mb-3">
                      GRNs must be submitted to the GST portal by this day of the following month.
                      Example: May invoices must be filed by June 10th.
                      After this date, GRNs are locked for editing.
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={gstDeadlineDay}
                        onChange={e => setGstDeadlineDay(e.target.value)}
                        placeholder="10"
                        className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-medium"
                      />
                      <span className="text-sm text-gray-500">th of the following month</span>
                    </div>
                  </div>
                  {(() => {
                    const day = parseInt(gstDeadlineDay, 10);
                    if (isNaN(day) || day < 1 || day > 28) return null;
                    const now = new Date();
                    const deadline = new Date(now.getFullYear(), now.getMonth() + 1, day);
                    return (
                      <div className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                        {now.toLocaleString('en-IN', { month: 'long' })} invoices — deadline:{' '}
                        <span className="font-semibold">
                          {deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="text-xs text-gray-400">
                    Valid range: 1st to 28th. Default is 10.
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={loadGstSettings}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Discard changes
                </button>
                <button
                  onClick={saveGstSettings}
                  disabled={!gstChanged || gstSaving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {gstSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {gstSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── System Tab ─── */}
      {activeTab === 'system' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {systemLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading system settings...
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Session Security</h2>
                <div className="py-3">
                  <div className="text-sm font-medium text-gray-900">Session Timeout</div>
                  <div className="text-xs text-gray-500 mt-0.5 mb-3">
                    Automatically log out after a period of inactivity. "Never" keeps the session active indefinitely.
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: '0',   label: 'Never (no timeout)' },
                      { value: '30',  label: '30 min' },
                      { value: '60',  label: '1 hour' },
                      { value: '120', label: '2 hours' },
                      { value: '240', label: '4 hours' },
                      { value: '480', label: '8 hours' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSessionTimeout(opt.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          sessionTimeout === opt.value
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {sessionTimeout === opt.value && <CheckCircle2 className="w-3 h-3 inline mr-1 text-blue-600" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {sessionTimeout === '0' && (
                    <p className="text-xs text-gray-400 mt-2">Sessions will never expire automatically. Manual logout only.</p>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={loadSystemSettings}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Discard changes
                </button>
                <button
                  onClick={saveSystemSettings}
                  disabled={!systemChanged || systemSaving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {systemSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {systemSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Loyalty Tab ─── */}
      {activeTab === 'loyalty' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loyaltyLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Loyalty Points Programme</h2>
                <p className="text-xs text-gray-400 mb-2">Reward customers with points on every purchase. They can redeem points for discounts at the POS.</p>
                <Toggle
                  checked={loyaltyEnabled}
                  onChange={setLoyaltyEnabled}
                  label="Enable Loyalty Points"
                  description="When enabled, points are earned and can be redeemed at POS"
                />
              </div>

              {loyaltyEnabled && (
                <>
                  <div className="px-6 py-4 border-b border-gray-100 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Earning Rules</h2>
                    <div>
                      <label className="text-sm font-medium text-gray-900">Points earned per ₹100 spent</label>
                      <p className="text-xs text-gray-500 mb-2">e.g. 1 = customer earns 1 point for every ₹100 purchase</p>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={loyaltyEarnPer100}
                        onChange={(e) => setLoyaltyEarnPer100(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="px-6 py-4 border-b border-gray-100 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Redemption Rules</h2>
                    <div>
                      <label className="text-sm font-medium text-gray-900">₹ value of 1 point</label>
                      <p className="text-xs text-gray-500 mb-2">e.g. 0.50 = 1 point gives ₹0.50 discount</p>
                      <input
                        type="number"
                        min="0"
                        step="0.05"
                        value={loyaltyValuePt}
                        onChange={(e) => setLoyaltyValuePt(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-900">Minimum points to redeem</label>
                      <p className="text-xs text-gray-500 mb-2">Customer must have at least this many points to redeem</p>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={loyaltyMinPoints}
                        onChange={(e) => setLoyaltyMinPoints(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-900">Maximum discount % per bill</label>
                      <p className="text-xs text-gray-500 mb-2">Points redemption cannot exceed this % of the bill total</p>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="5"
                        value={loyaltyMaxPct}
                        onChange={(e) => setLoyaltyMaxPct(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-900">Minimum margin % to earn points</label>
                      <p className="text-xs text-gray-500 mb-2">Items whose profit margin (selling − cost ÷ selling) is below this % will not earn loyalty points. Set to 0 to disable.</p>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={loyaltyMinMarginPct}
                        onChange={(e) => setLoyaltyMinMarginPct(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
                      <strong>Example with current settings:</strong> A ₹1,000 bill earns{' '}
                      {Math.floor(1000 / 100) * parseFloat(loyaltyEarnPer100 || '0')} points.{' '}
                      If a customer redeems 200 points, they get ₹{(200 * parseFloat(loyaltyValuePt || '0')).toFixed(2)} off{' '}
                      (max ₹{(1000 * parseFloat(loyaltyMaxPct || '0') / 100).toFixed(0)} on this bill).
                      {parseFloat(loyaltyMinMarginPct || '0') > 0 && (
                        <span> Items with less than {loyaltyMinMarginPct}% margin are excluded from point earning.</span>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={loadLoyaltySettings}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Discard changes
                </button>
                <button
                  onClick={saveLoyaltySettings}
                  disabled={!loyaltyChanged || loyaltySaving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loyaltySaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {loyaltySaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

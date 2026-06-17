'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Save, RefreshCw, Building2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Indian states list ──────────────────────────────────────────────────────

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

// ─── Validation patterns ──────────────────────────────────────────────────────

const RE = {
  gstin:  /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/,
  pan:    /^[A-Z]{5}\d{4}[A-Z]$/,
  tan:    /^[A-Z]{4}\d{5}[A-Z]$/,
  fssai:  /^\d{14}$/,
  cin:    /^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/,
  iec:    /^\d{10}$/,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  name: string; gstin: string; stateCode: string; stateName: string;
  address: string; phone: string; email: string;
  pan: string; tan: string; professionalTaxNo: string;
  fssaiLicense: string; fssaiExpiry: string;
  drugLicense: string; drugLicenseExpiry: string;
  tradeLicense: string; tradeLicenseExpiry: string;
  shopEstablishmentLicense: string; shopEstablishmentExpiry: string;
  fireSafetyNoc: string; fireSafetyNocExpiry: string;
  weightsAndMeasuresLicense: string; weightsAndMeasuresExpiry: string;
  liquorLicense: string; liquorLicenseExpiry: string;
  udyamRegistration: string; cin: string; iecCode: string;
}

const EMPTY: FormState = {
  name: '', gstin: '', stateCode: '36', stateName: 'Telangana',
  address: '', phone: '', email: '',
  pan: '', tan: '', professionalTaxNo: '',
  fssaiLicense: '', fssaiExpiry: '',
  drugLicense: '', drugLicenseExpiry: '',
  tradeLicense: '', tradeLicenseExpiry: '',
  shopEstablishmentLicense: '', shopEstablishmentExpiry: '',
  fireSafetyNoc: '', fireSafetyNocExpiry: '',
  weightsAndMeasuresLicense: '', weightsAndMeasuresExpiry: '',
  liquorLicense: '', liquorLicenseExpiry: '',
  udyamRegistration: '', cin: '', iecCode: '',
};

// ─── Expiry badge ─────────────────────────────────────────────────────────────

function ExpiryBadge({ dateStr }: { dateStr: string }) {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const now    = new Date();
  const days   = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  if (days < 0)
    return <span className="ml-2 text-xs font-semibold text-white bg-red-500 px-1.5 py-0.5 rounded">EXPIRED</span>;
  if (days <= 7)
    return <span className="ml-2 text-xs font-semibold text-white bg-red-500 px-1.5 py-0.5 rounded">EXPIRING in {days}d</span>;
  if (days <= 30)
    return <span className="ml-2 text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{days}d left</span>;
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Fld({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Section({
  title, open, onToggle, children,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

// ─── License pair row ─────────────────────────────────────────────────────────

function LicensePair({
  numLabel, numValue, onNumChange, numPlaceholder, numFilter,
  expLabel, expValue, onExpChange,
  numError, expError,
}: {
  numLabel: string; numValue: string; onNumChange: (v: string) => void;
  numPlaceholder?: string; numFilter?: (v: string) => string;
  expLabel: string; expValue: string; onExpChange: (v: string) => void;
  numError?: string; expError?: string;
}) {
  const expRequired = !!numValue;
  const numRequired = !!expValue;
  const inp = 'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-[#1B4F8A]';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Fld label={numLabel} required={numRequired} error={numError}>
        <input
          value={numValue}
          onChange={(e) => onNumChange(numFilter ? numFilter(e.target.value) : e.target.value)}
          className={`${inp} ${numError ? 'border-red-400' : 'border-gray-200'}`}
          placeholder={numPlaceholder}
        />
      </Fld>
      <Fld label={<span className="flex items-center">{expLabel}{expRequired && <span className="text-red-500 ml-0.5">*</span>}<ExpiryBadge dateStr={expValue} /></span> as any} error={expError}>
        <input
          type="date"
          value={expValue}
          onChange={(e) => onExpChange(e.target.value)}
          className={`${inp} ${expError ? 'border-red-400' : 'border-gray-200'}`}
        />
      </Fld>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BusinessPage() {
  const [form, setForm]       = useState<FormState>(EMPTY);
  const [saved, setSaved]     = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Partial<Record<keyof FormState, string>>>({});
  const [open, setOpen]       = useState({ s1: true, s2: true, s3: true, s4: true, s5: true, s6: true });

  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/business/info');
      const toStr = (v: any) => (v == null ? '' : String(v));
      const toDate = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '');
      const loaded: FormState = {
        name: toStr(data.name), gstin: toStr(data.gstin), stateCode: toStr(data.stateCode) || '36',
        stateName: toStr(data.stateName) || 'Telangana', address: toStr(data.address),
        phone: toStr(data.phone), email: toStr(data.email),
        pan: toStr(data.pan), tan: toStr(data.tan), professionalTaxNo: toStr(data.professionalTaxNo),
        fssaiLicense: toStr(data.fssaiLicense), fssaiExpiry: toDate(data.fssaiExpiry),
        drugLicense: toStr(data.drugLicense), drugLicenseExpiry: toDate(data.drugLicenseExpiry),
        tradeLicense: toStr(data.tradeLicense), tradeLicenseExpiry: toDate(data.tradeLicenseExpiry),
        shopEstablishmentLicense: toStr(data.shopEstablishmentLicense), shopEstablishmentExpiry: toDate(data.shopEstablishmentExpiry),
        fireSafetyNoc: toStr(data.fireSafetyNoc), fireSafetyNocExpiry: toDate(data.fireSafetyNocExpiry),
        weightsAndMeasuresLicense: toStr(data.weightsAndMeasuresLicense), weightsAndMeasuresExpiry: toDate(data.weightsAndMeasuresExpiry),
        liquorLicense: toStr(data.liquorLicense), liquorLicenseExpiry: toDate(data.liquorLicenseExpiry),
        udyamRegistration: toStr(data.udyamRegistration), cin: toStr(data.cin), iecCode: toStr(data.iecCode),
      };
      setForm(loaded); setSaved(loaded); setErrors({});
    } catch {
      toast.error('Failed to load business info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleStateChange(code: string) {
    const state = INDIAN_STATES.find((s) => s.code === code);
    if (!state || code === form.stateCode) return;
    if (!window.confirm(`Changing state to ${state.name} affects GST on all future bills. Continue?`)) return;
    setForm((f) => ({ ...f, stateCode: state.code, stateName: state.name }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = 'Business name is required';
    if (form.gstin && !RE.gstin.test(form.gstin)) e.gstin = 'Invalid GSTIN format';
    if (form.pan   && !RE.pan.test(form.pan))     e.pan   = 'PAN must be in format AAAAA0000A';
    if (form.tan   && !RE.tan.test(form.tan))     e.tan   = 'TAN must be in format AAAA00000A';
    if (form.fssaiLicense && !RE.fssai.test(form.fssaiLicense)) e.fssaiLicense = 'FSSAI must be exactly 14 digits';
    if (form.cin     && !RE.cin.test(form.cin))   e.cin     = 'CIN must be 21 characters';
    if (form.iecCode && !RE.iec.test(form.iecCode)) e.iecCode = 'IEC code must be exactly 10 digits';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';

    // License pairs
    const pairs: [keyof FormState, keyof FormState, string, string][] = [
      ['fssaiLicense',             'fssaiExpiry',            'FSSAI License',              'FSSAI Expiry'],
      ['drugLicense',              'drugLicenseExpiry',      'Drug License',               'Drug License Expiry'],
      ['tradeLicense',             'tradeLicenseExpiry',     'Trade License',              'Trade License Expiry'],
      ['shopEstablishmentLicense', 'shopEstablishmentExpiry','Shop & Establishment No.',   'Shop & Establishment Expiry'],
      ['fireSafetyNoc',            'fireSafetyNocExpiry',   'Fire Safety NOC',            'Fire Safety NOC Expiry'],
      ['weightsAndMeasuresLicense','weightsAndMeasuresExpiry','Weights & Measures License','Weights & Measures Expiry'],
      ['liquorLicense',            'liquorLicenseExpiry',   'Liquor License',             'Liquor License Expiry'],
    ];
    for (const [numKey, expKey, numLabel, expLabel] of pairs) {
      if (form[numKey] && !form[expKey]) e[expKey] = `${expLabel} is required`;
      if (form[expKey] && !form[numKey]) e[numKey] = `${numLabel} is required`;
    }

    // Expiry dates must not be in the past
    const expiryKeys: (keyof FormState)[] = [
      'fssaiExpiry','drugLicenseExpiry','tradeLicenseExpiry','shopEstablishmentExpiry',
      'fireSafetyNocExpiry','weightsAndMeasuresExpiry','liquorLicenseExpiry',
    ];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const key of expiryKeys) {
      const v = form[key];
      if (v && new Date(v) < today && !e[key]) e[key] = 'Expiry date cannot be in the past';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) { toast.error('Fix the errors before saving'); return; }

    if (form.gstin && RE.gstin.test(form.gstin)) {
      const gstinState = form.gstin.slice(0, 2);
      if (gstinState !== form.stateCode) {
        const stateName = INDIAN_STATES.find((s) => s.code === gstinState)?.name ?? gstinState;
        if (!window.confirm(`GSTIN code "${gstinState}" (${stateName}) does not match the selected state "${form.stateCode}" (${form.stateName}). Proceed anyway?`))
          return;
      }
    }

    setSaving(true);
    try {
      const nullIfEmpty = (v: string) => v.trim() || undefined;
      await api.put('/business', {
        name: form.name.trim(),
        gstin: nullIfEmpty(form.gstin), stateCode: form.stateCode, stateName: form.stateName,
        address: nullIfEmpty(form.address), phone: nullIfEmpty(form.phone), email: nullIfEmpty(form.email),
        pan: nullIfEmpty(form.pan), tan: nullIfEmpty(form.tan), professionalTaxNo: nullIfEmpty(form.professionalTaxNo),
        fssaiLicense: nullIfEmpty(form.fssaiLicense), fssaiExpiry: nullIfEmpty(form.fssaiExpiry),
        drugLicense: nullIfEmpty(form.drugLicense), drugLicenseExpiry: nullIfEmpty(form.drugLicenseExpiry),
        tradeLicense: nullIfEmpty(form.tradeLicense), tradeLicenseExpiry: nullIfEmpty(form.tradeLicenseExpiry),
        shopEstablishmentLicense: nullIfEmpty(form.shopEstablishmentLicense), shopEstablishmentExpiry: nullIfEmpty(form.shopEstablishmentExpiry),
        fireSafetyNoc: nullIfEmpty(form.fireSafetyNoc), fireSafetyNocExpiry: nullIfEmpty(form.fireSafetyNocExpiry),
        weightsAndMeasuresLicense: nullIfEmpty(form.weightsAndMeasuresLicense), weightsAndMeasuresExpiry: nullIfEmpty(form.weightsAndMeasuresExpiry),
        liquorLicense: nullIfEmpty(form.liquorLicense), liquorLicenseExpiry: nullIfEmpty(form.liquorLicenseExpiry),
        udyamRegistration: nullIfEmpty(form.udyamRegistration), cin: nullIfEmpty(form.cin), iecCode: nullIfEmpty(form.iecCode),
      });
      toast.success('Business information saved');
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  const changed = JSON.stringify(form) !== JSON.stringify(saved);
  const inp = (err?: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-[#1B4F8A] ${err ? 'border-red-400' : 'border-gray-200'}`;

  return (
    <>
      <Header title="Business Information" />
      <main className="flex-1 p-6 max-w-3xl mx-auto space-y-4">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-6 h-6 text-[#1B4F8A] animate-spin" />
          </div>
        ) : (
          <>
            {/* Page header card */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-[#1B4F8A]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{saved.name || 'Business'}</p>
                <p className="text-xs text-gray-400">State: {saved.stateName} · Code: {saved.stateCode}</p>
              </div>
              {!changed && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              {changed && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unsaved changes
                </span>
              )}
            </div>

            {/* Section 1 — Business Identity */}
            <Section title="1. Business Identity" open={open.s1} onToggle={() => toggle('s1')}>
              <Fld label="Business Name" required error={errors.name}>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)}
                  className={inp(errors.name)} placeholder="e.g. Srivani Stores" />
              </Fld>

              <Fld label="State" error={errors.stateCode}>
                <select value={form.stateCode} onChange={(e) => handleStateChange(e.target.value)}
                  className={`${inp()} bg-white`}>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-0.5">Determines CGST+SGST vs IGST on all future bills</p>
              </Fld>

              <Fld label="Address" error={errors.address}>
                <textarea value={form.address} onChange={(e) => setField('address', e.target.value)}
                  className={`${inp(errors.address)} resize-none`} rows={3}
                  placeholder="Shop address as it appears on invoices" />
              </Fld>

              <div className="grid grid-cols-2 gap-4">
                <Fld label="Phone" error={errors.phone}>
                  <input value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                    className={inp(errors.phone)} placeholder="e.g. 9876543210" />
                </Fld>
                <Fld label="Email" error={errors.email}>
                  <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
                    className={inp(errors.email)} placeholder="store@example.com" />
                </Fld>
              </div>
            </Section>

            {/* Section 2 — Tax IDs */}
            <Section title="2. Tax IDs" open={open.s2} onToggle={() => toggle('s2')}>
              <div className="grid grid-cols-2 gap-4">
                <Fld label="PAN" error={errors.pan}>
                  <input value={form.pan}
                    onChange={(e) => setField('pan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    className={`${inp(errors.pan)} font-mono`} placeholder="AAAAA0000A" maxLength={10} />
                </Fld>
                <Fld label="GSTIN" error={errors.gstin}>
                  <input value={form.gstin}
                    onChange={(e) => setField('gstin', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                    className={`${inp(errors.gstin)} font-mono`} placeholder="36AAAAA0000A1ZA" maxLength={15} />
                  {form.gstin && !errors.gstin && RE.gstin.test(form.gstin) && (
                    <p className="text-xs text-green-600 mt-0.5">Valid GSTIN — state {form.gstin.slice(0, 2)}</p>
                  )}
                </Fld>
                <Fld label="TAN" error={errors.tan}>
                  <input value={form.tan}
                    onChange={(e) => setField('tan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    className={`${inp(errors.tan)} font-mono`} placeholder="AAAA00000A" maxLength={10} />
                </Fld>
                <Fld label="Professional Tax Number" error={errors.professionalTaxNo}>
                  <input value={form.professionalTaxNo} onChange={(e) => setField('professionalTaxNo', e.target.value)}
                    className={inp(errors.professionalTaxNo)} placeholder="PT registration number" />
                </Fld>
              </div>
            </Section>

            {/* Section 3 — Food & Health Licenses */}
            <Section title="3. Food & Health Licenses" open={open.s3} onToggle={() => toggle('s3')}>
              <LicensePair
                numLabel="FSSAI License Number" numValue={form.fssaiLicense}
                onNumChange={(v) => setField('fssaiLicense', v.replace(/\D/g, '').slice(0, 14))}
                numPlaceholder="14-digit number" numFilter={(v) => v.replace(/\D/g, '').slice(0, 14)}
                expLabel="FSSAI Expiry" expValue={form.fssaiExpiry}
                onExpChange={(v) => setField('fssaiExpiry', v)}
                numError={errors.fssaiLicense} expError={errors.fssaiExpiry}
              />
              <LicensePair
                numLabel="Drug License Number" numValue={form.drugLicense}
                onNumChange={(v) => setField('drugLicense', v)}
                expLabel="Drug License Expiry" expValue={form.drugLicenseExpiry}
                onExpChange={(v) => setField('drugLicenseExpiry', v)}
                numError={errors.drugLicense} expError={errors.drugLicenseExpiry}
              />
            </Section>

            {/* Section 4 — Trade & Premises */}
            <Section title="4. Trade & Premises Licenses" open={open.s4} onToggle={() => toggle('s4')}>
              <LicensePair
                numLabel="Trade / Gumasta License" numValue={form.tradeLicense}
                onNumChange={(v) => setField('tradeLicense', v)}
                expLabel="Trade License Expiry" expValue={form.tradeLicenseExpiry}
                onExpChange={(v) => setField('tradeLicenseExpiry', v)}
                numError={errors.tradeLicense} expError={errors.tradeLicenseExpiry}
              />
              <LicensePair
                numLabel="Shop & Establishment No." numValue={form.shopEstablishmentLicense}
                onNumChange={(v) => setField('shopEstablishmentLicense', v)}
                expLabel="S&E License Expiry" expValue={form.shopEstablishmentExpiry}
                onExpChange={(v) => setField('shopEstablishmentExpiry', v)}
                numError={errors.shopEstablishmentLicense} expError={errors.shopEstablishmentExpiry}
              />
              <LicensePair
                numLabel="Fire Safety NOC Number" numValue={form.fireSafetyNoc}
                onNumChange={(v) => setField('fireSafetyNoc', v)}
                expLabel="Fire Safety NOC Expiry" expValue={form.fireSafetyNocExpiry}
                onExpChange={(v) => setField('fireSafetyNocExpiry', v)}
                numError={errors.fireSafetyNoc} expError={errors.fireSafetyNocExpiry}
              />
            </Section>

            {/* Section 5 — Operational Licenses */}
            <Section title="5. Operational Licenses" open={open.s5} onToggle={() => toggle('s5')}>
              <LicensePair
                numLabel="Weights & Measures License" numValue={form.weightsAndMeasuresLicense}
                onNumChange={(v) => setField('weightsAndMeasuresLicense', v)}
                expLabel="W&M License Expiry" expValue={form.weightsAndMeasuresExpiry}
                onExpChange={(v) => setField('weightsAndMeasuresExpiry', v)}
                numError={errors.weightsAndMeasuresLicense} expError={errors.weightsAndMeasuresExpiry}
              />
              <LicensePair
                numLabel="Liquor License Number" numValue={form.liquorLicense}
                onNumChange={(v) => setField('liquorLicense', v)}
                expLabel="Liquor License Expiry" expValue={form.liquorLicenseExpiry}
                onExpChange={(v) => setField('liquorLicenseExpiry', v)}
                numError={errors.liquorLicense} expError={errors.liquorLicenseExpiry}
              />
            </Section>

            {/* Section 6 — Other Registrations */}
            <Section title="6. Other Registrations" open={open.s6} onToggle={() => toggle('s6')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Fld label="Udyam / MSME Registration" error={errors.udyamRegistration}>
                  <input value={form.udyamRegistration} onChange={(e) => setField('udyamRegistration', e.target.value.toUpperCase())}
                    className={`${inp(errors.udyamRegistration)} font-mono`} placeholder="UDYAM-XX-00-0000000" />
                </Fld>
                <Fld label="CIN (Company Identification Number)" error={errors.cin}>
                  <input value={form.cin}
                    onChange={(e) => setField('cin', e.target.value.toUpperCase().slice(0, 21))}
                    className={`${inp(errors.cin)} font-mono`} placeholder="L00000XX0000XXX000000" maxLength={21} />
                </Fld>
                <Fld label="IEC Code (Import Export Code)" error={errors.iecCode}>
                  <input value={form.iecCode}
                    onChange={(e) => setField('iecCode', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`${inp(errors.iecCode)} font-mono`} placeholder="10-digit IEC" maxLength={10} />
                </Fld>
              </div>
            </Section>

            {/* Footer actions */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
              <button onClick={load} disabled={saving}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 disabled:opacity-40">
                <RefreshCw className="w-3.5 h-3.5" /> Discard changes
              </button>
              <button onClick={save} disabled={saving || !changed}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}

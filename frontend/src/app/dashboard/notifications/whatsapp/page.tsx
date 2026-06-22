'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Plus, Trash2, RefreshCw, CheckCircle2, Clock, XCircle,
  Send, KeyRound, PlayCircle, X, Wifi, WifiOff, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaTemplate {
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
  category: string;
  language: string;
  rejected_reason?: string;
  components: Array<{ type: string; text?: string; format?: string }>;
}

const CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'] as const;
const LANGUAGES  = [
  { code: 'en',    label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'hi',    label: 'Hindi' },
  { code: 'te',    label: 'Telugu' },
];

const TEMPLATE_DESC: Record<string, string> = {
  test_order:        '📦 Store alert — sent to you when a new order arrives',
  svn_order_placed:  '🛍️ Customer confirmation — sent when COD order is placed',
  svn_payment_done:  '✅ Payment receipt — sent to customer after online payment',
  svn_order_update:  '🔔 Status update — sent to customer on order progress',
  hello_world:       '👋 Meta built-in test template',
};

const REQUIRED_TEMPLATES = [
  { name: 'test_order',       body: 'Hello! New order {{1}} from {{2}} ({{3}}). Items: {{4}} | Total: ₹{{5}} | {{6}} | {{7}}',                                                                   footer: '- Srivani Stores' },
  { name: 'svn_order_placed', body: 'Hello {{1}}, your order *{{2}}* has been placed at Srivani Stores! Total: ₹{{3}} | {{4}}. Thank you for shopping with us!',                               footer: '- Srivani Stores' },
  { name: 'svn_payment_done', body: 'Hello {{1}}, payment of ₹{{2}} received! Order *{{3}}* is confirmed. We will start preparing it now. - Srivani Stores',                                  footer: '' },
  { name: 'svn_order_update', body: 'Hello {{1}}, your order *{{2}}* update: {{3}} - Team Srivani Stores',                                                                                      footer: '' },
];

const BLANK_FORM  = { name: '', category: 'UTILITY' as const, language: 'en', headerText: '', bodyText: '', footerText: '' };
const BLANK_CREDS = { token: '', phoneId: '', wabaId: '', storeNum: '' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates]     = useState<WaTemplate[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ ...BLANK_FORM });
  const [submitting, setSubmitting]   = useState(false);
  const [testPhone, setTestPhone]     = useState('');
  const [testing, setTesting]         = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [creds, setCreds]             = useState({ ...BLANK_CREDS });
  const [credsStatus, setCredsStatus] = useState<{
    tokenConfigured: boolean; phoneId: string | null; storeNum: string | null; source: string;
  } | null>(null);
  const [savingCreds, setSavingCreds] = useState(false);
  const [sendModal, setSendModal]     = useState<{
    template: WaTemplate; phone: string; params: string[]; sending: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/whatsapp/templates');
      if (data?.error) {
        const msg = data.error?.message ?? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        toast.error(`Meta API: ${msg}`);
        setTemplates([]);
      } else {
        setTemplates((data?.data as WaTemplate[]) ?? []);
      }
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadCreds(); }, [load]);

  async function loadCreds() {
    try {
      const { data } = await api.get('/notifications/whatsapp/credentials');
      setCredsStatus(data);
    } catch { /* ignore */ }
  }

  async function saveCreds() {
    const payload = Object.fromEntries(Object.entries(creds).filter(([, v]) => v.trim() !== ''));
    if (Object.keys(payload).length === 0) return toast.error('Enter at least one field to update');
    setSavingCreds(true);
    try {
      const { data } = await api.patch('/notifications/whatsapp/credentials', payload);
      setCredsStatus(data);
      setCreds({ ...BLANK_CREDS });
      setShowCredsModal(false);
      toast.success('Credentials saved — active immediately');
      load();
    } catch {
      toast.error('Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  }

  async function submit() {
    if (!form.name.trim()) return toast.error('Template name is required');
    if (!form.bodyText.trim()) return toast.error('Body text is required');
    const nameClean = form.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (nameClean !== form.name.trim()) {
      toast.error('Name must be lowercase letters, numbers and underscores only');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/notifications/whatsapp/templates', {
        name:       form.name.trim(),
        category:   form.category,
        language:   form.language,
        bodyText:   form.bodyText.trim(),
        headerText: form.headerText.trim() || undefined,
        footerText: form.footerText.trim() || undefined,
      });
      if (data?.id || data?.status === 'PENDING') {
        toast.success('Template submitted to Meta for approval!');
        setForm({ ...BLANK_FORM });
        setShowForm(false);
        await load();
      } else {
        toast.error(data?.error?.message ?? data?.error ?? 'Submission failed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/notifications/whatsapp/templates/${name}`);
      toast.success(`"${name}" deleted`);
      await load();
    } catch {
      toast.error('Delete failed');
    }
  }

  async function sendHelloWorld() {
    if (!testPhone.trim()) return toast.error('Enter a phone number');
    setTesting(true);
    try {
      const { data } = await api.post('/notifications/whatsapp/test', { phone: testPhone.trim() });
      if (data?.ok) toast.success(`hello_world sent to ${data.to}`);
      else toast.error(data?.reason ?? 'Failed');
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  }

  const bodyPreview = (t: WaTemplate) =>
    t.components.find(c => c.type === 'BODY')?.text ?? '—';

  function varCount(t: WaTemplate): number {
    const matches = bodyPreview(t).match(/\{\{\d+\}\}/g) ?? [];
    const nums = matches.map(m => parseInt(m.replace(/\D/g, ''), 10));
    return nums.length ? Math.max(...nums) : 0;
  }

  function openSendModal(t: WaTemplate) {
    setSendModal({ template: t, phone: testPhone || '', params: Array(varCount(t)).fill(''), sending: false });
  }

  async function sendFromModal() {
    if (!sendModal) return;
    if (!sendModal.phone.trim()) return toast.error('Enter a phone number');
    setSendModal(m => m ? { ...m, sending: true } : null);
    try {
      const { data } = await api.post('/notifications/whatsapp/send-template', {
        phone:    sendModal.phone.trim(),
        template: sendModal.template.name,
        language: sendModal.template.language,
        params:   sendModal.params,
      });
      if (data?.ok) {
        toast.success(`"${sendModal.template.name}" sent to ${data.to}`);
        setSendModal(null);
      } else {
        toast.error(data?.reason ?? 'Send failed');
        setSendModal(m => m ? { ...m, sending: false } : null);
      }
    } catch {
      toast.error('Send failed');
      setSendModal(m => m ? { ...m, sending: false } : null);
    }
  }

  const existingNames   = new Set(templates.map(t => t.name));
  const missingRequired = REQUIRED_TEMPLATES.filter(r => !existingNames.has(r.name));
  const isConnected     = credsStatus?.tokenConfigured;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="text-green-600" size={22} />
            <h1 className="text-xl font-semibold text-gray-900">WhatsApp Notifications</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 ml-8">Automated messages for orders, payments and updates</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-outline flex items-center gap-1.5 text-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => { setShowForm(v => !v); setForm({ ...BLANK_FORM }); }}
            className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={13} /> New Template
          </button>
        </div>
      </div>

      {/* ── Connection status card ── */}
      <div className={`rounded-xl border p-4 ${isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-1.5 ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
              {isConnected
                ? <Wifi size={15} className="text-green-600" />
                : <WifiOff size={15} className="text-red-500" />}
            </div>
            <div>
              <p className={`font-medium text-sm ${isConnected ? 'text-green-800' : 'text-red-700'}`}>
                {isConnected ? 'Connected to WhatsApp Business' : 'Not connected — token missing or expired'}
              </p>
              {credsStatus && (
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-600">
                  {credsStatus.phoneId && (
                    <span><span className="text-gray-400">Phone ID:</span> {credsStatus.phoneId}</span>
                  )}
                  {credsStatus.storeNum && (
                    <span><span className="text-gray-400">Order alerts →</span> +{credsStatus.storeNum}</span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded ${credsStatus.source === 'database' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {credsStatus.source}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowCredsModal(true)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
            <KeyRound size={12} /> Update Credentials
          </button>
        </div>

        {/* Quick connection test */}
        <div className="mt-3 pt-3 border-t border-green-200/60 flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Quick test:</span>
          <input
            className="input flex-1 text-sm h-8 py-1.5"
            placeholder="Phone number e.g. 93828 28484"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
          />
          <button onClick={sendHelloWorld} disabled={testing}
            className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 whitespace-nowrap transition-colors">
            <Send size={12} /> {testing ? 'Sending…' : 'Send hello_world'}
          </button>
        </div>
      </div>

      {/* ── New template form ── */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-blue-900">New Template</h2>
            <button onClick={() => { setShowForm(false); setForm({ ...BLANK_FORM }); }}
              className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-sm">Name <span className="text-gray-400 font-normal text-xs">(lowercase_underscores)</span></label>
              <input className="input" placeholder="svn_order_placed"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label text-sm">Category</label>
              <select className="input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as typeof form.category }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-sm">Language</label>
              <select className="input" value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-sm">Header <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input className="input" placeholder="Srivani Stores"
              value={form.headerText}
              onChange={e => setForm(f => ({ ...f, headerText: e.target.value }))} />
          </div>

          <div>
            <label className="label text-sm">Body <span className="text-red-500">*</span></label>
            <textarea rows={3} className="input"
              placeholder="Hello {{1}}, your order *{{2}}* has been placed. Total: ₹{{3}}"
              value={form.bodyText}
              onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Use {'{{1}}'}, {'{{2}}'} etc. for dynamic values</p>
          </div>

          <div>
            <label className="label text-sm">Footer <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input className="input" placeholder="- Team Srivani Stores"
              value={form.footerText}
              onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setShowForm(false); setForm({ ...BLANK_FORM }); }} className="btn-outline text-sm">Cancel</button>
            <button onClick={submit} disabled={submitting} className="btn-primary text-sm">
              {submitting ? 'Submitting…' : 'Submit to Meta for Approval'}
            </button>
          </div>
        </div>
      )}

      {/* ── Templates list ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Your Templates {!loading && `(${templates.length})`}
        </p>

        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <MessageSquare size={30} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No templates loaded.</p>
            <p className="text-xs mt-1">Check your connection above or use Quick-add below.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => {
              const approved = t.status === 'APPROVED';
              const pending  = t.status === 'PENDING';
              const rejected = t.status === 'REJECTED';
              return (
                <div key={t.name}
                  className={`bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow border-l-4
                    ${approved ? 'border-l-green-500' : pending ? 'border-l-yellow-400' : rejected ? 'border-l-red-400' : 'border-l-gray-300'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-gray-800">{t.name}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
                          ${approved ? 'bg-green-50 text-green-700 border-green-200'
                          : pending  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : rejected ? 'bg-red-50 text-red-600 border-red-200'
                                     : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {approved ? <CheckCircle2 size={11} /> : pending ? <Clock size={11} /> : <XCircle size={11} />}
                          {t.status}
                        </span>
                        <span className="text-xs text-gray-400">{t.category} · {t.language}</span>
                      </div>
                      {TEMPLATE_DESC[t.name] && (
                        <p className="text-xs text-blue-600 mt-0.5">{TEMPLATE_DESC[t.name]}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{bodyPreview(t)}</p>
                      {rejected && t.rejected_reason && t.rejected_reason !== 'NONE' && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={11} /> {t.rejected_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {approved && (
                        <button onClick={() => openSendModal(t)}
                          className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 transition-colors font-medium">
                          <PlayCircle size={13} /> Send Test
                        </button>
                      )}
                      <button onClick={() => remove(t.name)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Required templates checklist ── */}
      <div className={`rounded-xl border p-4 ${missingRequired.length > 0 ? 'border-orange-200 bg-orange-50/30' : 'border-green-200 bg-green-50/30'}`}>
        <div className="flex items-center gap-2 mb-3">
          {missingRequired.length > 0
            ? <AlertCircle size={15} className="text-orange-500" />
            : <CheckCircle2 size={15} className="text-green-500" />}
          <p className="text-sm font-semibold text-gray-700">
            {missingRequired.length === 0
              ? 'All required templates are ready!'
              : `${missingRequired.length} template${missingRequired.length > 1 ? 's' : ''} still needed`}
          </p>
        </div>
        <div className="space-y-2">
          {REQUIRED_TEMPLATES.map(r => {
            const exists = existingNames.has(r.name);
            return (
              <div key={r.name}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border
                  ${exists ? 'bg-white border-green-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {exists
                    ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-gray-800">{r.name}</span>
                    <p className="text-xs text-gray-500 truncate">{TEMPLATE_DESC[r.name] ?? ''}</p>
                  </div>
                </div>
                {!exists && (
                  <button
                    onClick={() => {
                      setForm({ name: r.name, category: 'UTILITY', language: 'en', headerText: 'Srivani Stores', bodyText: r.body, footerText: r.footer });
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1 font-medium whitespace-nowrap transition-colors">
                    <Plus size={11} /> Create
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>

    {/* ── Credentials modal ── */}
    {showCredsModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">Update WhatsApp Credentials</h3>
            </div>
            <button onClick={() => { setShowCredsModal(false); setCreds({ ...BLANK_CREDS }); }}
              className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 leading-relaxed">
            Only fill the fields you want to update — leave others blank to keep existing values.
            Token expires every ~24 h. Get a new one from Meta Developer → WhatsApp → API Setup → Generate access token.
          </div>

          <div>
            <label className="label text-sm">Access Token</label>
            <input className="input font-mono text-xs" placeholder="EAAd…"
              value={creds.token}
              onChange={e => setCreds(c => ({ ...c, token: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm">Phone Number ID</label>
              <input className="input text-sm" placeholder="1092826743922168"
                value={creds.phoneId}
                onChange={e => setCreds(c => ({ ...c, phoneId: e.target.value }))} />
            </div>
            <div>
              <label className="label text-sm">Business Account ID</label>
              <input className="input text-sm" placeholder="1573200934238105"
                value={creds.wabaId}
                onChange={e => setCreds(c => ({ ...c, wabaId: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label text-sm">Store Notify Number</label>
            <input className="input text-sm" placeholder="919382828484"
              value={creds.storeNum}
              onChange={e => setCreds(c => ({ ...c, storeNum: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">This number receives a WhatsApp alert for every new order</p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setShowCredsModal(false); setCreds({ ...BLANK_CREDS }); }} className="btn-outline text-sm">Cancel</button>
            <button onClick={saveCreds} disabled={savingCreds} className="btn-primary text-sm">
              {savingCreds ? 'Saving…' : 'Save Credentials'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Send template modal ── */}
    {sendModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Send Template</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{sendModal.template.name}</p>
            </div>
            <button onClick={() => setSendModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          {/* WhatsApp message bubble */}
          <div className="bg-[#dcf8c6] rounded-xl rounded-tl-none p-3.5 text-sm text-gray-800 leading-relaxed shadow-sm">
            {bodyPreview(sendModal.template)}
          </div>

          <div>
            <label className="label text-sm">Send to (phone number)</label>
            <input className="input" placeholder="93828 28484"
              value={sendModal.phone}
              onChange={e => setSendModal(m => m ? { ...m, phone: e.target.value } : null)} />
          </div>

          {sendModal.params.length > 0 && (
            <div className="space-y-2">
              <label className="label text-sm">Fill in the variables</label>
              {sendModal.params.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8 text-right font-mono shrink-0">{`{{${i + 1}}}`}</span>
                  <input className="input flex-1 text-sm" placeholder={`Value for {{${i + 1}}}`}
                    value={p}
                    onChange={e => setSendModal(m => {
                      if (!m) return null;
                      const params = [...m.params];
                      params[i] = e.target.value;
                      return { ...m, params };
                    })} />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setSendModal(null)} className="btn-outline text-sm">Cancel</button>
            <button onClick={sendFromModal} disabled={sendModal.sending}
              className="btn-primary flex items-center gap-1.5 text-sm">
              <Send size={13} /> {sendModal.sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, RefreshCw, CheckCircle2, Clock, XCircle, Send, KeyRound, ChevronDown, ChevronUp, PlayCircle, X } from 'lucide-react';
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

const STATUS_ICON: Record<string, JSX.Element> = {
  APPROVED: <CheckCircle2 size={14} className="text-green-600" />,
  PENDING:  <Clock        size={14} className="text-yellow-500" />,
  REJECTED: <XCircle      size={14} className="text-red-500" />,
  PAUSED:   <Clock        size={14} className="text-gray-400" />,
};

const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  PENDING:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  PAUSED:   'bg-gray-100 text-gray-500 border-gray-200',
};

const BLANK_FORM  = { name: '', category: 'UTILITY' as const, language: 'en', headerText: '', bodyText: '', footerText: '' };
const BLANK_CREDS = { token: '', phoneId: '', wabaId: '', storeNum: '' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates]   = useState<WaTemplate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...BLANK_FORM });
  const [submitting, setSubmitting]   = useState(false);
  const [testPhone, setTestPhone]     = useState('');
  const [testing, setTesting]         = useState(false);
  const [showCreds, setShowCreds]     = useState(false);
  const [creds, setCreds]             = useState({ ...BLANK_CREDS });
  const [credsStatus, setCredsStatus] = useState<{ tokenConfigured: boolean; phoneId: string | null; source: string } | null>(null);
  const [savingCreds, setSavingCreds] = useState(false);
  const [sendModal, setSendModal] = useState<{ template: WaTemplate; phone: string; params: string[]; sending: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/whatsapp/templates');
      setTemplates((data?.data as WaTemplate[]) ?? []);
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
    const payload = Object.fromEntries(
      Object.entries(creds).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(payload).length === 0) return toast.error('Enter at least one field to update');
    setSavingCreds(true);
    try {
      const { data } = await api.patch('/notifications/whatsapp/credentials', payload);
      setCredsStatus(data);
      setCreds({ ...BLANK_CREDS });
      setShowCreds(false);
      toast.success('Credentials saved — active immediately');
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
      const payload = {
        name:       form.name.trim(),
        category:   form.category,
        language:   form.language,
        bodyText:   form.bodyText.trim(),
        headerText: form.headerText.trim() || undefined,
        footerText: form.footerText.trim() || undefined,
      };
      const { data } = await api.post('/notifications/whatsapp/templates', payload);
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

  async function sendTest() {
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
    const body = bodyPreview(t);
    const matches = body.match(/\{\{\d+\}\}/g) ?? [];
    const nums = matches.map(m => parseInt(m.replace(/\D/g, ''), 10));
    return nums.length ? Math.max(...nums) : 0;
  }

  function openSendModal(t: WaTemplate) {
    setSendModal({ template: t, phone: testPhone, params: Array(varCount(t)).fill(''), sending: false });
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

  return (
    <>
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="text-green-600" size={24} />
          <div>
            <h1 className="text-xl font-semibold">WhatsApp Message Templates</h1>
            <p className="text-sm text-gray-500">Create and manage templates for customer notifications</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-outline flex items-center gap-1 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1 text-sm">
            <Plus size={14} /> New Template
          </button>
        </div>
      </div>

      {/* Credentials section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowCreds(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <KeyRound size={15} className="text-gray-500" />
            API Credentials
            {credsStatus && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-normal ${credsStatus.tokenConfigured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {credsStatus.tokenConfigured ? `Configured · ${credsStatus.source}` : 'Token missing'}
              </span>
            )}
          </span>
          {showCreds ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showCreds && (
          <div className="p-4 space-y-3 bg-white">
            <p className="text-xs text-gray-500">
              Paste the new token from Meta Developer → WhatsApp → API Setup → Generate access token.
              Only fill the fields you want to update — leave others blank.
            </p>
            <div>
              <label className="label text-xs">Access Token</label>
              <input className="input font-mono text-xs" placeholder="EAAd…"
                value={creds.token}
                onChange={e => setCreds(c => ({ ...c, token: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Phone Number ID</label>
                <input className="input text-xs" placeholder="1092826743922168"
                  value={creds.phoneId}
                  onChange={e => setCreds(c => ({ ...c, phoneId: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">WhatsApp Business Account ID</label>
                <input className="input text-xs" placeholder="1573200934238105"
                  value={creds.wabaId}
                  onChange={e => setCreds(c => ({ ...c, wabaId: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label text-xs">Store Notify Number (receives new order alerts)</label>
              <input className="input text-xs" placeholder="919382828484"
                value={creds.storeNum}
                onChange={e => setCreds(c => ({ ...c, storeNum: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCreds(false); setCreds({ ...BLANK_CREDS }); }} className="btn-outline text-xs">Cancel</button>
              <button onClick={saveCreds} disabled={savingCreds} className="btn-primary text-xs">
                {savingCreds ? 'Saving…' : 'Save Credentials'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Credential test */}
      <div className="card p-4 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-sm font-medium mb-2">Test Credentials (sends hello_world)</p>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Phone number e.g. 93828 28484"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
          />
          <button onClick={sendTest} disabled={testing} className="btn-primary flex items-center gap-1 text-sm">
            <Send size={14} /> {testing ? 'Sending…' : 'Send Test'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5 border border-blue-200 rounded-lg bg-blue-50/40 space-y-4">
          <h2 className="font-semibold text-blue-800">New Template</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Name <span className="text-gray-400 font-normal">(lowercase, underscores)</span></label>
              <input className="input" placeholder="svn_order_placed"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as typeof form.category }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Language</label>
              <select className="input" value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Header <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Srivani Stores"
              value={form.headerText}
              onChange={e => setForm(f => ({ ...f, headerText: e.target.value }))} />
          </div>

          <div>
            <label className="label">Body <span className="text-red-500">*</span></label>
            <textarea rows={4} className="input" placeholder="Hello {{1}}, your order *{{2}}* has been placed. Total: ₹{{3}}"
              value={form.bodyText}
              onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))} />
            <p className="text-xs text-gray-500 mt-1">Use {'{{1}}'}, {'{{2}}'} etc. for dynamic values</p>
          </div>

          <div>
            <label className="label">Footer <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="- Team Srivani Stores"
              value={form.footerText}
              onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm({ ...BLANK_FORM }); }} className="btn-outline text-sm">
              Cancel
            </button>
            <button onClick={submit} disabled={submitting} className="btn-primary text-sm">
              {submitting ? 'Submitting…' : 'Submit to Meta for Approval'}
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No templates yet. Click <strong>New Template</strong> to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.name} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-gray-800">{t.name}</span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[t.status] ?? ''}`}>
                      {STATUS_ICON[t.status]} {t.status}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{t.category}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{t.language}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 truncate">{bodyPreview(t)}</p>
                  {t.rejected_reason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {t.rejected_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.status === 'APPROVED' && (
                    <button onClick={() => openSendModal(t)}
                      className="text-green-600 hover:text-green-700 transition-colors"
                      title="Send test message">
                      <PlayCircle size={18} />
                    </button>
                  )}
                  <button onClick={() => remove(t.name)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete template">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pre-defined templates helper */}
      <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-3">Quick-add required templates</p>
        <div className="space-y-2 text-xs text-gray-600">
          {[
            { name: 'test_order',       cat: 'UTILITY',    body: 'Hello! New order {{1}} from {{2}} ({{3}}). Items: {{4}} | Total: ₹{{5}} | {{6}} | {{7}}' },
            { name: 'svn_order_placed', cat: 'UTILITY',    body: 'Hello {{1}}, your order *{{2}}* has been placed at Srivani Stores! Total: ₹{{3}} | {{4}}. Thank you for shopping with us!' },
            { name: 'svn_payment_done', cat: 'UTILITY',    body: 'Hello {{1}}, payment of ₹{{2}} received! Order *{{3}}* is confirmed. We will start preparing it now. - Srivani Stores' },
            { name: 'svn_order_update', cat: 'UTILITY',    body: 'Hello {{1}}, your order *{{2}}* update: {{3}} - Team Srivani Stores' },
          ].map(t => (
            <div key={t.name} className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-gray-200">
              <div>
                <span className="font-mono font-medium text-gray-700">{t.name}</span>
                <p className="text-gray-500 mt-0.5 line-clamp-1">{t.body}</p>
              </div>
              <button
                onClick={() => {
                  setForm({ name: t.name, category: t.cat as typeof form.category, language: 'en', headerText: '', bodyText: t.body, footerText: '- Srivani Stores' });
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-blue-600 hover:text-blue-800 text-xs whitespace-nowrap font-medium"
              >
                Use this →
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>

    {/* Send template modal */}

    {sendModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Send: <span className="font-mono text-green-700">{sendModal.template.name}</span></h3>
            <button onClick={() => setSendModal(null)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 font-mono whitespace-pre-wrap border border-gray-200">
            {bodyPreview(sendModal.template)}
          </div>

          <div>
            <label className="label text-sm">Send to phone number</label>
            <input className="input" placeholder="93828 28484"
              value={sendModal.phone}
              onChange={e => setSendModal(m => m ? { ...m, phone: e.target.value } : null)} />
          </div>

          {sendModal.params.length > 0 && (
            <div className="space-y-2">
              <label className="label text-sm">Variables</label>
              {sendModal.params.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8 text-right font-mono">{`{{${i + 1}}}`}</span>
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
            <button onClick={sendFromModal} disabled={sendModal.sending} className="btn-primary flex items-center gap-1 text-sm">
              <Send size={14} /> {sendModal.sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

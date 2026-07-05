'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Trash2, Send, Clock, CheckCircle2, XCircle, MessageCircle, Mail } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { fmtDate, fmtTime } from '@/lib/report-format';

interface Schedule {
  id: string; name: string; reportType: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  sendAt: string; weekday: number | null; dayOfMonth: number | null;
  channel: 'WHATSAPP' | 'EMAIL'; recipient: string;
  isActive: boolean;
  lastRunAt: string | null; lastStatus: string | null; lastError: string | null;
}

const REPORT_LABEL: Record<string, string> = {
  DAY_BOOK:          'Day Book',
  SALES_BY_CATEGORY: 'Sales by Category',
  PAYMENT_MODES:     'Payment Modes',
  EXPENSES:          'Expenses',
  PURCHASES:         'Purchases',
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_FORM = {
  name: '', reportType: 'DAY_BOOK', frequency: 'DAILY' as const,
  sendAt: '09:00', weekday: 1, dayOfMonth: 1,
  channel: 'WHATSAPP' as const, recipient: '',
};

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Schedule[]>('/reports/schedules');
      setSchedules(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load schedules'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/reports/schedules', {
        ...form,
        weekday:    form.frequency === 'WEEKLY'  ? Number(form.weekday)    : undefined,
        dayOfMonth: form.frequency === 'MONTHLY' ? Number(form.dayOfMonth) : undefined,
      });
      toast.success('Schedule created');
      setShowForm(false); setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create schedule'));
    } finally { setSaving(false); }
  }

  async function toggleActive(s: Schedule) {
    try {
      await api.put(`/reports/schedules/${s.id}`, { isActive: !s.isActive });
      load();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update')); }
  }

  async function remove(s: Schedule) {
    if (!confirm(`Delete schedule "${s.name}"?`)) return;
    try {
      await api.delete(`/reports/schedules/${s.id}`);
      toast.success('Schedule deleted');
      load();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to delete')); }
  }

  async function runNow(s: Schedule) {
    setRunningId(s.id);
    try {
      const res = await api.post<Schedule>(`/reports/schedules/${s.id}/run-now`);
      if (res.data?.lastStatus === 'SENT') toast.success(`Sent to ${s.recipient}`);
      else toast.error(`Send failed: ${res.data?.lastError ?? 'unknown error'}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send'));
    } finally { setRunningId(null); }
  }

  function cadenceLabel(s: Schedule) {
    if (s.frequency === 'DAILY')   return `Daily at ${s.sendAt}`;
    if (s.frequency === 'WEEKLY')  return `${WEEKDAYS[s.weekday ?? 0]}s at ${s.sendAt}`;
    return `Day ${s.dayOfMonth} of each month at ${s.sendAt}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Scheduled Reports" />
      <div className="max-w-5xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Scheduled Reports' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setShowForm(f => !f)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e]">
              <Plus className="w-3.5 h-3.5" /> New Schedule
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-xs text-blue-900 leading-relaxed">
          <p className="font-semibold mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> How scheduled reports work</p>
          <p>
            Reports are sent automatically at the chosen time (IST). <strong>Daily</strong> schedules send
            yesterday&apos;s numbers, <strong>weekly</strong> the last 7 days, <strong>monthly</strong> the previous
            calendar month. <strong>Email</strong> delivery always works. <strong>WhatsApp</strong> delivery uses
            Meta&apos;s free-text rule: the recipient must have messaged your store&apos;s WhatsApp number within the
            last 24 hours — if a report doesn&apos;t arrive, send any message (e.g. &quot;hi&quot;) to the store number
            to re-open the window. Use &quot;Send now&quot; to test a schedule immediately.
          </p>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">New Scheduled Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name <span title="A label so you recognise this schedule in the list, e.g. 'Morning sales summary'" className="cursor-help text-gray-400">ⓘ</span></label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Morning day-book to owner"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Report <span title="Which report's summary is sent" className="cursor-help text-gray-400">ⓘ</span></label>
                <select value={form.reportType} onChange={e => setForm({ ...form, reportType: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]">
                  {Object.entries(REPORT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Frequency <span title="Daily = yesterday's numbers · Weekly = last 7 days · Monthly = previous calendar month" className="cursor-help text-gray-400">ⓘ</span></label>
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]">
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Send at (IST) <span title="24-hour clock, Indian Standard Time" className="cursor-help text-gray-400">ⓘ</span></label>
                  <input type="time" value={form.sendAt} onChange={e => setForm({ ...form, sendAt: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]" />
                </div>
                {form.frequency === 'WEEKLY' && (
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Weekday</label>
                    <select value={form.weekday} onChange={e => setForm({ ...form, weekday: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]">
                      {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {form.frequency === 'MONTHLY' && (
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Day of month <span title="1–28 so it exists in every month" className="cursor-help text-gray-400">ⓘ</span></label>
                    <input type="number" min={1} max={28} value={form.dayOfMonth}
                      onChange={e => setForm({ ...form, dayOfMonth: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Channel <span title="Email always delivers. WhatsApp needs the recipient to have messaged your store number in the last 24h (Meta rule)." className="cursor-help text-gray-400">ⓘ</span></label>
                <div className="flex gap-2">
                  {(['WHATSAPP', 'EMAIL'] as const).map(c => (
                    <button key={c} onClick={() => setForm({ ...form, channel: c })}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${
                        form.channel === c ? 'border-[#1B4F8A] bg-blue-50 text-[#1B4F8A] font-medium' : 'border-gray-200 text-gray-600'
                      }`}>
                      {c === 'WHATSAPP' ? <MessageCircle className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                      {c === 'WHATSAPP' ? 'WhatsApp' : 'Email'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {form.channel === 'WHATSAPP' ? 'Phone number' : 'Email address'}
                  {' '}<span title={form.channel === 'WHATSAPP' ? '10-digit Indian mobile number' : 'Full email address'} className="cursor-help text-gray-400">ⓘ</span>
                </label>
                <input value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })}
                  placeholder={form.channel === 'WHATSAPP' ? '98765 43210' : 'owner@example.com'}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50">
                {saving ? 'Saving…' : 'Create Schedule'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {schedules.map(s => (
            <div key={s.id} className={`bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4 ${s.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {REPORT_LABEL[s.reportType] ?? s.reportType} · {cadenceLabel(s)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  {s.channel === 'WHATSAPP' ? <MessageCircle className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                  {s.recipient}
                </p>
              </div>

              <div className="text-right min-w-[140px]">
                {s.lastRunAt ? (
                  <>
                    <p className={`text-xs font-medium flex items-center justify-end gap-1 ${s.lastStatus === 'SENT' ? 'text-green-700' : 'text-red-600'}`}>
                      {s.lastStatus === 'SENT' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {s.lastStatus === 'SENT' ? 'Sent' : 'Failed'}
                    </p>
                    <p className="text-[10px] text-gray-400">{fmtDate(s.lastRunAt)} {fmtTime(s.lastRunAt)}</p>
                    {s.lastStatus === 'FAILED' && s.lastError && (
                      <p className="text-[10px] text-red-400 max-w-[180px] truncate" title={s.lastError}>{s.lastError}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Never run</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button onClick={() => runNow(s)} disabled={runningId === s.id}
                  title="Send this report right now (uses today's window) — good for testing delivery"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 text-[#1B4F8A] rounded-lg hover:bg-blue-100 disabled:opacity-50">
                  <Send className={`w-3 h-3 ${runningId === s.id ? 'animate-pulse' : ''}`} /> Send now
                </button>
                <button onClick={() => toggleActive(s)}
                  title={s.isActive ? 'Pause — keeps the schedule but stops sending' : 'Resume sending'}
                  className={`px-2.5 py-1.5 text-xs rounded-lg ${s.isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {s.isActive ? 'Active' : 'Paused'}
                </button>
                <button onClick={() => remove(s)} title="Delete this schedule permanently"
                  className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {!loading && schedules.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
              No scheduled reports yet — create one to get daily sales on WhatsApp automatically.
            </div>
          )}
          {loading && <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Loading…</div>}
        </div>
      </div>
    </div>
  );
}

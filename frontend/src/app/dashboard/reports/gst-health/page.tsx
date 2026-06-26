'use client';

import { useState } from 'react';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Info, CheckCircle2,
  Loader2, RefreshCw, Bell, ExternalLink, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GstIssue {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  count?: number;
  actionUrl: string;
  actionLabel: string;
  blocksFilingI: boolean;
}

interface GstHealthReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  checkedAt: string;
  fromDate: string;
  critical: GstIssue[];
  high: GstIssue[];
  medium: GstIssue[];
  low: GstIssue[];
  totalIssues: number;
  isFilingReady: boolean;
  summary: { criticalCount: number; highCount: number; mediumCount: number; lowCount: number };
}

// India FY start: April 1 of the current financial year
function defaultFromDate(): string {
  const now  = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
}

// ── Score Gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const fill = ((100 - score) / 100) * circ;
  const color = score >= 90 ? '#16a34a' : score >= 75 ? '#2563eb' : score >= 60 ? '#d97706' : score >= 40 ? '#ea580c' : '#dc2626';

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
        <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="bold" fill={color}>{score}</text>
        <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#6b7280">/ 100</text>
      </svg>
      <div className="mt-1 px-3 py-0.5 rounded-full text-white text-sm font-bold" style={{ backgroundColor: color }}>
        Grade {grade}
      </div>
    </div>
  );
}

// ── Issue Card ────────────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: GstIssue }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const cfg = {
    CRITICAL: { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-600',    icon: <ShieldAlert className="w-4 h-4 text-red-600" /> },
    HIGH:     { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500', icon: <AlertTriangle className="w-4 h-4 text-orange-500" /> },
    MEDIUM:   { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-500', icon: <Info className="w-4 h-4 text-yellow-600" /> },
    LOW:      { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-500',   icon: <Info className="w-4 h-4 text-blue-500" /> },
  }[issue.severity];

  return (
    <div className={`rounded-lg border ${cfg.bg} ${cfg.border} overflow-hidden`}>
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:brightness-95 transition-all"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{issue.title}</p>
            {issue.blocksFilingI && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase tracking-wide">Blocks Filing</span>
            )}
            {issue.count !== undefined && (
              <span className="text-[10px] font-semibold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{issue.count} items</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 flex items-start justify-between gap-4">
          <p className="text-sm text-gray-600 leading-relaxed flex-1">{issue.description}</p>
          <button
            onClick={() => router.push(issue.actionUrl)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            {issue.actionLabel}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Issue Section ─────────────────────────────────────────────────────────────

function IssueSection({ label, color, issues, defaultOpen }: {
  label: string; color: string; issues: GstIssue[]; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (issues.length === 0) return null;

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${color}`}>{label}</span>
        <span className="text-xs text-gray-400">{issues.length} issue{issues.length > 1 ? 's' : ''}</span>
        <div className="flex-1 h-px bg-gray-200 ml-1" />
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="space-y-2">
          {issues.map(i => <IssueCard key={i.id} issue={i} />)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GstHealthPage() {
  const qc = useQueryClient();
  const [fromDate, setFromDate] = useState(defaultFromDate);

  const { data, isLoading, error } = useQuery<GstHealthReport>({
    queryKey:  ['gst-health', fromDate],
    queryFn:   async () => {
      const { data } = await api.get('/reports/gst-health', { params: { from: fromDate } });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const notifyMutation = useMutation({
    mutationFn: () => api.post('/reports/gst-health/notify', null, { params: { from: fromDate } }),
    onSuccess:  (res) => {
      qc.setQueryData(['gst-health', fromDate], res.data);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['gst-health-banner'] });
    },
  });

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header title="GST Health" icon={<ShieldCheck className="w-5 h-5 text-[#1B4F8A]" />} />
      <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'GST Health' }]} />

      <main className="flex-1 p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">GST Compliance Score</h2>
            <p className="text-sm text-gray-500">Automated checks across sales, purchases, HSN codes and ITC</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Date from filter — to exclude test data */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 whitespace-nowrap">Data from</span>
              <input
                type="date"
                value={fromDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setFromDate(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-transparent outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['gst-health', fromDate] })}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => notifyMutation.mutate()}
              disabled={notifyMutation.isPending || isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1B4F8A] text-white text-sm font-medium hover:bg-[#163f6e] transition-colors disabled:opacity-50"
            >
              {notifyMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Bell className="w-4 h-4" />
              }
              Run Check & Notify
            </button>
          </div>
        </div>

        {/* Date context label */}
        <p className="text-xs text-gray-400 -mt-4">
          Showing data from <strong>{fmtDate(fromDate + 'T00:00:00')}</strong> onwards.
          Change the date above to exclude test/demo data from earlier periods.
        </p>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Running GST health checks…</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Failed to load GST health data. Please try refreshing.
          </div>
        )}

        {notifyMutation.isSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Health check complete. Notifications pushed to the bell for all CRITICAL and HIGH issues.
          </div>
        )}

        {data && !isLoading && (
          <>
            {/* Score card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ScoreGauge score={data.score} grade={data.grade} />
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Critical', count: data.summary.criticalCount, color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
                    { label: 'High',     count: data.summary.highCount,     color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
                    { label: 'Medium',   count: data.summary.mediumCount,   color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
                    { label: 'Low',      count: data.summary.lowCount,      color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-lg border p-3 text-center ${s.bg}`}>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {data.isFilingReady
                    ? <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-sm text-green-700 font-medium">Ready to file — no blocking issues</span></>
                    : <><ShieldAlert className="w-4 h-4 text-red-600" /><span className="text-sm text-red-700 font-medium">{data.summary.criticalCount} critical issue{data.summary.criticalCount > 1 ? 's' : ''} must be fixed before filing</span></>
                  }
                </div>
                <span className="text-xs text-gray-400">Last checked: {fmt(data.checkedAt)}</span>
              </div>
            </div>

            {/* All clear */}
            {data.totalIssues === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-green-800 mb-1">All checks passed!</h3>
                <p className="text-sm text-green-600">No GST compliance issues found for the selected period. Your books are clean for the next filing.</p>
              </div>
            )}

            {/* Issues by severity */}
            {data.totalIssues > 0 && (
              <div>
                <IssueSection label="CRITICAL" color="bg-red-600"    issues={data.critical} defaultOpen={true} />
                <IssueSection label="HIGH"      color="bg-orange-500" issues={data.high}     defaultOpen={true} />
                <IssueSection label="MEDIUM"    color="bg-yellow-500" issues={data.medium}   defaultOpen={false} />
                <IssueSection label="LOW"       color="bg-blue-500"   issues={data.low}      defaultOpen={false} />
              </div>
            )}

            {/* Coverage info */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What this health check covers</p>
              <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                <li>Business GSTIN validity and format</li>
                <li>Products sold in the selected period with missing or placeholder HSN codes</li>
                <li>Duplicate invoice numbers in sales</li>
                <li>GRNs older than 180 days with unpaid balances (ITC reversal risk — Section 16(2)(b))</li>
                <li>Approved GRNs with no supplier GSTIN on record</li>
                <li>Suppliers with invalid GSTIN format</li>
                <li>B2B bills missing customer GSTIN (causes B2B → B2C reporting error in GSTR-1)</li>
                <li>Bill cancellation rate in recent 30 days (&gt;5% flagged)</li>
                <li>Month-on-month purchase volume spike (&gt;50% flagged)</li>
                <li>Active products with no valid HSN in the catalog</li>
                <li>Outstanding supplier payables older than 90 days</li>
                <li>Round-figure invoice amounts (audit risk indicator)</li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

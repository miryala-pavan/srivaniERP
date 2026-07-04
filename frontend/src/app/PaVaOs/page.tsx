import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PaVaOS — Business Operating System',
  description:
    'PaVaOS is the open business operating system for Indian FMCG retailers. GST · TDS · Inventory · POS · Accounting · AI — all in one platform.',
};

const PHASES = [
  { id: 'P0', label: 'Platform foundation', desc: 'Multi-tenancy · Rule Engine · Audit · Events · Ledger · AI', status: 'live' },
  { id: 'P1', label: 'ERP core', desc: 'GST · TDS · Sales · Purchase · Inventory · POS · Bank · Reports', status: 'building' },
  { id: 'P2', label: 'Intelligence layer', desc: 'AI bookkeeping · Smart reconciliation · Anomaly detection', status: 'planned' },
  { id: 'P3', label: 'Compliance autopilot', desc: 'GSTR filing · TDS returns · Advance tax · IT returns', status: 'planned' },
  { id: 'P4', label: 'Supply chain', desc: 'Multi-vendor · SCEN marketplace · Demand forecasting', status: 'planned' },
  { id: 'P5', label: 'Growth engine', desc: 'WhatsApp commerce · Loyalty · Customer analytics', status: 'planned' },
  { id: 'P6–25', label: 'Future phases', desc: 'Payroll · Manufacturing · Multi-country · Public marketplace', status: 'planned' },
];

const PILLARS = [
  { icon: '🏛️', title: 'Multi-tenant', body: 'Every business fully isolated. One platform, thousands of firms — zero data leakage.' },
  { icon: '⚖️', title: 'Rule engine', body: 'All tax rates and thresholds live in the DB — never hardcoded. Update once, applies everywhere.' },
  { icon: '📒', title: 'Double-entry ledger', body: 'Every rupee posted automatically to a full General Ledger. Trial balance always balanced.' },
  { icon: '🔒', title: 'Subscription guard', body: 'Annual plans with automatic expiry enforcement. Renew online, access restored instantly.' },
  { icon: '🇮🇳', title: 'India-first', body: 'GST, TDS, Indian FY, INR, MSME rules — built in from day one, not bolted on.' },
  { icon: '🤖', title: 'AI-ready', body: 'Ollama local AI by default. Cloud escalation only when confidence is low.' },
];

const STATS = [
  { n: '25', label: 'Planned phases' },
  { n: '134', label: 'CoA accounts' },
  { n: '8+', label: 'Tax rule sets' },
  { n: '100%', label: 'Multi-tenant isolated' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'live')
    return <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>Live</span>;
  if (status === 'building')
    return <span style={{ background: '#fef9c3', color: '#a16207', border: '1px solid #fde047', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>Building</span>;
  return <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>Planned</span>;
}

export default function PaVaOsPage() {
  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#f8f9fa', minHeight: '100vh', color: '#171717' }}>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{ background: '#1B4F8A', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1B4F8A', letterSpacing: -0.5 }}>PV</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: -0.3 }}>PaVaOS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#phases" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Phases</a>
          <a href="#pillars" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Architecture</a>
          <a href="/login" style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 16px', borderRadius: 8, textDecoration: 'none' }}>
            Open ERP →
          </a>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{ background: '#1B4F8A', padding: '60px 32px 48px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Phase 0 live · Phase 1 in progress</span>
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 16, letterSpacing: -0.5 }}>
          The business operating system<br />
          <span style={{ color: '#93c5fd' }}>built for India</span>
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>
          PaVaOS is an open, multi-tenant ERP platform for Indian FMCG retailers.
          GST · TDS · Inventory · POS · Accounting · AI compliance — all phases, one coherent system.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/login" style={{ background: '#fff', color: '#1B4F8A', fontWeight: 600, fontSize: 14, padding: '10px 24px', borderRadius: 10, textDecoration: 'none' }}>
            Open your ERP →
          </a>
          <a href="#phases" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 500, fontSize: 14, padding: '10px 24px', borderRadius: 10, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)' }}>
            See the roadmap
          </a>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center' }}>
        {STATS.map(({ n, label }) => (
          <div key={label} style={{ padding: '20px 16px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1B4F8A' }}>{n}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── PHASES ───────────────────────────────────────── */}
      <section id="phases" style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Phases</h2>
          <p style={{ fontSize: 13, color: '#6b7280' }}>From foundation to full supply-chain network — 25 phases, one platform.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {PHASES.map((p) => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ca3af', fontWeight: 600 }}>{p.id}</span>
                <StatusBadge status={p.status} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PILLARS ──────────────────────────────────────── */}
      <section id="pillars" style={{ background: '#fff', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Architecture pillars</h2>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Every decision made once, correctly, for every firm on the platform.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {PILLARS.map(({ icon, title, body }) => (
              <div key={title} style={{ display: 'flex', gap: 14 }}>
                <div style={{ fontSize: 24, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '56px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Ready to run your business on PaVaOS?</h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Sign up, onboard your firm, and get a full Indian CoA + GST setup in under 2 minutes.</p>
        <a href="/login" style={{ background: '#1B4F8A', color: '#fff', fontWeight: 600, fontSize: 15, padding: '12px 32px', borderRadius: 10, textDecoration: 'none', display: 'inline-block' }}>
          Get started →
        </a>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer style={{ background: '#1B4F8A', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          <strong style={{ color: '#fff' }}>PaVaOS</strong> — Open business operating system · Built in India 🇮🇳
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['ERP login', '/login'], ['Roadmap', '/PaVaOs#phases'], ['Architecture', '/PaVaOs#pillars']].map(([label, href]) => (
            <a key={label} href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>{label}</a>
          ))}
        </div>
      </footer>

    </div>
  );
}

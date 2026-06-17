interface Action {
  label: string;
  href: string;
}

interface Props {
  icon?: string;
  heading: string;
  body: string;
  actions?: Action[];
}

export default function EmptyState({ icon = '🔍', heading, body, actions }: Props) {
  return (
    <div className="empty-state" style={{ padding: '72px 24px' }}>
      <div style={{ fontSize: '40px', marginBottom: '14px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', color: 'var(--ink)', marginBottom: '8px', fontWeight: 700 }}>{heading}</h3>
      <p style={{ fontSize: '14px', color: 'var(--ink-soft)', maxWidth: 340, margin: '0 auto' }}>{body}</p>
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px' }}>
          {actions.map((a, i) => (
            <a
              key={a.href}
              href={a.href}
              style={{
                padding: '9px 22px',
                borderRadius: '10px',
                border: i === 0 ? 'none' : '1.5px solid #e5e7eb',
                background: i === 0 ? 'var(--saffron, #C6853A)' : '#fff',
                color: i === 0 ? '#fff' : 'var(--ink)',
                fontWeight: 700,
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              {a.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

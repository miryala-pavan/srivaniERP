'use client';

// Root-level fallback for errors thrown in the root layout itself.
// Must render its own <html>/<body> because it replaces the whole tree.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #f1f1f1', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 6 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
              The application ran into an unexpected problem. Please try again.
            </p>
            <button
              onClick={() => reset()}
              style={{ padding: '8px 16px', background: '#1B4F8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

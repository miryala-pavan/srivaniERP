'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fdf6ec' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', textAlign: 'center',
          padding: '24px', gap: '16px',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="#D98324" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '14px', color: '#666', maxWidth: '300px', margin: 0 }}>
            We&apos;ve been notified and will fix this soon.
          </p>

          <button
            onClick={reset}
            style={{
              marginTop: '8px', padding: '12px 28px',
              background: '#D98324', color: '#fff',
              border: 'none', borderRadius: '12px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Try again
          </button>

          <a href="/" style={{ fontSize: '13px', color: '#D98324', textDecoration: 'underline' }}>
            Go to home
          </a>
        </div>
      </body>
    </html>
  );
}

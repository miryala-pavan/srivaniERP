'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
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
    <div className="wrap">
      <section
        className="sec"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--saffron)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ink)' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--ink-soft)', maxWidth: '320px' }}>
          We&apos;ve been notified and will look into this. Please try again.
        </p>

        <button
          onClick={reset}
          style={{
            marginTop: '8px',
            padding: '12px 28px',
            background: 'var(--saffron)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>

        <a
          href="/"
          style={{ fontSize: '13px', color: 'var(--saffron)', textDecoration: 'underline' }}
        >
          Go to home
        </a>
      </section>
    </div>
  );
}

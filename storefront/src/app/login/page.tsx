'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

function LoginContent() {
  const { user, isLoggedIn, isLoading, signIn, signOut } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get('redirect') ?? '/';

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-soft)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          aria-hidden="true" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>Checking your account…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isLoggedIn && user) {
    return (
      <div style={{ textAlign: 'center' }}>
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name}
            width={64}
            height={64}
            style={{ borderRadius: '50%', margin: '0 auto 16px', display: 'block' }}
          />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--saffron)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', fontWeight: 900, margin: '0 auto 16px',
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>
          Welcome, {user.name.split(' ')[0]}!
        </h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: '13px', marginBottom: '28px' }}>
          {user.email}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push(redirect === '/login' ? '/' : redirect)}
            title="Continue to where you were"
            style={{
              padding: '11px 28px', borderRadius: '10px',
              background: 'var(--saffron)', color: '#fff',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              border: 'none',
            }}
          >
            Continue →
          </button>
          <button
            onClick={() => signOut('/')}
            title="Sign out of your Google account"
            style={{
              padding: '11px 24px', borderRadius: '10px',
              border: '1.5px solid var(--line)', background: 'transparent',
              color: 'var(--ink-soft)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px', textAlign: 'center' }}>
        Sign In
      </h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: '14px', textAlign: 'center', marginBottom: '32px', lineHeight: 1.5 }}>
        Sign in to save your details, track orders, and checkout faster.
      </p>

      <button
        type="button"
        onClick={() => signIn(redirect)}
        title="Sign in with your Google account"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          width: '100%', padding: '13px 0', borderRadius: '12px',
          border: '1.5px solid var(--line)', background: '#fff',
          cursor: 'pointer', fontSize: '15px', fontWeight: 700, color: '#3c4043',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.14)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
      >
        <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continue with Google
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0 16px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>No account? Google handles it</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.6 }}>
        We only receive your name and email from Google.
        Your Google password is never shared with us.{' '}
        <Link href="/privacy" title="Read our privacy policy" style={{ color: 'var(--saffron-deep)' }}>
          Privacy Policy
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '48px', paddingBottom: '80px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: '400px',
          background: 'var(--paper-2)',
          borderRadius: '18px',
          border: '1px solid var(--line)',
          padding: '36px 32px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Image src="/logo.png" alt="Srivani Stores" width={48} height={48} style={{ objectFit: 'contain' }} />
          </div>
          <Suspense fallback={
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-soft)', fontSize: '14px' }}>
              Loading…
            </div>
          }>
            <LoginContent />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

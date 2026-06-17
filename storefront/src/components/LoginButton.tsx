'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

export default function LoginButton() {
  const { user, isLoggedIn, isLoading, signIn } = useAuth();
  const path = usePathname();

  if (isLoading) {
    return (
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: 'var(--line)', flexShrink: 0,
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    );
  }

  if (isLoggedIn && user) {
    return (
      <Link
        href="/account"
        title={`My account — ${user.name}`}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, textDecoration: 'none' }}
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name}
            width={32}
            height={32}
            style={{ borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--saffron)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 900, flexShrink: 0,
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-soft)', display: 'none' }}
          className="login-name">
          {user.name.split(' ')[0]}
        </span>
      </Link>
    );
  }

  return (
    <button
      onClick={() => signIn(path)}
      title="Sign in with your Google account"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '7px 14px', borderRadius: '9px',
        border: '1.5px solid var(--saffron)',
        color: 'var(--saffron)', background: 'transparent',
        fontSize: '13px', fontWeight: 700, cursor: 'pointer',
        flexShrink: 0, whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      Sign In
    </button>
  );
}

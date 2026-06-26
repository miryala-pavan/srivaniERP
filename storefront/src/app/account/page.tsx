'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';
import { useWishlist } from '@/context/WishlistContext';

export default function AccountPage() {
  const { user, isLoggedIn, isLoading, signOut } = useAuth();
  const { verifiedPhone, phoneReady } = useVerifiedPhone();
  const { count: wishlistCount } = useWishlist();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.replace('/login?redirect=/account');
  }, [isLoggedIn, isLoading, router]);

  if (isLoading || !phoneReady) return (
    <div className="wrap">
      <section className="sec" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" strokeWidth="2"
          style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    </div>
  );

  if (!isLoggedIn || !user) return null;

  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '40px', paddingBottom: '80px', maxWidth: '480px', margin: '0 auto' }}>

        {/* Avatar + name */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name}
              width={80}
              height={80}
              style={{ borderRadius: '50%', margin: '0 auto 14px', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--saffron)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', fontWeight: 900, margin: '0 auto 14px',
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>{user.name}</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>{user.email}</p>
        </div>

        {/* Orders card */}
        <Link href="/account/orders" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '18px 20px',
            background: 'var(--paper-2)',
            border: '1.5px solid var(--line)',
            borderRadius: '16px',
            marginBottom: '12px',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(217,131,36,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="var(--saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="M9 14l2 2 4-4"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px' }}>My Orders</div>
              <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>View order history and track deliveries</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </Link>

        {/* Favourites card */}
        <Link href="/favorites" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '18px 20px',
            background: 'var(--paper-2)',
            border: '1.5px solid var(--line)',
            borderRadius: '16px',
            marginBottom: '12px',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(239,68,68,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px' }}>Favourites</div>
              <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                {wishlistCount > 0 ? `${wishlistCount} saved item${wishlistCount !== 1 ? 's' : ''}` : 'Save items you want to buy later'}
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </Link>

        {/* Addresses card */}
        <Link href="/account/addresses" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '18px 20px',
            background: 'var(--paper-2)',
            border: '1.5px solid var(--line)',
            borderRadius: '16px',
            marginBottom: '12px',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(217,131,36,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="var(--saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px' }}>Saved Addresses</div>
              <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Manage delivery addresses for faster checkout</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </Link>

        {/* Phone card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '18px 20px',
          background: 'var(--paper-2)',
          border: '1.5px solid var(--line)',
          borderRadius: '16px',
          marginBottom: '12px',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: 'rgba(217,131,36,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="var(--saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.37a16 16 0 0 0 5.72 5.72l1.56-1.56a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 14.92z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px' }}>Mobile Number</div>
            {verifiedPhone ? (
              <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                +91 {verifiedPhone}
                <span style={{ marginLeft: '8px', color: 'var(--leaf)', fontWeight: 600, fontSize: '12px' }}>✓ Saved</span>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#ef4444' }}>Not set — required for orders</div>
            )}
          </div>
          <Link
            href="/account/settings"
            style={{
              fontSize: '12px', fontWeight: 700,
              color: 'var(--saffron)', textDecoration: 'none',
              padding: '6px 12px', borderRadius: '8px',
              border: '1.5px solid var(--saffron)',
              whiteSpace: 'nowrap',
            }}
          >
            {verifiedPhone ? 'Edit' : 'Add'}
          </Link>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut('/')}
          style={{
            width: '100%', padding: '13px', marginTop: '8px',
            borderRadius: '12px',
            border: '1.5px solid var(--line)',
            background: 'transparent',
            color: '#ef4444',
            fontSize: '14px', fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    </div>
  );
}

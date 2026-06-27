'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { upsertProfile } from '@/lib/profile';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';

const inp: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '15px',
  border: '1.5px solid var(--line)',
  borderRadius: '10px',
  background: 'var(--paper-2)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
};

function CompleteProfileContent() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const redirect      = searchParams.get('redirect') ?? '/';
  const { user, isLoggedIn, isLoading } = useAuth();
  const { profile, phoneReady } = useVerifiedPhone();

  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace(`/login?redirect=/complete-profile?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [isLoggedIn, isLoading, redirect, router]);

  // If profile already has phone, skip this page
  useEffect(() => {
    if (phoneReady && profile?.phone) {
      router.replace(redirect);
    }
  }, [phoneReady, profile, redirect, router]);

  // Pre-fill name from Google session
  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  async function handleSave() {
    const digits = phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter a valid 10-digit Indian mobile number (starting with 6-9)');
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your full name');
      return;
    }
    const altDigits = altPhone.replace(/\D/g, '');
    if (altDigits && !/^[6-9]\d{9}$/.test(altDigits)) {
      setError('Alternate number must be a valid 10-digit Indian mobile');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await upsertProfile({
        email:          user!.email,
        name:           name.trim(),
        phone:          digits,
        alternatePhone: altDigits || undefined,
        photoUrl:       user?.image ?? undefined,
      });
      router.push(redirect);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !phoneReady) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-soft)' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" strokeWidth="2"
        style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isLoggedIn) return null;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <Image src="/logo.png" alt="Srivani Stores" width={44} height={44} style={{ objectFit: 'contain' }} />
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 800, textAlign: 'center', marginBottom: '6px' }}>
        Complete Your Profile
      </h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: '13px', textAlign: 'center', marginBottom: '28px', lineHeight: 1.5 }}>
        We need a few details for delivery and order updates.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Name */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: '5px' }}>
            Full Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            style={inp}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
          />
        </div>

        {/* Phone */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: '5px' }}>
            Mobile Number <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '14px', color: 'var(--ink-soft)', fontWeight: 600, pointerEvents: 'none',
            }}>+91</span>
            <input
              style={{ ...inp, paddingLeft: '46px' }}
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              autoComplete="tel"
              onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
            Used for order updates and delivery. No verification needed.
          </p>
        </div>

        {/* Alternate Phone */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: '5px' }}>
            Alternate Number <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional)</span>
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '14px', color: 'var(--ink-soft)', fontWeight: 600, pointerEvents: 'none',
            }}>+91</span>
            <input
              style={{ ...inp, paddingLeft: '46px' }}
              type="tel"
              inputMode="numeric"
              value={altPhone}
              onChange={e => setAltPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Alternate number"
              autoComplete="tel"
            />
          </div>
        </div>

        {error && (
          <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: 500, margin: 0 }}>{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '13px 0', borderRadius: '11px', border: 'none',
            background: saving ? 'var(--line)' : 'var(--saffron)',
            color: saving ? 'var(--ink-soft)' : '#fff',
            fontSize: '15px', fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '4px',
          }}
        >
          {saving ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Saving…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Save &amp; Continue
            </>
          )}
        </button>

        <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.6 }}>
          Your number is only used for delivery coordination and order updates.
        </p>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

export default function CompleteProfilePage() {
  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '48px', paddingBottom: '80px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: '400px',
          background: 'var(--paper-2)',
          borderRadius: '18px',
          border: '1px solid var(--line)',
          padding: '36px 28px',
        }}>
          <Suspense fallback={
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-soft)' }}>Loading…</div>
          }>
            <CompleteProfileContent />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

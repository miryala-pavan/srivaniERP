'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { sendOTP, verifyOTP, resetOTP } from '@/lib/phone-auth';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';

const inp: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '16px',
  border: '1.5px solid var(--line)',
  borderRadius: '10px',
  background: 'var(--paper-2)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
  letterSpacing: '0.05em',
};

function friendlyError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const code = (e as any)?.code ?? '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg  = (e as any)?.message ?? String(e);
  if (code === 'auth/quota-exceeded')         return 'Daily SMS limit reached. Try again tomorrow.';
  if (code === 'auth/too-many-requests')       return 'Too many attempts. Please wait a few minutes and try again.';
  if (code === 'auth/invalid-phone-number')    return 'Invalid phone number. Please check and try again.';
  if (code === 'auth/code-expired')            return 'OTP expired. Please request a new one.';
  if (code === 'auth/invalid-verification-code') return 'Incorrect OTP. Please check and try again.';
  if (code === 'auth/missing-phone-number')    return 'Phone number is required.';
  if (code === 'auth/captcha-check-failed')    return 'Security check failed. Please refresh the page and try again.';
  if (msg.includes('reCAPTCHA'))               return 'Security check failed. Please refresh and try again.';
  return msg || 'Something went wrong. Please try again.';
}

function VerifyPhoneContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get('redirect') ?? '/';
  const { isLoggedIn, isLoading } = useAuth();
  const { verifiedPhone, phoneReady, refreshPhone } = useVerifiedPhone();

  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [step, setStep]     = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace(`/login?redirect=/verify-phone?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [isLoggedIn, isLoading, redirect, router]);

  useEffect(() => {
    if (phoneReady && verifiedPhone) router.replace(redirect);
  }, [verifiedPhone, phoneReady, redirect, router]);

  useEffect(() => () => { resetOTP(); }, []);

  function startCooldown() {
    setResendCooldown(60);
    timerRef.current = setInterval(() => {
      setResendCooldown(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSendOTP() {
    const digits = phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendOTP(digits, 'recaptcha-container');
      setStep('otp');
      startCooldown();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    const digits = otp.replace(/\D/g, '');
    if (digits.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setError('');
    setLoading(true);
    try {
      await verifyOTP(digits);
      refreshPhone();
      router.push(redirect);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    if (resendCooldown > 0) return;
    setOtp('');
    setError('');
    resetOTP();
    setStep('phone');
  }

  if (isLoading || !phoneReady) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-soft)' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      {/* Invisible reCAPTCHA mounts here — not visible to user */}
      <div id="recaptcha-container" style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }} />

      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(217,131,36,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 18px',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="var(--saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.37a16 16 0 0 0 5.72 5.72l1.56-1.56a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 14.92z"/>
        </svg>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 800, textAlign: 'center', marginBottom: '6px' }}>
        Verify Your Mobile
      </h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: '13px', textAlign: 'center', marginBottom: '28px', lineHeight: 1.5 }}>
        {step === 'phone'
          ? 'We need your mobile number for delivery and order updates.'
          : `OTP sent to +91 ${phone.replace(/\D/g, '')}. Check your messages.`}
      </p>

      {step === 'phone' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '14px', color: 'var(--ink-soft)', fontWeight: 600, pointerEvents: 'none',
            }}>
              +91
            </span>
            <input
              style={{ ...inp, paddingLeft: '46px' }}
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              autoComplete="tel"
              onKeyDown={e => e.key === 'Enter' && !loading && handleSendOTP()}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: 500, margin: 0 }}>{error}</p>
          )}

          <button
            onClick={handleSendOTP}
            disabled={loading}
            style={{
              padding: '13px 0', borderRadius: '11px', border: 'none',
              background: loading ? 'var(--line)' : 'var(--saffron)',
              color: loading ? 'var(--ink-soft)' : '#fff',
              fontSize: '15px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Sending…
              </>
            ) : 'Send OTP'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <input
              style={{ ...inp, textAlign: 'center', fontSize: '22px', fontWeight: 800, letterSpacing: '0.2em' }}
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="• • • • • •"
              autoComplete="one-time-code"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
            />
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textAlign: 'center', marginTop: '6px' }}>
              6-digit code sent via SMS
            </p>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: 500, margin: 0 }}>{error}</p>
          )}

          <button
            onClick={handleVerifyOTP}
            disabled={loading || otp.replace(/\D/g, '').length < 6}
            style={{
              padding: '13px 0', borderRadius: '11px', border: 'none',
              background: loading || otp.replace(/\D/g, '').length < 6 ? 'var(--line)' : 'var(--saffron)',
              color: loading || otp.replace(/\D/g, '').length < 6 ? 'var(--ink-soft)' : '#fff',
              fontSize: '15px', fontWeight: 700,
              cursor: loading || otp.replace(/\D/g, '').length < 6 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Verifying…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Verify &amp; Continue
              </>
            )}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => { setStep('phone'); setOtp(''); setError(''); resetOTP(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: '13px' }}
            >
              ← Change number
            </button>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              style={{
                background: 'none', border: 'none',
                cursor: resendCooldown > 0 ? 'default' : 'pointer',
                color: resendCooldown > 0 ? 'var(--ink-soft)' : 'var(--saffron)',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textAlign: 'center', marginTop: '20px', lineHeight: 1.6 }}>
        Standard SMS rates apply. Your number is used only for delivery and order updates.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default function VerifyPhonePage() {
  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '48px', paddingBottom: '80px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: '380px',
          background: 'var(--paper-2)',
          borderRadius: '18px',
          border: '1px solid var(--line)',
          padding: '36px 28px',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <Image src="/logo.png" alt="Srivani Stores" width={40} height={40} style={{ objectFit: 'contain' }} />
          </div>
          <Suspense fallback={
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-soft)' }}>Loading…</div>
          }>
            <VerifyPhoneContent />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

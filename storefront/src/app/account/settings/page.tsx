'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';
import { updateProfile } from '@/lib/profile';

const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  fontSize: '14px',
  border: '1.5px solid var(--line)',
  borderRadius: '10px',
  background: 'var(--paper-2)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function SettingsPage() {
  const { user, isLoggedIn, isLoading, signOut } = useAuth();
  const { verifiedPhone, altPhone, phoneReady, refreshPhone } = useVerifiedPhone();
  const router = useRouter();

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneVal,     setPhoneVal]     = useState('');
  const [altVal,       setAltVal]       = useState('');
  const [saving,       setSaving]       = useState(false);
  const [phoneError,   setPhoneError]   = useState('');

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.replace('/login?redirect=/account/settings');
  }, [isLoggedIn, isLoading, router]);

  function startEdit() {
    setPhoneVal(verifiedPhone ?? '');
    setAltVal(altPhone ?? '');
    setPhoneError('');
    setEditingPhone(true);
  }

  async function savePhone() {
    const digits = phoneVal.replace(/\D/g, '');
    if (digits && !/^[6-9]\d{9}$/.test(digits)) {
      setPhoneError('Enter a valid 10-digit number (starts with 6-9)');
      return;
    }
    const altDigits = altVal.replace(/\D/g, '');
    if (altDigits && !/^[6-9]\d{9}$/.test(altDigits)) {
      setPhoneError('Alternate number must be valid 10-digit mobile');
      return;
    }
    setPhoneError('');
    setSaving(true);
    try {
      await updateProfile(user!.email, {
        phone:          digits || '',
        alternatePhone: altDigits || '',
      });
      await refreshPhone();
      setEditingPhone(false);
    } catch {
      setPhoneError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !phoneReady) return (
    <div className="wrap">
      <section className="sec" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" strokeWidth="2"
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    </div>
  );

  if (!isLoggedIn || !user) return null;

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{
        background: 'var(--paper-2)', border: '1.5px solid var(--line)',
        borderRadius: '16px', overflow: 'hidden', marginBottom: '16px',
      }}>
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--line)',
          fontSize: '11px', fontWeight: 800, color: 'var(--ink-soft)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{title}</div>
        <div>{children}</div>
      </div>
    );
  }

  function Row({ label, value, action }: { label: string; value?: string; action?: React.ReactNode }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--line-2)', gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>{label}</div>
          {value && <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>{value}</div>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '28px', paddingBottom: '80px', maxWidth: '520px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <Link href="/account" style={{ color: 'var(--ink-soft)', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Settings</h1>
        </div>

        {/* Account */}
        <Section title="Account">
          <Row label="Name"  value={user.name} />
          <Row label="Email" value={user.email} />
          <Row
            label="Sign-in method"
            value="Google"
            action={
              <div style={{
                padding: '4px 10px', borderRadius: '8px',
                background: 'rgba(66,133,244,0.1)',
                fontSize: '11px', fontWeight: 700, color: '#1a73e8',
              }}>Connected</div>
            }
          />
        </Section>

        {/* Mobile numbers */}
        <Section title="Mobile Numbers">
          {!editingPhone ? (
            <>
              <Row
                label="Primary Number"
                value={verifiedPhone ? `+91 ${verifiedPhone}` : 'Not set'}
                action={
                  <button
                    onClick={startEdit}
                    style={{
                      padding: '7px 14px', borderRadius: '9px',
                      border: '1.5px solid var(--saffron)',
                      color: 'var(--saffron)', background: 'transparent',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {verifiedPhone ? 'Edit' : 'Add'}
                  </button>
                }
              />
              {altPhone && (
                <Row label="Alternate Number" value={`+91 ${altPhone}`} />
              )}
            </>
          ) : (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: '5px' }}>
                  Primary Number
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '13px', color: 'var(--ink-soft)', fontWeight: 600, pointerEvents: 'none',
                  }}>+91</span>
                  <input
                    style={{ ...inp, paddingLeft: '43px' }}
                    type="tel"
                    inputMode="numeric"
                    value={phoneVal}
                    onChange={e => setPhoneVal(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: '5px' }}>
                  Alternate Number <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '13px', color: 'var(--ink-soft)', fontWeight: 600, pointerEvents: 'none',
                  }}>+91</span>
                  <input
                    style={{ ...inp, paddingLeft: '43px' }}
                    type="tel"
                    inputMode="numeric"
                    value={altVal}
                    onChange={e => setAltVal(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Alternate number"
                  />
                </div>
              </div>
              {phoneError && (
                <p style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{phoneError}</p>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setEditingPhone(false)}
                  style={{
                    flex: 1, padding: '10px',
                    borderRadius: '9px', border: '1.5px solid var(--line)',
                    background: 'transparent', color: 'var(--ink-soft)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={savePhone}
                  disabled={saving}
                  style={{
                    flex: 2, padding: '10px',
                    borderRadius: '9px', border: 'none',
                    background: saving ? 'var(--line)' : 'var(--saffron)',
                    color: saving ? 'var(--ink-soft)' : '#fff',
                    fontSize: '13px', fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Numbers'}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Sign out */}
        <Section title="Session">
          <div style={{ padding: '16px 20px' }}>
            <button
              onClick={() => signOut('/')}
              style={{
                width: '100%', padding: '13px',
                borderRadius: '12px', border: '1.5px solid var(--line)',
                background: 'transparent', color: '#ef4444',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </Section>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    </div>
  );
}

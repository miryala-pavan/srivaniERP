'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';
import {
  fetchAddresses, createAddress, updateAddress,
  setDefaultAddress, deleteAddress,
  type SavedAddress, type CreateAddressPayload,
} from '@/lib/addresses';

const LABELS = ['Home', 'Work', 'Other'];

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', fontSize: '14px',
  border: '1.5px solid var(--line)', borderRadius: '10px',
  background: 'var(--paper-2)', color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
};

const emptyForm = { label: 'Home', line1: '', line2: '', city: 'Sangareddy', pincode: '502001', state: 'Telangana' };

export default function AddressesPage() {
  const { isLoggedIn, isLoading } = useAuth();
  const { verifiedPhone, phoneReady } = useVerifiedPhone();
  const router = useRouter();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.replace('/login?redirect=/account/addresses');
  }, [isLoggedIn, isLoading, router]);

  useEffect(() => {
    if (!phoneReady || !verifiedPhone) { setFetching(false); return; }
    fetchAddresses(verifiedPhone).then(setAddresses).finally(() => setFetching(false));
  }, [verifiedPhone, phoneReady]);

  function openAdd() { setForm(emptyForm); setEditId(null); setError(''); setShowForm(true); }
  function openEdit(a: SavedAddress) {
    setForm({ label: a.label, line1: a.line1, line2: a.line2 ?? '', city: a.city, pincode: a.pincode, state: a.state });
    setEditId(a.id); setError(''); setShowForm(true);
  }

  async function handleSave() {
    if (!verifiedPhone) return;
    if (form.line1.trim().length < 5) { setError('Address line 1 must be at least 5 characters'); return; }
    if (!/^\d{6}$/.test(form.pincode.trim())) { setError('Enter a valid 6-digit pincode'); return; }
    if (!form.city.trim()) { setError('City is required'); return; }
    setError(''); setSaving(true);
    try {
      if (editId) {
        const updated = await updateAddress(editId, verifiedPhone, {
          label: form.label, line1: form.line1.trim(), line2: form.line2.trim() || undefined,
          city: form.city.trim(), pincode: form.pincode.trim(), state: form.state.trim(),
        });
        setAddresses(prev => prev.map(a => a.id === editId ? updated : a));
      } else {
        const payload: CreateAddressPayload = {
          phone: verifiedPhone, label: form.label,
          line1: form.line1.trim(), line2: form.line2.trim() || undefined,
          city: form.city.trim(), pincode: form.pincode.trim(), state: form.state.trim(),
        };
        const created = await createAddress(payload);
        setAddresses(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    if (!verifiedPhone) return;
    const updated = await setDefaultAddress(id, verifiedPhone);
    setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === updated.id })));
  }

  async function handleDelete(id: string) {
    if (!verifiedPhone) return;
    if (!confirm('Remove this address?')) return;
    await deleteAddress(id, verifiedPhone);
    setAddresses(prev => {
      const remaining = prev.filter(a => a.id !== id);
      // if deleted was default, promote first remaining
      if (prev.find(a => a.id === id)?.isDefault && remaining.length > 0) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      return remaining;
    });
  }

  if (isLoading || !phoneReady || fetching) return (
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

  if (!isLoggedIn) return null;

  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '28px', paddingBottom: '80px', maxWidth: '560px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/account" style={{ color: 'var(--ink-soft)', display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </Link>
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Saved Addresses</h1>
          </div>
          {!showForm && verifiedPhone && (
            <button onClick={openAdd} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px',
              background: 'var(--saffron)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add
            </button>
          )}
        </div>

        {/* No phone */}
        {!verifiedPhone && (
          <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--paper-2)', border: '1.5px solid var(--line)', borderRadius: '16px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📱</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Verify your mobile number first</p>
            <Link href="/verify-phone?redirect=/account/addresses" style={{
              display: 'inline-block', padding: '10px 24px', background: 'var(--saffron)',
              color: '#fff', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            }}>Verify Phone</Link>
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div style={{ background: 'var(--paper-2)', border: '1.5px solid var(--saffron)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>
              {editId ? 'Edit Address' : 'New Address'}
            </h2>

            {/* Label pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {LABELS.map(l => (
                <button key={l} onClick={() => setForm(f => ({ ...f, label: l }))} style={{
                  padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
                  borderColor: form.label === l ? 'var(--saffron)' : 'var(--line)',
                  background: form.label === l ? 'rgba(217,131,36,0.08)' : 'transparent',
                  color: form.label === l ? 'var(--saffron)' : 'var(--ink-soft)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input style={inp} placeholder="Address line 1 — house/flat, street *"
                value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} />
              <input style={inp} placeholder="Address line 2 — landmark, area (optional)"
                value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input style={inp} placeholder="City *"
                  value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                <input style={inp} placeholder="Pincode *" inputMode="numeric" maxLength={6}
                  value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
              </div>
              <input style={inp} placeholder="State"
                value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '10px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={handleSave} disabled={saving} style={{
                flex: 1, padding: '11px', borderRadius: '10px', border: 'none',
                background: saving ? 'var(--line)' : 'var(--saffron)',
                color: saving ? 'var(--ink-soft)' : '#fff',
                fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving…' : 'Save Address'}
              </button>
              <button onClick={() => setShowForm(false)} style={{
                padding: '11px 18px', borderRadius: '10px',
                border: '1.5px solid var(--line)', background: 'transparent',
                color: 'var(--ink-soft)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {verifiedPhone && !showForm && addresses.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--paper-2)', border: '1.5px solid var(--line)', borderRadius: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
            <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>No saved addresses</p>
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '24px' }}>Save your delivery address for faster checkout.</p>
            <button onClick={openAdd} style={{
              padding: '10px 24px', background: 'var(--saffron)', color: '#fff',
              borderRadius: '10px', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer',
            }}>Add Address</button>
          </div>
        )}

        {/* Address list */}
        {addresses.map(addr => (
          <div key={addr.id} style={{
            background: 'var(--paper-2)',
            border: `1.5px solid ${addr.isDefault ? 'var(--saffron)' : 'var(--line)'}`,
            borderRadius: '16px', padding: '18px 20px', marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>{addr.label}</span>
                {addr.isDefault && (
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgba(217,131,36,0.12)', color: 'var(--saffron)' }}>
                    DEFAULT
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openEdit(addr)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-soft)', fontSize: '12px', fontWeight: 600, padding: '4px 8px',
                }}>Edit</button>
                <button onClick={() => handleDelete(addr.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ef4444', fontSize: '12px', fontWeight: 600, padding: '4px 8px',
                }}>Delete</button>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5, margin: '0 0 10px' }}>
              {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
              {addr.city} — {addr.pincode}, {addr.state}
            </p>
            {!addr.isDefault && (
              <button onClick={() => handleSetDefault(addr.id)} style={{
                background: 'none', border: '1px solid var(--line)', cursor: 'pointer',
                color: 'var(--saffron)', fontSize: '12px', fontWeight: 700,
                padding: '5px 12px', borderRadius: '8px',
              }}>Set as Default</button>
            )}
          </div>
        ))}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    </div>
  );
}

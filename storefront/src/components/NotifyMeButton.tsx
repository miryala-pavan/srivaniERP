'use client';

import { useState } from 'react';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

interface Props {
  pluBarcode: string;
  productName: string;
  packLabel: string;
}

export default function NotifyMeButton({ pluBarcode, productName, packLabel }: Props) {
  const { verifiedPhone } = useVerifiedPhone();
  const [state, setState] = useState<'idle' | 'open' | 'loading' | 'done' | 'error'>('idle');
  const [phone, setPhone] = useState(verifiedPhone ?? '');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setErrorMsg('Enter a valid 10-digit mobile number');
      return;
    }
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API}/stock-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluBarcode, productName, packLabel, phone: cleaned }),
      });
      if (!res.ok) throw new Error('Could not subscribe');
      setState('done');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div style={{
        padding: '8px 14px', borderRadius: '10px',
        background: '#d1fae5', color: '#065f46',
        fontSize: '13px', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}>
        ✓ We'll notify you when it's back!
      </div>
    );
  }

  if (state === 'idle') {
    return (
      <button
        onClick={() => setState('open')}
        style={{
          padding: '7px 14px', borderRadius: '10px',
          border: '1.5px solid var(--line)',
          background: 'var(--paper)', color: 'var(--ink-soft)',
          fontSize: '12px', fontWeight: 700, cursor: 'pointer',
        }}
      >
        🔔 Notify me
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
      <input
        type="tel"
        placeholder="Your mobile number"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        style={{
          padding: '8px 10px', borderRadius: '8px',
          border: '1.5px solid var(--line)',
          background: 'var(--paper)',
          fontSize: '13px', color: 'var(--ink)',
          outline: 'none',
        }}
        autoFocus
      />
      {errorMsg && (
        <p style={{ fontSize: '11px', color: '#ef4444', margin: 0 }}>{errorMsg}</p>
      )}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="submit"
          disabled={state === 'loading'}
          style={{
            flex: 1, padding: '8px 0', borderRadius: '8px',
            background: '#059669', color: '#fff',
            fontSize: '12px', fontWeight: 700, border: 'none',
            cursor: state === 'loading' ? 'not-allowed' : 'pointer',
            opacity: state === 'loading' ? 0.7 : 1,
          }}
        >
          {state === 'loading' ? '…' : 'Notify me'}
        </button>
        <button
          type="button"
          onClick={() => { setState('idle'); setErrorMsg(''); }}
          style={{
            padding: '8px 12px', borderRadius: '8px',
            background: 'transparent', color: 'var(--ink-soft)',
            fontSize: '12px', fontWeight: 700,
            border: '1.5px solid var(--line)', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

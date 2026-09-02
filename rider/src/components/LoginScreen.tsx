'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { setToken } from '@/lib/storage';

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      await api.post('/rider-auth/otp/request', { phone });
      setStep('code');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not send code — try again');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/rider-auth/otp/verify', { phone, code });
      await setToken(res.data.token);
      onLoggedIn();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Incorrect code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Srivani Rider</h1>
        <p className="mb-6 text-sm text-slate-500">
          {step === 'phone' ? 'Enter your registered mobile number' : `Code sent to ${phone}`}
        </p>

        {step === 'phone' ? (
          <>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg"
            />
            <button
              onClick={requestOtp}
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg tracking-widest"
            />
            <button
              onClick={verifyOtp}
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify & Login'}
            </button>
            <button onClick={() => setStep('phone')} className="mt-3 w-full text-sm text-slate-500">
              Change number
            </button>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

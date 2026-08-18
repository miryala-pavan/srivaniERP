'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchProfile, updateProfile, type StorefrontProfile } from '@/lib/profile';
import { getVerifiedPhone, clearStorefrontAuth } from '@/lib/storefront-auth';

export function useVerifiedPhone() {
  const { user } = useAuth();
  const [profile,    setProfile]    = useState<StorefrontProfile | null>(null);
  const [phoneReady, setPhoneReady] = useState(false);
  // Sourced from the OTP-verified token, NOT from profile.phone — a phone
  // sitting in the profile record proves nothing about who typed it in.
  const [verifiedPhone, setVerifiedPhoneState] = useState<string | null>(null);

  const load = useCallback(async () => {
    setVerifiedPhoneState(getVerifiedPhone());
    if (!user?.email) { setPhoneReady(true); return; }
    const p = await fetchProfile(user.email);
    setProfile(p);
    setPhoneReady(true);
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  async function clearPhone() {
    // Must clear the profile's phone WHILE still authenticated — the
    // storefront-profile endpoint is now guarded, so it needs the token to
    // still be present for this call, not cleared beforehand.
    if (user?.email) {
      await updateProfile(user.email, { phone: '', alternatePhone: '' });
      setProfile(prev => prev ? { ...prev, phone: null, alternatePhone: null } : null);
    }
    clearStorefrontAuth();
    setVerifiedPhoneState(null);
  }

  return {
    verifiedPhone,
    altPhone: profile?.alternatePhone ?? null,
    profile,
    phoneReady,
    refreshPhone: load,
    clearPhone,
  };
}

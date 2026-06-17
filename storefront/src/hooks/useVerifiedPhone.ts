'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchProfile, updateProfile, type StorefrontProfile } from '@/lib/profile';

export function useVerifiedPhone() {
  const { user } = useAuth();
  const [profile,    setProfile]    = useState<StorefrontProfile | null>(null);
  const [phoneReady, setPhoneReady] = useState(false);

  const load = useCallback(async () => {
    if (!user?.email) { setPhoneReady(true); return; }
    const p = await fetchProfile(user.email);
    setProfile(p);
    setPhoneReady(true);
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  async function clearPhone() {
    if (!user?.email) return;
    await updateProfile(user.email, { phone: '', alternatePhone: '' });
    setProfile(prev => prev ? { ...prev, phone: null, alternatePhone: null } : null);
  }

  return {
    verifiedPhone:  profile?.phone          ?? null,
    altPhone:       profile?.alternatePhone ?? null,
    profile,
    phoneReady,
    refreshPhone:   load,
    clearPhone,
  };
}

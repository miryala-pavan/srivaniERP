'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { beep, getAudioContext } from '@/lib/beep';

const MUTE_KEY = 'wa_sound_muted';

export function isWaSoundMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setWaSoundMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {}
}

// Mounted once, globally (dashboard/layout.tsx) so a WhatsApp reply sound
// plays no matter which page staff currently have open — unlike the visible
// mute toggle in WhatsAppChat.tsx's header, this component renders nothing.
export default function WaSoundAlert() {
  const audioRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isWaSoundMuted());
    function onStorage(e: StorageEvent) {
      if (e.key === MUTE_KEY) setMuted(isWaSoundMuted());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleMessage = useCallback((data: { direction?: string }) => {
    if (data?.direction !== 'INBOUND') return;
    if (isWaSoundMuted()) return;
    try { beep(getAudioContext(audioRef)); } catch {}
  }, []);

  useWebSocketEvent('wa.message.received', handleMessage);

  return null;
}

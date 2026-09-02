'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import api from '@/lib/api';
import { getToken, clearToken } from '@/lib/storage';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { MeResponse } from '@/lib/types';
import LoginScreen from './LoginScreen';
import OffersFeed from './OffersFeed';
import ActiveDeliveryScreen from './ActiveDeliveryScreen';

type View = 'loading' | 'login' | 'ready';

export default function RiderApp() {
  const [view, setView] = useState<View>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const loadMe = useCallback(async () => {
    const res = await api.get<MeResponse>('/rider/me');
    setMe(res.data);
  }, []);

  const bootstrap = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setView('login');
      return;
    }
    try {
      await loadMe();
      setSocket(await connectSocket());
      setView('ready');
    } catch {
      await clearToken();
      setView('login');
    }
  }, [loadMe]);

  useEffect(() => {
    bootstrap();
    return () => disconnectSocket();
  }, [bootstrap]);

  // Refresh /rider/me whenever an assignment-affecting event lands, so the
  // app flips between the offers feed and the active-delivery screen live.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => loadMe();
    socket.on('delivery.assigned', refresh);
    socket.on('delivery.delivered', refresh);
    socket.on('delivery.cancelled', refresh);
    return () => {
      socket.off('delivery.assigned', refresh);
      socket.off('delivery.delivered', refresh);
      socket.off('delivery.cancelled', refresh);
    };
  }, [socket, loadMe]);

  if (view === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  if (view === 'login' || !me) {
    return (
      <LoginScreen
        onLoggedIn={async () => {
          await loadMe();
          setSocket(await connectSocket());
          setView('ready');
        }}
      />
    );
  }

  if (me.activeDelivery) {
    return <ActiveDeliveryScreen delivery={me.activeDelivery} onFinished={loadMe} />;
  }

  return <OffersFeed rider={me.rider} socket={socket} onAccepted={loadMe} />;
}

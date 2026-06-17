'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WSContext {
  socket: Socket | null;
  connected: boolean;
}

const WebSocketContext = createContext<WSContext>({ socket: null, connected: false });

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('srivani_token');
    if (!token) return;

    const s = io(process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4001/events', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect', () => {
      console.log('[WS] connected', s.id);
      setConnected(true);
    });
    s.on('disconnect', () => {
      console.log('[WS] disconnected');
      setConnected(false);
    });
    s.on('connect_error', (err) => {
      console.error('[WS] error:', err.message);
    });

    setSocket(s);

    return () => { s.disconnect(); };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, connected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}

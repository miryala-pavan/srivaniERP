'use client';

import { useEffect } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';

export function useWebSocketEvent<T = any>(event: string, handler: (data: T) => void) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [socket, event, handler]);
}

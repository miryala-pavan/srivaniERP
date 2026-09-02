import { io, Socket } from 'socket.io-client';
import { getToken } from './storage';

let socket: Socket | null = null;

// Same /events namespace and auth-handshake shape as frontend's
// WebSocketProvider — the rider-JWT branch in EventsGateway.handleConnection
// (backend/src/events/events.gateway.ts) authenticates this exact payload.
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await getToken();
  socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/events`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

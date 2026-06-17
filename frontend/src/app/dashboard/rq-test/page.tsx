'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/providers/WebSocketProvider';

interface EventEntry {
  event: string;
  data: any;
  time: string;
}

export default function RqTestPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['rq-test-business'],
    queryFn: async () => {
      const token = localStorage.getItem('srivani_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/business`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      return res.json();
    },
  });

  const { socket, connected } = useWebSocket();
  const [log, setLog] = useState<EventEntry[]>([]);

  useEffect(() => {
    if (!socket) return;
    const handler = (event: string, data: any) => {
      setLog((prev) =>
        [{ event, data, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10),
      );
    };
    socket.onAny(handler);
    return () => { socket.offAny(handler); };
  }, [socket]);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold mb-6">React Query + WebSocket Smoke Test</h1>

      {/* React Query section */}
      <section className="mb-8">
        <h2 className="font-semibold text-gray-700 mb-2">React Query — /api/business</h2>
        {isLoading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-600">Error: {String(error)}</p>}
        {data && (
          <pre className="p-4 bg-gray-100 rounded text-xs overflow-auto max-h-48">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </section>

      {/* WebSocket section */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-2">WebSocket — Live Events</h2>

        <div className="flex items-center gap-2 mb-4">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className={`text-sm font-medium ${connected ? 'text-green-700' : 'text-red-700'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          Open another tab → <strong>/dashboard/products</strong> → edit any product → save → event appears below within 1s
        </div>

        {log.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No events yet — trigger one using the instructions above.</p>
        ) : (
          <ul className="space-y-2">
            {log.map((entry, i) => (
              <li key={i} className="p-3 bg-white border rounded text-xs font-mono shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-indigo-700">{entry.event}</span>
                  <span className="text-gray-400">{entry.time}</span>
                </div>
                <pre className="text-gray-600 overflow-auto">{JSON.stringify(entry.data, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

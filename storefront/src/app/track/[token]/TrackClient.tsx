'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { io, type Socket } from 'socket.io-client';

const TrackingMap = dynamic(() => import('@/components/TrackingMap'), { ssr: false });

const API = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api').replace(/\/api$/, '');

export interface TrackData {
  status: 'BROADCASTING' | 'ASSIGNED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  customerName: string;
  deliveryLat: number;
  deliveryLng: number;
  rider: { name: string; phone: string; vehicleType: string | null; vehicleNumber: string | null; lastLat: number | null; lastLng: number | null } | null;
  deliveredAt: string | null;
  photos: { imageUrl: string; capturedAt: string }[];
  photosExpireAt: string | null;
}

export default function TrackClient({ token, initialData }: { token: string; initialData: TrackData }) {
  const [data, setData] = useState(initialData);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(
    initialData.rider?.lastLat != null && initialData.rider?.lastLng != null
      ? { lat: initialData.rider.lastLat, lng: initialData.rider.lastLng }
      : null,
  );

  // Live updates while the delivery is still in flight — read-only token
  // handshake, no login needed (see EventsGateway's deliveryToken branch).
  useEffect(() => {
    if (data.status !== 'BROADCASTING' && data.status !== 'ASSIGNED') return;

    // forceNew avoids socket.io-client's default connection-multiplexing
    // (reusing one Manager per URI+options) — under React 18 Strict Mode's
    // dev-only double-invoke of effects, the first (cleanup-cancelled)
    // socket can otherwise leave the shared Manager in a state where every
    // subsequent reconnect attempt keeps failing silently. Allowing the
    // polling transport as a fallback (not websocket-only) is also more
    // resilient to restrictive network intermediaries in general.
    const socket: Socket = io(`${API}/events`, {
      auth: { deliveryToken: token },
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

    const refetch = () => {
      fetch(`${API}/api/track/${token}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((next) => next && setData(next))
        .catch(() => {});
    };

    socket.on('delivery.assigned', refetch);
    socket.on('delivery.delivered', refetch);
    socket.on('delivery.failed', refetch);
    socket.on('delivery.cancelled', refetch);
    socket.on('delivery.location_update', (payload: { lat: number; lng: number }) => {
      setRiderPos({ lat: payload.lat, lng: payload.lng });
    });

    return () => { socket.disconnect(); };
  }, [token, data.status]);

  if (data.status === 'DELIVERED') return <DeliveredView data={data} />;
  if (data.status === 'FAILED' || data.status === 'CANCELLED') return <StoppedView status={data.status} />;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white">
      <div className="h-72 w-full">
        <TrackingMap
          customerLat={data.deliveryLat}
          customerLng={data.deliveryLng}
          riderLat={riderPos?.lat}
          riderLng={riderPos?.lng}
        />
      </div>
      <div className="space-y-4 p-4">
        {data.status === 'BROADCASTING' && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            Finding a delivery rider for your order — we&apos;ll update this page as soon as one accepts.
          </div>
        )}
        {data.status === 'ASSIGNED' && data.rider && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">{data.rider.name} is on the way 🛵</p>
            {data.rider.vehicleNumber && (
              <p className="mt-1 text-sm text-slate-500">
                {data.rider.vehicleType ?? 'Vehicle'} — {data.rider.vehicleNumber}
              </p>
            )}
            <a
              href={`tel:${data.rider.phone}`}
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              📞 Call rider
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveredView({ data }: { data: TrackData }) {
  const expiresText = data.photosExpireAt
    ? new Date(data.photosExpireAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white p-4">
      <div className="rounded-xl bg-green-50 p-4 text-center">
        <p className="text-lg font-bold text-green-800">Delivered ✅</p>
        {data.deliveredAt && (
          <p className="mt-1 text-sm text-green-700">
            {new Date(data.deliveredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>

      {data.photos.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">Delivery photos</p>
          {expiresText && (
            <p className="mb-3 text-xs text-amber-700">
              These photos will be removed on {expiresText} — save them now if you&apos;d like to keep them.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {data.photos.map((p) => (
              <div key={p.imageUrl} className="space-y-1">
                <img src={p.imageUrl} alt="Delivery" className="aspect-square w-full rounded-lg object-cover" />
                <a
                  href={p.imageUrl}
                  download
                  className="block text-center text-xs font-medium text-blue-600"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StoppedView({ status }: { status: 'FAILED' | 'CANCELLED' }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6 text-center">
      <p className="text-slate-600">
        {status === 'CANCELLED'
          ? 'This delivery was cancelled.'
          : "This delivery couldn't be completed — please contact us for help."}
      </p>
    </div>
  );
}

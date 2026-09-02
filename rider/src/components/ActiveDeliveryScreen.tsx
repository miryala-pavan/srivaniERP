'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { startWatching, acquireWakeLock, releaseWakeLock } from '@/lib/location';
import ConfirmDeliveryScreen from './ConfirmDeliveryScreen';
import type { Delivery } from '@/lib/types';

// Leaflet touches `window` at import time — must never run during Next's
// static-export prerender pass, hence ssr:false.
const DeliveryMap = dynamic(() => import('./DeliveryMap'), { ssr: false });

export default function ActiveDeliveryScreen({
  delivery, onFinished,
}: {
  delivery: Delivery;
  onFinished: () => void;
}) {
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    acquireWakeLock();
    const stop = startWatching((coords) => {
      setRiderPos(coords);
      api.post(`/rider/deliveries/${delivery.id}/location`, coords).catch(() => {});
    });
    return () => {
      stop();
      releaseWakeLock();
    };
  }, [delivery.id]);

  if (confirming) {
    return (
      <ConfirmDeliveryScreen
        delivery={delivery}
        onBack={() => setConfirming(false)}
        onDone={onFinished}
      />
    );
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${delivery.deliveryLat},${delivery.deliveryLng}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="h-64 shrink-0">
        <DeliveryMap
          customerLat={delivery.deliveryLat}
          customerLng={delivery.deliveryLng}
          riderLat={riderPos?.lat}
          riderLng={riderPos?.lng}
        />
      </div>

      <div className="flex-1 space-y-4 p-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-slate-900">{delivery.customer?.name ?? 'Customer'}</p>
          {delivery.deliveryAddressText && <p className="mt-1 text-sm text-slate-600">{delivery.deliveryAddressText}</p>}
          {delivery.codAmount != null && (
            <p className="mt-1 text-sm font-medium text-orange-600">COD — collect ₹{delivery.codAmount}</p>
          )}
        </div>

        <div className="flex gap-2">
          {delivery.customer?.phone && (
            <a
              href={`tel:${delivery.customer.phone}`}
              className="flex-1 rounded-lg bg-slate-100 py-3 text-center font-semibold text-slate-700"
            >
              📞 Call
            </a>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-lg bg-slate-100 py-3 text-center font-semibold text-slate-700"
          >
            🧭 Navigate
          </a>
        </div>

        <button
          onClick={() => setConfirming(true)}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white"
        >
          Deliver
        </button>
      </div>
    </div>
  );
}

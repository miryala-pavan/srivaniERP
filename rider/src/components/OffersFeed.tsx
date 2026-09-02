'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import api from '@/lib/api';
import type { DeliveryOffer, RiderProfile } from '@/lib/types';

export default function OffersFeed({
  rider, socket, onAccepted,
}: {
  rider: RiderProfile;
  socket: Socket | null;
  onAccepted: () => void;
}) {
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [status, setStatus] = useState(rider.status);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<DeliveryOffer[]>('/rider/offers');
    setOffers(res.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onBroadcast = () => load();
    const onExpired = (payload: { deliveryId: string }) => {
      setOffers((prev) => prev.filter((o) => o.deliveryId !== payload.deliveryId));
    };
    socket.on('delivery.broadcast', onBroadcast);
    socket.on('delivery.offer_expired', onExpired);
    return () => {
      socket.off('delivery.broadcast', onBroadcast);
      socket.off('delivery.offer_expired', onExpired);
    };
  }, [socket, load]);

  async function toggleStatus() {
    const next = status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    setStatus(next);
    try {
      await api.patch('/rider/status', { status: next });
    } catch {
      setStatus(status); // revert on failure
    }
  }

  async function accept(deliveryId: string) {
    setError(null);
    setBusyOfferId(deliveryId);
    try {
      await api.post(`/rider/offers/${deliveryId}/accept`);
      onAccepted();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'This delivery was already taken');
      setOffers((prev) => prev.filter((o) => o.deliveryId !== deliveryId));
    } finally {
      setBusyOfferId(null);
    }
  }

  async function decline(deliveryId: string) {
    setBusyOfferId(deliveryId);
    try {
      await api.post(`/rider/offers/${deliveryId}/decline`);
      setOffers((prev) => prev.filter((o) => o.deliveryId !== deliveryId));
    } finally {
      setBusyOfferId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 py-4 shadow-sm">
        <div>
          <p className="font-semibold text-slate-900">{rider.name}</p>
          <p className="text-xs text-slate-500">{rider.phone}</p>
        </div>
        <button
          onClick={toggleStatus}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {status === 'AVAILABLE' ? '🟢 Available' : '⚪ Offline'}
        </button>
      </div>

      {error && <p className="mx-4 mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 space-y-3 px-4">
        {status !== 'AVAILABLE' && (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            You're offline — go available to start receiving deliveries.
          </p>
        )}
        {status === 'AVAILABLE' && offers.length === 0 && (
          <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            Waiting for new deliveries…
          </p>
        )}
        {offers.map((offer) => (
          <div key={offer.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-900">
              {offer.delivery.deliveryAddressText ?? 'Delivery near you'}
            </p>
            {offer.delivery.codAmount != null && (
              <p className="mt-1 text-sm font-medium text-orange-600">
                COD — collect ₹{offer.delivery.codAmount}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => accept(offer.deliveryId)}
                disabled={busyOfferId === offer.deliveryId}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => decline(offer.deliveryId)}
                disabled={busyOfferId === offer.deliveryId}
                className="flex-1 rounded-lg bg-slate-100 py-2.5 font-semibold text-slate-600 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

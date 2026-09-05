'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import MapsLinkInput from '@/components/maps/MapsLinkInput';

const PinPicker = dynamic(() => import('@/components/maps/PinPicker'), { ssr: false });

interface RecentPlace {
  id: string;
  lat: number;
  lng: number;
  label: string | null;
}

/**
 * "Dispatch to Rider" — reads the customer + captured checkout pin straight
 * off the order (createDeliveryFromOnlineOrder on the backend does the
 * actual resolve-or-create-customer + broadcast); only asks staff to drop a
 * pin manually for orders placed before that capture existed. Extracted
 * from the order detail page so the orders LIST page can open the same
 * flow without a full page navigation first (see DispatchToRiderModal
 * below for the list page's modal wrapper).
 */
export function DispatchToRiderSection({
  orderId, customerPhone, lat, lng, onDispatched,
}: {
  orderId: string;
  customerPhone: string;
  lat?: number;
  lng?: number;
  onDispatched?: (deliveryId: string) => void;
}) {
  const router = useRouter();
  const [manualCoords, setManualCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [needsPin, setNeedsPin] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['delivery-for-order', orderId],
    queryFn: () => api.get('/deliveries', { params: { onlineOrderId: orderId, limit: 1 } })
      .then((r) => r.data?.rows?.[0] ?? null),
  });

  // Known locations for this customer — checkout/search picks, and any pin
  // they've shared over WhatsApp. Shown as quick-picks regardless of
  // whether checkout already captured a pin, since staff may know a
  // WhatsApp-shared one is more current.
  const { data: recentPlaces } = useQuery({
    queryKey: ['recent-places-staff', customerPhone],
    queryFn: () => api.get<RecentPlace[]>('/geocoding/recent-places/staff', { params: { phone: customerPhone } }).then((r) => r.data),
    enabled: !!customerPhone,
  });

  const dispatchMutation = useMutation({
    mutationFn: () => api.post(`/deliveries/from-online-order/${orderId}`, manualCoords ?? {}).then((r) => r.data),
    onSuccess: (delivery) => {
      toast.success('Broadcast to available riders');
      if (onDispatched) onDispatched(delivery.id);
      else router.push(`/dashboard/deliveries/${delivery.id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Could not dispatch';
      if (msg.includes('No delivery location captured')) setNeedsPin(true);
      else toast.error(msg);
    },
  });

  if (existing) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => router.push(`/dashboard/deliveries/${existing.id}`)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <span className="font-medium text-gray-700">Delivery: {existing.status}</span>
          <span className="text-[#1B4F8A] text-xs">View →</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      {recentPlaces && recentPlaces.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Known locations for this customer:</p>
          <div className="flex flex-wrap gap-1.5">
            {recentPlaces.map((p) => (
              <button
                key={p.id}
                onClick={() => { setManualCoords({ lat: p.lat, lng: p.lng }); setNeedsPin(true); }}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border max-w-[220px] truncate ${
                  manualCoords?.lat === p.lat && manualCoords?.lng === p.lng
                    ? 'border-[#1B4F8A] bg-[#1B4F8A]/10 text-[#1B4F8A]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                title={p.label ?? undefined}
              >
                📍 {p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
              </button>
            ))}
          </div>
        </div>
      )}
      <MapsLinkInput onResolve={(coords) => { setManualCoords(coords); setNeedsPin(true); }} />
      {needsPin && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Drag to fine-tune the exact spot:</p>
          <div className="h-40 rounded-lg overflow-hidden border border-gray-200">
            <PinPicker
              lat={manualCoords?.lat ?? lat ?? 17.6274}
              lng={manualCoords?.lng ?? lng ?? 78.0982}
              onMove={setManualCoords}
              label="Delivery location"
            />
          </div>
        </div>
      )}
      <button
        onClick={() => dispatchMutation.mutate()}
        disabled={dispatchMutation.isPending || (needsPin && !manualCoords)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e] disabled:opacity-50"
      >
        🛵 {dispatchMutation.isPending ? 'Dispatching…' : 'Dispatch to Rider'}
      </button>
    </div>
  );
}

/** Modal wrapper around DispatchToRiderSection — used from the orders LIST page, which has no natural inline spot for it. */
export default function DispatchToRiderModal({
  orderId, orderNumber, customerPhone, lat, lng, onClose,
}: {
  orderId: string;
  orderNumber: string;
  customerPhone: string;
  lat?: number;
  lng?: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-800">Dispatch to Rider — {orderNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <DispatchToRiderSection
          orderId={orderId}
          customerPhone={customerPhone}
          lat={lat}
          lng={lng}
          onDispatched={onClose}
        />
      </div>
    </div>
  );
}

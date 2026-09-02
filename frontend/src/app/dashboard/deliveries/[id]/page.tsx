'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Phone, Truck, XCircle, Image as ImageIcon } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';

const PinPicker = dynamic(() => import('@/components/maps/PinPicker'), { ssr: false });

interface DeliveryDetail {
  id: string;
  status: 'BROADCASTING' | 'ASSIGNED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddressText: string | null;
  codAmount: number | string | null;
  cashCollectedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  deliveredAt: string | null;
  customer: { name: string; phone: string | null };
  assignedTo: { name: string; phone: string; vehicleNumber: string | null } | null;
  events: { id: string; type: string; meta: any; createdAt: string }[];
  photos: { id: string; imageUrl: string }[];
}

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [assignRider, setAssignRider] = useState('');

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => api.get(`/deliveries/${id}`).then((r) => r.data as DeliveryDetail),
  });

  const { data: riders } = useQuery({
    queryKey: ['delivery-boys', 'active'],
    queryFn: () => api.get('/delivery-boys').then((r) => r.data.filter((b: any) => b.active)),
    enabled: delivery?.status === 'BROADCASTING',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['delivery', id] });
  useWebSocketEvent('delivery.broadcast', invalidate);
  useWebSocketEvent('delivery.assigned', invalidate);
  useWebSocketEvent('delivery.escalated', invalidate);
  useWebSocketEvent('delivery.delivered', invalidate);
  useWebSocketEvent('delivery.failed', invalidate);
  useWebSocketEvent('delivery.cancelled', invalidate);

  const manualAssignMutation = useMutation({
    mutationFn: () => api.post(`/deliveries/${id}/manual-assign`, { deliveryBoyId: assignRider }),
    onSuccess: () => { toast.success('Assigned'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Could not assign'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/deliveries/${id}/cancel`),
    onSuccess: () => { toast.success('Delivery cancelled'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Could not cancel'),
  });

  if (isLoading || !delivery) {
    return (
      <>
        <Header title="Delivery" />
        <main className="flex-1 p-6"><p className="text-gray-400 text-sm">Loading…</p></main>
      </>
    );
  }

  const canCancel = !['DELIVERED', 'CANCELLED', 'FAILED'].includes(delivery.status);

  return (
    <>
      <Header title={`Delivery — ${delivery.customer.name}`} />
      <main className="flex-1 p-6 space-y-4 max-w-3xl">
        <button onClick={() => router.push('/dashboard/deliveries')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Deliveries
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">{delivery.customer.name}</p>
              <p className="text-sm text-gray-400">{delivery.customer.phone}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#1B4F8A]">{delivery.status}</span>
          </div>
          {delivery.deliveryAddressText && <p className="text-sm text-gray-600">{delivery.deliveryAddressText}</p>}
          {delivery.codAmount != null && (
            <p className="text-sm font-medium text-orange-600">
              COD ₹{delivery.codAmount} {delivery.cashCollectedAt ? '— collected' : '— pending'}
            </p>
          )}
          {delivery.failedReason && <p className="text-sm text-red-600">Failed: {delivery.failedReason}</p>}
        </div>

        <div className="h-64 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <PinPicker lat={delivery.deliveryLat} lng={delivery.deliveryLng} draggable={false} label="Delivery location" />
        </div>

        {delivery.assignedTo && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Rider</h3>
            <p className="font-medium text-gray-900">{delivery.assignedTo.name}</p>
            {delivery.assignedTo.vehicleNumber && <p className="text-xs text-gray-400">{delivery.assignedTo.vehicleNumber}</p>}
            <a href={`tel:${delivery.assignedTo.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#1B4F8A] hover:underline">
              <Phone className="w-3.5 h-3.5" /> {delivery.assignedTo.phone}
            </a>
          </div>
        )}

        {delivery.status === 'BROADCASTING' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Manually assign a rider</h3>
            <div className="flex gap-2">
              <select value={assignRider} onChange={(e) => setAssignRider(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
                <option value="">Select a rider…</option>
                {(riders ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name} ({r.status})</option>)}
              </select>
              <button
                onClick={() => manualAssignMutation.mutate()}
                disabled={!assignRider || manualAssignMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e] disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {delivery.photos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> Delivery photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {delivery.photos.map((p) => (
                <a key={p.id} href={p.imageUrl} target="_blank" rel="noreferrer">
                  <img src={p.imageUrl} alt="Delivery proof" className="aspect-square w-full rounded-lg object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h3>
          <ul className="space-y-2">
            {delivery.events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="text-gray-400 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="text-gray-700">{e.type}</span>
              </li>
            ))}
          </ul>
        </div>

        {canCancel && (
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Cancel Delivery
          </button>
        )}
      </main>
    </>
  );
}

import type { Metadata } from 'next';
import { fetchOrder } from '@/lib/orders';
import ConfirmDeliveryClient from './ConfirmDeliveryClient';

export const metadata: Metadata = {
  title: 'Confirm Delivery — Srivani Stores',
  robots: { index: false },
};

export default async function ConfirmDeliveryPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await fetchOrder(orderNumber);
  return <ConfirmDeliveryClient order={order} orderNumber={orderNumber} />;
}

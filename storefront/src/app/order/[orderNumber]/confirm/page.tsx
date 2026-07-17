import type { Metadata } from 'next';
import { fetchOrder } from '@/lib/orders';
import ConfirmDeliveryClient from './ConfirmDeliveryClient';

export const metadata: Metadata = {
  title: 'Confirm Delivery — Srivani Stores',
  robots: { index: false },
};

export default async function ConfirmDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { orderNumber } = await params;
  const { phone } = await searchParams;
  const order = phone ? await fetchOrder(orderNumber, phone) : null;
  return <ConfirmDeliveryClient order={order} orderNumber={orderNumber} />;
}

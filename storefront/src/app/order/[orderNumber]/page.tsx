import type { Metadata } from 'next';
import { fetchOrder } from '@/lib/orders';
import OrderStatusClient from './OrderStatusClient';

export const metadata: Metadata = {
  title: 'Order Confirmation — Srivani Stores',
  robots: { index: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { orderNumber } = await params;
  const { phone } = await searchParams;
  const order = phone ? await fetchOrder(orderNumber, phone) : null;
  return <OrderStatusClient order={order} orderNumber={orderNumber} />;
}

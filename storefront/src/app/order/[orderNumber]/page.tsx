import type { Metadata } from 'next';
import { fetchOrder } from '@/lib/orders';
import OrderStatusClient from './OrderStatusClient';

export const metadata: Metadata = {
  title: 'Order Confirmation — Srivani Stores',
  robots: { index: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await fetchOrder(orderNumber);
  return <OrderStatusClient order={order} orderNumber={orderNumber} />;
}

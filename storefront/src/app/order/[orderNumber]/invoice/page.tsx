import type { Metadata } from 'next';
import { fetchOrder } from '@/lib/orders';
import InvoiceClient from './InvoiceClient';

export const metadata: Metadata = {
  title: 'Invoice — Srivani Stores',
  robots: { index: false },
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await fetchOrder(orderNumber);
  return <InvoiceClient order={order} orderNumber={orderNumber} />;
}

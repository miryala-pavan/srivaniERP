import type { Metadata } from 'next';
import { fetchOrder } from '@/lib/orders';
import InvoiceClient from './InvoiceClient';

export const metadata: Metadata = {
  title: 'Invoice — Srivani Stores',
  robots: { index: false },
};

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { orderNumber } = await params;
  const { phone } = await searchParams;
  const order = phone ? await fetchOrder(orderNumber, phone) : null;
  return <InvoiceClient order={order} orderNumber={orderNumber} />;
}

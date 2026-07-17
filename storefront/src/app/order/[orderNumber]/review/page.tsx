import type { Metadata } from 'next';
import { fetchOrder } from '@/lib/orders';
import { getOrderReviewStatus } from '@/lib/reviews';
import ReviewClient from './ReviewClient';

export const metadata: Metadata = {
  title: 'Rate Your Order — Srivani Stores',
  robots: { index: false },
};

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { orderNumber } = await params;
  const { phone } = await searchParams;
  const [order, reviewStatus] = await Promise.all([
    phone ? fetchOrder(orderNumber, phone) : Promise.resolve(null),
    getOrderReviewStatus(orderNumber),
  ]);
  return (
    <ReviewClient
      order={order}
      orderNumber={orderNumber}
      reviewedProductCodes={reviewStatus.reviewedProductCodes}
    />
  );
}

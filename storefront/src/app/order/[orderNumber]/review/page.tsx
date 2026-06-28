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
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [order, reviewStatus] = await Promise.all([
    fetchOrder(orderNumber),
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

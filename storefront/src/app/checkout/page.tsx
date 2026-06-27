export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import CheckoutClient from './CheckoutClient';

export const metadata: Metadata = {
  title: 'Checkout — Srivani Stores',
  robots: { index: false },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}

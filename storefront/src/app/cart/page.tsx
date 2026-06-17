import type { Metadata } from 'next';
import CartPageClient from './CartPageClient';

export const metadata: Metadata = {
  title: 'Your Cart — Srivani Stores',
};

export default function CartPage() {
  return <CartPageClient />;
}

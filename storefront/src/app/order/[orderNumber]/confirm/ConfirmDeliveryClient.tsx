'use client';

import { useState } from 'react';
import Link from 'next/link';
import { confirmDelivery } from '@/lib/orders';
import type { OnlineOrder } from '@/lib/orders';

type Props = {
  order: OnlineOrder | null;
  orderNumber: string;
};

export default function ConfirmDeliveryClient({ order, orderNumber }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">&#128269;</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Order Not Found</h1>
          <p className="text-gray-500 text-sm mb-6">We couldn't find order <span className="font-mono font-semibold">{orderNumber}</span>.</p>
          <Link href="/" className="inline-block bg-green-700 text-white font-semibold px-6 py-3 rounded-xl text-sm">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  if (order.status === 'DELIVERED' || state === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">&#127881;</div>
          <h1 className="text-2xl font-bold text-green-700 mb-2">Thank you!</h1>
          <p className="text-gray-600 text-sm mb-1">Delivery confirmed for</p>
          <p className="font-mono font-semibold text-gray-800 mb-6">{orderNumber}</p>
          <p className="text-gray-500 text-sm mb-4">We're glad your order reached you safely!</p>
          <Link href={`/order/${orderNumber}/review`} className="block w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-6 py-3 rounded-xl text-sm mb-3">
            ⭐ Rate Your Items
          </Link>
          <Link href={`/order/${orderNumber}`} className="inline-block bg-green-700 text-white font-semibold px-6 py-3 rounded-xl text-sm mr-2">
            View Order
          </Link>
          <Link href="/" className="inline-block border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl text-sm">
            Shop Again
          </Link>
        </div>
      </div>
    );
  }

  if (!['READY'].includes(order.status)) {
    const notReadyMsg =
      order.status === 'CANCELLED' ? 'This order has been cancelled.' :
      order.status === 'PENDING_COD' || order.status === 'PENDING_PAYMENT' ? "Your order hasn't been dispatched yet." :
      order.status === 'CONFIRMED' || order.status === 'PROCESSING' ? "Your order is being prepared and hasn't left our store yet." :
      "This order isn't currently out for delivery.";

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">&#8987;</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Not Yet Dispatched</h1>
          <p className="text-gray-500 text-sm mb-6">{notReadyMsg}</p>
          <Link href={`/order/${orderNumber}`} className="inline-block bg-green-700 text-white font-semibold px-6 py-3 rounded-xl text-sm">
            Track Order
          </Link>
        </div>
      </div>
    );
  }

  async function handleConfirm() {
    setState('loading');
    try {
      await confirmDelivery(orderNumber);
      setState('done');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.');
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">&#128663;</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Delivered?</h1>
        <p className="text-gray-500 text-sm mb-1">Confirm receipt for</p>
        <p className="font-mono font-semibold text-gray-800 mb-6">{orderNumber}</p>

        <p className="text-gray-600 text-sm mb-6">
          Did you receive all the items from your Srivani Stores order?
        </p>

        {state === 'error' && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3 mb-4">{errorMsg}</p>
        )}

        <button
          onClick={handleConfirm}
          disabled={state === 'loading'}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-bold text-base py-4 rounded-xl transition-colors mb-3"
        >
          {state === 'loading' ? 'Confirming…' : '✓ Yes, I received my order'}
        </button>

        <a
          href={`https://wa.me/919382828484?text=Hi%2C+I+have+an+issue+with+order+${orderNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-green-700 font-medium py-2"
        >
          Problem with delivery? WhatsApp us
        </a>
      </div>
    </div>
  );
}

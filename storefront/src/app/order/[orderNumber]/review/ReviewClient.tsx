'use client';

import { useState } from 'react';
import Link from 'next/link';
import { submitReviews } from '@/lib/reviews';
import type { OnlineOrder } from '@/lib/orders';

type Props = {
  order: OnlineOrder | null;
  orderNumber: string;
  reviewedProductCodes: string[];
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-3xl transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${n} star`}
        >
          <span className={(hover || value) >= n ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  );
}

const SENTIMENT_LABELS: Record<number, string> = {
  1: 'Very bad',
  2: 'Not great',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent!',
};

export default function ReviewClient({ order, orderNumber, reviewedProductCodes }: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <p className="text-gray-500 mb-4">Order not found.</p>
          <Link href="/" className="text-green-700 font-semibold">Back to shop</Link>
        </div>
      </div>
    );
  }

  if (order.status !== 'DELIVERED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">⏳</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Not delivered yet</h1>
          <p className="text-gray-500 text-sm mb-6">You can rate your items once the order is delivered.</p>
          <Link href={`/order/${orderNumber}`} className="inline-block bg-green-700 text-white font-semibold px-6 py-3 rounded-xl text-sm">
            Track Order
          </Link>
        </div>
      </div>
    );
  }

  const unreviewedItems = order.items.filter(i => !reviewedProductCodes.includes(i.id));
  const itemsToReview = unreviewedItems.length > 0 ? unreviewedItems : order.items;
  const allAlreadyReviewed = reviewedProductCodes.length >= order.items.length && unreviewedItems.length === 0;

  if (state === 'done' || allAlreadyReviewed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-2xl font-bold text-green-700 mb-2">Thank you!</h1>
          <p className="text-gray-600 text-sm mb-6">
            Your reviews help other shoppers and help us serve you better.
          </p>
          <a
            href="https://g.page/r/CXZY6ACcJig_EAE/review"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-500 text-white font-semibold px-5 py-3 rounded-xl text-sm mr-2"
          >
            ⭐ Google Review
          </a>
          <Link href="/" className="inline-block border border-gray-300 text-gray-700 font-semibold px-5 py-3 rounded-xl text-sm">
            Shop Again
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const toSubmit = itemsToReview
      .filter(i => ratings[i.id] > 0)
      .map(i => ({
        productCode: i.id,
        productName: i.productName,
        packLabel: i.packLabel,
        rating: ratings[i.id],
        comment: comments[i.id]?.trim() || undefined,
      }));

    if (!toSubmit.length) {
      setErrorMsg('Please rate at least one item.');
      setState('error');
      return;
    }

    setState('loading');
    try {
      await submitReviews(orderNumber, toSubmit);
      setState('done');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.');
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⭐</div>
          <h1 className="text-2xl font-bold text-gray-800">Rate your order</h1>
          <p className="text-gray-500 text-sm mt-1 font-mono">{orderNumber}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {itemsToReview.map(item => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm p-5">
              <p className="font-semibold text-gray-800 text-sm">{item.productName}</p>
              <p className="text-gray-400 text-xs mb-3">{item.packLabel} × {item.quantity}</p>

              <StarPicker
                value={ratings[item.id] ?? 0}
                onChange={v => setRatings(prev => ({ ...prev, [item.id]: v }))}
              />
              {ratings[item.id] > 0 && (
                <p className="text-xs text-green-700 font-medium mt-1">
                  {SENTIMENT_LABELS[ratings[item.id]]}
                </p>
              )}

              <textarea
                value={comments[item.id] ?? ''}
                onChange={e => setComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="Add a comment (optional)…"
                rows={2}
                className="mt-3 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-green-500"
              />
            </div>
          ))}

          {state === 'error' && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={state === 'loading'}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-bold text-base py-4 rounded-xl transition-colors"
          >
            {state === 'loading' ? 'Submitting…' : 'Submit Reviews'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Your feedback helps us improve and helps other customers shop better.
          </p>
        </form>
      </div>
    </div>
  );
}

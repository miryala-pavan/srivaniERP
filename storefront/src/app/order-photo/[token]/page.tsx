import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

const API = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api').replace(/\/api$/, '');

interface OrderSummary {
  label: string;
  status: string;
  total: number;
  items: { name: string; qty: number }[];
}

interface OrderPhotoData {
  customerName: string;
  imageUrl: string;
  caption: string | null;
  order: OrderSummary | null;
}

async function fetchOrderPhoto(token: string): Promise<OrderPhotoData | null> {
  try {
    const res = await fetch(`${API}/api/order-photos/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchOrderPhoto(token);
  if (!data) return { title: 'Order Photo' };
  return {
    title: `${data.order?.label ?? 'Your Order'} — Photo`,
    description: 'Order photo shared with you',
    robots: { index: false, follow: false },
  };
}

export default async function OrderPhotoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchOrderPhoto(token);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <img
          src={data.imageUrl}
          alt={data.caption ?? 'Order photo'}
          className="w-full h-auto object-cover"
        />
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500">Hi {data.customerName || 'there'}, here's your order:</p>
          {data.caption && <p className="text-sm text-gray-700">{data.caption}</p>}

          {data.order && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{data.order.label}</p>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                  {data.order.status}
                </span>
              </div>
              {data.order.items.length > 0 && (
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {data.order.items.slice(0, 8).map((item, i) => (
                    <li key={i}>{item.qty} × {item.name}</li>
                  ))}
                  {data.order.items.length > 8 && (
                    <li>+{data.order.items.length - 8} more item{data.order.items.length - 8 === 1 ? '' : 's'}</li>
                  )}
                </ul>
              )}
              <p className="text-sm font-semibold text-gray-900 pt-1 border-t border-gray-200">
                Total: ₹{data.order.total.toFixed(0)}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

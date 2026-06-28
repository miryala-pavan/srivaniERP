const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

export interface ReviewItem {
  productCode: string;
  productName: string;
  packLabel: string;
  rating: number;
  comment?: string;
}

export interface ProductReview {
  customerName: string;
  rating: number;
  comment: string | null;
  sentiment: string | null;
  createdAt: string;
}

export interface ProductReviewSummary {
  avg: number;
  count: number;
  reviews: ProductReview[];
}

export async function submitReviews(orderNumber: string, reviews: ReviewItem[]): Promise<{ success: boolean; submitted: number }> {
  const res = await fetch(`${API}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber, reviews }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? 'Failed to submit reviews');
  }
  return res.json();
}

export async function getOrderReviewStatus(orderNumber: string): Promise<{ reviewedProductCodes: string[] }> {
  try {
    const res = await fetch(`${API}/reviews/order/${orderNumber}/status`, { cache: 'no-store' });
    if (!res.ok) return { reviewedProductCodes: [] };
    return res.json();
  } catch {
    return { reviewedProductCodes: [] };
  }
}

export async function getProductReviews(productCode: string): Promise<ProductReviewSummary> {
  try {
    const res = await fetch(`${API}/reviews/product/${productCode}`, { cache: 'no-store' });
    if (!res.ok) return { avg: 0, count: 0, reviews: [] };
    return res.json();
  } catch {
    return { avg: 0, count: 0, reviews: [] };
  }
}

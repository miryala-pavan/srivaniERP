import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import HistoryClient from './HistoryClient';

const JUNK_RE = /^(delivery|deliveries|deliv|customer|customers|cust|apna|chotu|aab|shop|stores?|home|house|order)$/i;
function cleanName(raw: string): string {
  const words = raw.trim().split(/\s+/);
  const filtered = words.filter(w => !JUNK_RE.test(w));
  return (filtered.length ? filtered : words).join(' ');
}

const API = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api').replace(/\/api$/, '');

interface Entry {
  id: string;
  entryDate: string;
  pageCount: number;
  source: string;
  imageUrls: string[];
}

interface HistoryData {
  customer: { name: string; phone: string | null };
  entries: Entry[];
}

async function fetchHistory(token: string): Promise<HistoryData | null> {
  try {
    const res = await fetch(`${API}/api/history/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchHistory(token);
  if (!data) return { title: 'History — Srivani Stores' };
  return {
    title: `${cleanName(data.customer.name)}'s History — Srivani Stores`,
    description: `Personal shopping history at Srivani Stores`,
    robots: { index: false, follow: false },
  };
}

export default async function HistoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchHistory(token);
  if (!data) notFound();
  return <HistoryClient data={data} />;
}

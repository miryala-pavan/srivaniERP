import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import TrackClient, { type TrackData } from './TrackClient';

const API = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api').replace(/\/api$/, '');

async function fetchTrack(token: string): Promise<TrackData | null> {
  try {
    const res = await fetch(`${API}/api/track/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchTrack(token);
  if (!data) return { title: 'Track your delivery — Srivani Stores' };
  return {
    title: `${data.customerName || 'Your'} delivery — Srivani Stores`,
    description: 'Live delivery tracking',
    robots: { index: false, follow: false },
  };
}

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchTrack(token);
  if (!data) notFound();
  return <TrackClient token={token} initialData={data} />;
}

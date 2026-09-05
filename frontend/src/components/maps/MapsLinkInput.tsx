'use client';

import { useState } from 'react';
import { resolveMapsLink } from '@/lib/geocoding';

/** Paste-a-Google-Maps-link box — same contract as storefront's MapsLinkInput, Tailwind-styled to match this app. */
export default function MapsLinkInput({
  onResolve,
}: {
  onResolve: (result: { lat: number; lng: number }) => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function useLink() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    const resolved = await resolveMapsLink(url.trim());
    setLoading(false);
    if (!resolved) {
      setError("Couldn't read a location from that link — check it's a Google Maps link");
      return;
    }
    onResolve(resolved);
    setUrl('');
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Or paste a Google Maps link"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
        />
        <button
          type="button"
          onClick={useLink}
          disabled={loading || !url.trim()}
          className="px-3 py-2 text-xs font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e] disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Reading…' : 'Use link'}
        </button>
      </div>
      {error && <p className="text-xs text-amber-600">{error}</p>}
    </div>
  );
}

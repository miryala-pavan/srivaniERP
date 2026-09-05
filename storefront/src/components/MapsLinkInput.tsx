'use client';

import { useState } from 'react';
import { resolveMapsLink } from '../lib/geocoding';

/**
 * Paste-a-Google-Maps-link box — customers share locations this way far
 * more often than via the search box or a GPS fix. A shortened link
 * (maps.app.goo.gl) is resolved server-side (see GeocodingService.resolveMapsLink);
 * a long-form link is parsed instantly.
 */
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Or paste a Google Maps link"
          style={{
            flex: 1, padding: '10px 13px', fontSize: '14px',
            border: '1.5px solid var(--line)', borderRadius: '10px',
            background: 'var(--paper-2)', color: 'var(--ink)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={useLink}
          disabled={loading || !url.trim()}
          style={{
            padding: '10px 16px', fontSize: '13px', fontWeight: 700,
            border: 'none', borderRadius: '10px', cursor: 'pointer',
            background: 'var(--saffron)', color: '#fff',
            opacity: loading || !url.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Reading…' : 'Use link'}
        </button>
      </div>
      {error && <p style={{ fontSize: '11px', color: '#d97706', margin: 0 }}>{error}</p>}
    </div>
  );
}

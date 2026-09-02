'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import PlaceSearchBox from './PlaceSearchBox';
import { fetchRecentPlaces, type RecentPlace } from '../lib/geocoding';

// Leaflet touches `window` at import time — must never run during SSR/build.
const DraggablePinMap = dynamic(() => import('./DraggablePinMap'), { ssr: false });

/**
 * Optional "share my exact drop pin" step for checkout's home-delivery
 * branch. Entirely opt-in — declining or a browser block still lets
 * checkout proceed with just the postal address, same as before this
 * existed. Raw GPS at a shop counter is commonly 20-50m off in dense areas,
 * so once a reading comes back the customer can drag the pin to correct it
 * before it's saved. Styled inline to match CheckoutClient.tsx's own
 * convention (CSS-variable design tokens, not Tailwind, in this one page).
 */
export default function LocationPicker({
  onChange,
}: {
  onChange: (coords: { lat: number; lng: number } | null) => void;
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<RecentPlace[]>([]);

  // Silently a no-op if the customer hasn't verified their phone yet —
  // fetchRecentPlaces() returns [] rather than throwing in that case.
  useEffect(() => { fetchRecentPlaces().then(setRecent); }, []);

  function usePlace(next: { lat: number; lng: number }) {
    setCoords(next);
    setStatus('ready');
    onChange(next);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('error');
      setError('Location is not available on this device');
      return;
    }
    setStatus('locating');
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        setStatus('ready');
        onChange(next);
      },
      () => {
        setStatus('error');
        setError("Could not get your location — check location permission, or skip this and we'll use your typed address");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function clear() {
    setCoords(null);
    setStatus('idle');
    onChange(null);
  }

  return (
    <div style={{ border: '1.5px solid var(--line)', borderRadius: '10px', padding: '12px', background: 'var(--paper-2)' }}>
      {status !== 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <PlaceSearchBox onSelect={(r) => usePlace({ lat: r.lat, lng: r.lng })} />

          {recent.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {recent.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => usePlace({ lat: p.lat, lng: p.lng })}
                  style={{
                    padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--ink)',
                    background: 'var(--paper)', border: '1.5px solid var(--line)', borderRadius: '999px',
                    cursor: 'pointer', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={p.label ?? undefined}
                >
                  📍 {p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={status === 'locating'}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, color: '#2563eb',
              opacity: status === 'locating' ? 0.5 : 1, alignSelf: 'flex-start',
            }}
          >
            {status === 'locating' ? 'Getting your location…' : '📍 Or use my current location'}
          </button>
        </div>
      )}

      {status === 'ready' && coords && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '11px', color: 'var(--ink-soft)', margin: 0 }}>
            Drag the pin if it&apos;s not quite right — this helps our delivery rider find you exactly.
          </p>
          <div style={{ height: '192px', width: '100%', overflow: 'hidden', borderRadius: '8px' }}>
            <DraggablePinMap
              lat={coords.lat}
              lng={coords.lng}
              onMove={(next) => { setCoords(next); onChange(next); }}
            />
          </div>
          <button
            type="button"
            onClick={clear}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', color: 'var(--ink-soft)', textDecoration: 'underline', alignSelf: 'flex-start' }}
          >
            Remove pin
          </button>
        </div>
      )}

      {status === 'error' && <p style={{ marginTop: '4px', fontSize: '11px', color: '#d97706' }}>{error}</p>}
    </div>
  );
}

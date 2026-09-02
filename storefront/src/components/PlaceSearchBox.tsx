'use client';

import { useEffect, useRef, useState } from 'react';
import { searchPlaces, resolvePlace, type PlaceSuggestion } from '../lib/geocoding';

/**
 * Debounced place-name search box — the piece that was missing entirely
 * before this: LocationPicker previously only offered "use my GPS" + drag,
 * with no way to type a place name and jump to it. Selecting a suggestion
 * fires the same {lat,lng} shape LocationPicker already hands to its parent,
 * so nothing downstream needs to change.
 */
export default function PlaceSearchBox({
  onSelect,
  placeholder = 'Search for your area, landmark, or address',
}: {
  onSelect: (result: { lat: number; lng: number; label: string }) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchPlaces(query);
      setSuggestions(results);
      setOpen(true);
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function pick(s: PlaceSuggestion) {
    setQuery(s.mainText ?? s.description);
    setOpen(false);
    // Ola's autocomplete already includes coordinates — only Google needs a
    // second call to resolve a placeId into lat/lng.
    if (s.lat != null && s.lng != null) {
      onSelect({ lat: s.lat, lng: s.lng, label: s.description });
      return;
    }
    setResolving(s.placeId);
    const resolved = await resolvePlace(s.placeId, s.provider);
    setResolving(null);
    if (resolved) onSelect({ lat: resolved.lat, lng: resolved.lng, label: resolved.formattedAddress ?? s.description });
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 13px', fontSize: '14px',
          border: '1.5px solid var(--line)', borderRadius: '10px',
          background: 'var(--paper-2)', color: 'var(--ink)',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {loading && (
        <span style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--ink-soft)' }}>
          …
        </span>
      )}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
          background: 'var(--paper-2)', border: '1.5px solid var(--line)', borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto',
        }}>
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s)}
              disabled={resolving === s.placeId}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 13px',
                background: 'none', border: 'none', borderBottom: '1px solid var(--line)',
                cursor: 'pointer', opacity: resolving === s.placeId ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', display: 'block' }}>
                {s.mainText ?? s.description}
              </span>
              {s.secondaryText && (
                <span style={{ fontSize: '11px', color: 'var(--ink-soft)', display: 'block', marginTop: '2px' }}>
                  {s.secondaryText}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

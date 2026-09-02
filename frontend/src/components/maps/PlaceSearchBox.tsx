'use client';

import { useEffect, useRef, useState } from 'react';
import { searchPlaces, resolvePlace, type PlaceSuggestion } from '@/lib/geocoding';

/** Debounced place search — same contract as storefront's PlaceSearchBox, Tailwind-styled to match this app. */
export default function PlaceSearchBox({
  onSelect,
  placeholder = 'Search for an address or landmark',
}: {
  onSelect: (result: { lat: number; lng: number; label: string }) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setSuggestions(results);
      setOpen(true);
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
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s)}
              disabled={resolving === s.placeId}
              className="block w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="block text-sm font-semibold text-gray-800">{s.mainText ?? s.description}</span>
              {s.secondaryText && <span className="block text-xs text-gray-400 mt-0.5">{s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useRef } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L, { type Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icons reference image files via relative paths
// that break under bundlers — point at unpkg's CDN copies instead of
// vendoring the PNGs (same workaround the rider app's map uses).
const pinIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

export default function DraggablePinMap({
  lat, lng, onMove,
}: {
  lat: number; lng: number; onMove: (coords: { lat: number; lng: number }) => void;
}) {
  const markerRef = useRef<LeafletMarker | null>(null);

  return (
    <MapContainer center={[lat, lng]} zoom={17} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[lat, lng]}
        icon={pinIcon}
        draggable
        ref={markerRef}
        eventHandlers={{
          dragend: () => {
            const m = markerRef.current;
            if (!m) return;
            const pos = m.getLatLng();
            onMove({ lat: pos.lat, lng: pos.lng });
          },
        }}
      />
    </MapContainer>
  );
}

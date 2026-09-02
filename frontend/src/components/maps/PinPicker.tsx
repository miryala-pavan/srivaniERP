'use client';

import { useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { type Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Same OpenStreetMap-tiles, no-API-key approach as the rider app's
// DeliveryMap and storefront's DraggablePinMap — duplicated per-app rather
// than shared (frontend/storefront/rider have no shared package today).
const pinIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

export default function PinPicker({
  lat, lng, onMove, draggable = true, label,
}: {
  lat: number;
  lng: number;
  onMove?: (coords: { lat: number; lng: number }) => void;
  draggable?: boolean;
  label?: string;
}) {
  const markerRef = useRef<LeafletMarker | null>(null);

  return (
    <MapContainer center={[lat, lng]} zoom={16} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[lat, lng]}
        icon={pinIcon}
        draggable={draggable}
        ref={markerRef}
        eventHandlers={draggable ? {
          dragend: () => {
            const m = markerRef.current;
            if (!m || !onMove) return;
            const pos = m.getLatLng();
            onMove({ lat: pos.lat, lng: pos.lng });
          },
        } : undefined}
      >
        {label && <Popup>{label}</Popup>}
      </Marker>
    </MapContainer>
  );
}

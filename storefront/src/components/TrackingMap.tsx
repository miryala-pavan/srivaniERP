'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const customerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

// Same OpenStreetMap-tiles, no-API-key approach as the rider app's
// DeliveryMap — duplicated here rather than shared since storefront/rider
// are separate Next.js projects with no shared package today (matches the
// existing convention of small per-app duplication in this monorepo).
export default function TrackingMap({
  customerLat, customerLng, riderLat, riderLng,
}: {
  customerLat: number; customerLng: number; riderLat?: number | null; riderLng?: number | null;
}) {
  return (
    <MapContainer center={[customerLat, customerLng]} zoom={15} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[customerLat, customerLng]} icon={customerIcon}>
        <Popup>Delivery address</Popup>
      </Marker>
      {riderLat != null && riderLng != null && (
        <Marker position={[riderLat, riderLng]} icon={customerIcon}>
          <Popup>Your delivery rider</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

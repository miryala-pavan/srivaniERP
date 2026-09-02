'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icons reference image files via relative paths
// that break under bundlers — point them at unpkg's CDN copies instead of
// vendoring the PNGs, same workaround every react-leaflet project needs.
const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

export default function DeliveryMap({
  customerLat, customerLng, riderLat, riderLng,
}: {
  customerLat: number; customerLng: number; riderLat?: number | null; riderLng?: number | null;
}) {
  return (
    <MapContainer
      center={[customerLat, customerLng]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      // OpenStreetMap tiles — free, no API key, no vendor lock-in (see plan).
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[customerLat, customerLng]} icon={riderIcon}>
        <Popup>Delivery address</Popup>
      </Marker>
      {riderLat != null && riderLng != null && (
        <Marker position={[riderLat, riderLng]} icon={riderIcon}>
          <Popup>You</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

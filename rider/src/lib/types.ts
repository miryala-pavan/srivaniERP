export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  status: 'OFFLINE' | 'AVAILABLE' | 'BUSY';
}

export interface Delivery {
  id: string;
  status: 'BROADCASTING' | 'ASSIGNED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddressText: string | null;
  codAmount: number | null;
  otpVerifiedAt: string | null;
  customer?: { name: string; phone: string | null };
}

export interface DeliveryOffer {
  id: string;
  deliveryId: string;
  round: number;
  createdAt: string;
  delivery: Delivery;
}

export interface MeResponse {
  rider: RiderProfile;
  activeDelivery: (Delivery & { assignedAt: string | null }) | null;
}

export interface UploadedPhoto {
  id: string;
  token: string;
  imageUrl: string;
  expiresAt: string;
}

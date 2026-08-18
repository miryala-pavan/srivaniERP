import { authHeader } from './storefront-auth';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

export interface SavedAddress {
  id: string;
  phone: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  state: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateAddressPayload {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  state?: string;
  isDefault?: boolean;
}

export interface UpdateAddressPayload {
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  pincode?: string;
  state?: string;
}

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...authHeader(), ...opts?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

// The address always belongs to whichever phone the caller verified — never
// a phone passed in from here, the backend derives it from the auth token.
export function fetchAddresses(): Promise<SavedAddress[]> {
  return req(`${API}/addresses`);
}

export function createAddress(payload: CreateAddressPayload): Promise<SavedAddress> {
  return req(`${API}/addresses`, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateAddress(id: string, payload: UpdateAddressPayload): Promise<SavedAddress> {
  return req(`${API}/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function setDefaultAddress(id: string): Promise<SavedAddress> {
  return req(`${API}/addresses/${id}/default`, { method: 'PATCH', body: '{}' });
}

export function deleteAddress(id: string): Promise<{ success: boolean }> {
  return req(`${API}/addresses/${id}`, { method: 'DELETE' });
}

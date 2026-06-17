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
  phone: string;
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
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

export function fetchAddresses(phone: string): Promise<SavedAddress[]> {
  return req(`${API}/addresses?phone=${encodeURIComponent(phone)}`);
}

export function createAddress(payload: CreateAddressPayload): Promise<SavedAddress> {
  return req(`${API}/addresses`, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateAddress(id: string, phone: string, payload: UpdateAddressPayload): Promise<SavedAddress> {
  return req(`${API}/addresses/${id}?phone=${encodeURIComponent(phone)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function setDefaultAddress(id: string, phone: string): Promise<SavedAddress> {
  return req(`${API}/addresses/${id}/default?phone=${encodeURIComponent(phone)}`, { method: 'PATCH', body: '{}' });
}

export function deleteAddress(id: string, phone: string): Promise<{ success: boolean }> {
  return req(`${API}/addresses/${id}?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' });
}

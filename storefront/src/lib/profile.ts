const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

export interface StorefrontProfile {
  id:             string;
  email:          string;
  name:           string;
  phone:          string | null;
  alternatePhone: string | null;
  photoUrl:       string | null;
}

export async function fetchProfile(email: string): Promise<StorefrontProfile | null> {
  try {
    const res = await fetch(
      `${API}/storefront-profile?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function upsertProfile(data: {
  email: string;
  name: string;
  phone?: string;
  alternatePhone?: string;
  photoUrl?: string;
}): Promise<StorefrontProfile> {
  const res = await fetch(`${API}/storefront-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to save profile');
  }
  return res.json();
}

export async function updateProfile(
  email: string,
  data: { name?: string; phone?: string; alternatePhone?: string },
): Promise<StorefrontProfile> {
  const res = await fetch(
    `${API}/storefront-profile?email=${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to update profile');
  }
  return res.json();
}

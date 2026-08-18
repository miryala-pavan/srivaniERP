// Real phone verification via WhatsApp OTP (backend-issued, signed session
// token) — replaces the old Firebase SMS flow, which only ever wrote to
// localStorage and never told the backend anything, so nothing downstream
// ever actually checked it.

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';
const TOKEN_KEY = 'svn_storefront_token';
const PHONE_KEY = 'svn_storefront_phone';

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Request failed');
    throw new Error(msg);
  }
  return res.json();
}

export async function requestOtp(phone: string): Promise<void> {
  await req(`${API}/storefront-auth/otp/request`, { method: 'POST', body: JSON.stringify({ phone }) });
}

export async function verifyOtp(phone: string, code: string): Promise<string> {
  const { token } = await req<{ token: string; phone: string }>(`${API}/storefront-auth/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PHONE_KEY, phone);
  return phone;
}

export function getStorefrontToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getVerifiedPhone(): string | null {
  if (typeof window === 'undefined') return null;
  // A phone with no token isn't verified — only trust the pair together.
  return localStorage.getItem(TOKEN_KEY) ? localStorage.getItem(PHONE_KEY) : null;
}

export function clearStorefrontAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PHONE_KEY);
}

/** Auth header for any request to a StorefrontJwtGuard-protected route. Throws if not verified. */
export function authHeader(): Record<string, string> {
  const token = getStorefrontToken();
  if (!token) throw new Error('Phone verification required — please verify your number first');
  return { Authorization: `Bearer ${token}` };
}

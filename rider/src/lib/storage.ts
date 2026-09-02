import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// One of the two swap-points the Capacitor upgrade plan calls for — the rest
// of the app just calls these three functions and never touches
// localStorage/@capacitor/preferences directly.
const TOKEN_KEY = 'srivani_rider_token';

export async function getToken(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value;
  }
  return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  } else if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export async function clearToken(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key: TOKEN_KEY });
  } else if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

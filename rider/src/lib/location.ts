import { Capacitor } from '@capacitor/core';

export interface Coords {
  lat: number;
  lng: number;
}

// The other swap-point the Capacitor upgrade plan calls for. Web branch
// (navigator.geolocation) only tracks while this tab/app is foregrounded —
// that's a hard platform limit, not a bug here (see the plan's "Why
// Capacitor" section). The native branch is a placeholder until a
// background-geolocation Capacitor plugin is installed and wired once
// Android build tooling is available; the interface below won't need to
// change when that happens, only this one function's native-side body.
export async function getCurrentPosition(): Promise<Coords> {
  if (Capacitor.isNativePlatform()) {
    // TODO(Phase 2 native step): swap for a background-geolocation plugin's
    // getCurrentPosition once installed — same Coords shape.
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export function startWatching(onUpdate: (coords: Coords) => void): () => void {
  if (Capacitor.isNativePlatform()) {
    // TODO(Phase 2 native step): swap for a background-geolocation plugin's
    // watch, which keeps firing even when this screen/app is backgrounded.
    // Until then the web watcher below still runs inside the native WebView
    // (foreground-only, same limitation as running as a plain PWA).
  }
  if (!navigator.geolocation) return () => {};
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

// Keeps the screen from sleeping while an active delivery is on screen —
// the practical mitigation for foreground-only tracking (see plan).
let wakeLock: any = null;
export async function acquireWakeLock(): Promise<void> {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await (navigator as any).wakeLock.request('screen');
    }
  } catch {
    // Not fatal — some browsers/contexts refuse (e.g. low battery); tracking still works.
  }
}
export async function releaseWakeLock(): Promise<void> {
  try {
    await wakeLock?.release();
  } catch { /* already released or unsupported */ }
  wakeLock = null;
}

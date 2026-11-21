/** Service-worker registration, update flow and install helpers. */

export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export const isIOS = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** iOS only supports "Add to Home Screen" from Safari itself. */
export const isIOSSafari = (): boolean =>
  isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);

let registration: ServiceWorkerRegistration | null = null;
export const getRegistration = (): ServiceWorkerRegistration | null => registration;

/**
 * Registers /sw.js in production. `onUpdate` fires when a new version is
 * installed and waiting; the app then offers "Update" instead of silently
 * swapping code under the user.
 */
export async function registerServiceWorker(onUpdate: (reg: ServiceWorkerRegistration) => void): Promise<void> {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (registration.waiting && navigator.serviceWorker.controller) onUpdate(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration!.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdate(registration!);
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    // Look for a new deploy when the app returns to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {});
    });
  } catch (error) {
    console.error('Service worker registration failed', error);
  }
}

export function applyUpdate(reg: ServiceWorkerRegistration): void {
  reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export function setAppBadge(count: number): void {
  const nav = navigator as any;
  try {
    if (count > 0) nav.setAppBadge?.(count);
    else nav.clearAppBadge?.();
  } catch { /* unsupported */ }
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

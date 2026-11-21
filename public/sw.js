/* eslint-disable no-restricted-globals */
/**
 * Service worker — offline shell, smart caching, Web Push.
 *
 * Caching rules (nothing authenticated is ever cached):
 *   /assets/*   hashed build files      -> cache-first (immutable)
 *   images/icons                        -> stale-while-revalidate (capped)
 *   public API  /api/site|products|...  -> stale-while-revalidate (works offline)
 *   other /api  (orders, downloads...)  -> network only
 *   navigations                         -> network-first, falls back to the
 *                                          last app shell, then /offline.html
 * Bump VERSION to invalidate every cache on the next deploy.
 */
const VERSION = 'v2';
const CACHES = {
  shell: `shell-${VERSION}`,
  assets: `assets-${VERSION}`,
  images: `images-${VERSION}`,
  api: `api-${VERSION}`,
  fonts: `fonts-${VERSION}`,
};
const OFFLINE_URL = '/offline.html';
const SHELL_KEY = '/__shell__';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/logo.png'];
const PUBLIC_API = ['/api/site', '/api/products', '/api/categories', '/api/banks'];
const LIMITS = { images: 80, api: 40, fonts: 30 };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHES.shell).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set(Object.values(CACHES));
    for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

// The page asks to activate a waiting worker only after the user accepts "update".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(request, res.clone()).then(() => limit && trim(cacheName, limit));
      }
      return res;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
}

async function navigate(event) {
  try {
    const res = (await event.preloadResponse) || (await fetch(event.request));
    if (res && res.ok) {
      const cache = await caches.open(CACHES.shell);
      cache.put(SHELL_KEY, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(CACHES.shell);
    return (await cache.match(SHELL_KEY)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith(staleWhileRevalidate(request, CACHES.fonts, LIMITS.fonts));
    }
    return;
  }
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(event));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    if (PUBLIC_API.some((p) => url.pathname === p || url.pathname.startsWith(p + '/')) && !request.headers.get('authorization')) {
      event.respondWith(staleWhileRevalidate(request, CACHES.api, LIMITS.api));
    }
    return; // everything else: straight to the network, never cached
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, CACHES.assets));
    return;
  }
  if (request.destination === 'image' || url.pathname.startsWith('/icons/')) {
    event.respondWith(staleWhileRevalidate(request, CACHES.images, LIMITS.images));
  }
});

// ---------------------------------------------------------------- push
function parsePush(event) {
  if (!event.data) return {};
  try { return event.data.json(); } catch { return { title: event.data.text() }; }
}

self.addEventListener('push', (event) => {
  const n = parsePush(event);
  event.waitUntil((async () => {
    if (typeof n.unread === 'number' && self.navigator.setAppBadge) {
      await (n.unread > 0 ? self.navigator.setAppBadge(n.unread) : self.navigator.clearAppBadge()).catch(() => {});
    }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The app is open and in front: it shows its own in-app toast, so skip the OS banner.
    const foreground = windows.find((c) => c.visibilityState === 'visible' && c.focused);
    windows.forEach((c) => c.postMessage({ type: 'push-received', notification: n }));
    if (foreground) return;
    await self.registration.showNotification(n.title || 'إشعار جديد', {
      body: n.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: n.tag || undefined,
      renotify: Boolean(n.tag && n.renotify),
      dir: 'rtl',
      lang: 'ar',
      timestamp: Date.now(),
      data: { url: n.url || '/notifications', id: n.id || null },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus();
        client.postMessage({ type: 'navigate', url: target.pathname + target.search + target.hash });
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});

// Browser rotated the push endpoint: ask any open tab to re-subscribe (the app also re-syncs on every load).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((cs) => cs.forEach((c) => c.postMessage({ type: 'resubscribe' }))));
});

/** Runs public/sw.js inside a vm sandbox with fake Cache/Clients APIs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.resolve(import.meta.dirname, '../public/sw.js'), 'utf8');

function makeCache() {
  const store = new Map<string, any>();
  const key = (r: any) => (typeof r === 'string' ? r : r.url ?? String(r));
  return {
    store,
    match: async (r: any) => store.get(key(r)),
    put: async (r: any, res: any) => { store.set(key(r), res); },
    addAll: async (urls: string[]) => { for (const u of urls) store.set(u, { ok: true, url: u }); },
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (r: any) => store.delete(key(r)),
  };
}

function boot(opts: { online?: boolean; windows?: any[] } = {}) {
  const listeners: Record<string, Function> = {};
  const caches = new Map<string, ReturnType<typeof makeCache>>();
  const cacheApi = {
    open: async (n: string) => { if (!caches.has(n)) caches.set(n, makeCache()); return caches.get(n)!; },
    keys: async () => [...caches.keys()],
    delete: async (n: string) => caches.delete(n),
  };
  const shown: any[] = [];
  const opened: string[] = [];
  const badge: any[] = [];
  const state = { online: opts.online ?? true };
  const windows = opts.windows ?? [];
  const sandbox: any = {
    URL, Response: class { ok: boolean; status: number; type = 'basic'; body: any; constructor(body: any, init: any = {}) { this.body = body; this.status = init.status ?? 200; this.ok = this.status < 400; }
      clone() { return this; } static error() { return { error: true, ok: false }; } },
    caches: cacheApi,
    fetch: async (req: any) => { if (!state.online) throw new Error('offline'); return { ok: true, type: 'basic', url: req.url, clone() { return this; } }; },
    self: {
      location: { origin: 'https://shop.test' },
      registration: { navigationPreload: { enable: async () => {} }, showNotification: async (t: string, o: any) => { shown.push({ t, o }); } },
      clients: { claim: async () => {}, matchAll: async () => windows, openWindow: async (u: string) => { opened.push(u); } },
      navigator: { setAppBadge: async (n: number) => { badge.push(n); }, clearAppBadge: async () => { badge.push(0); } },
      skipWaiting: () => { sandbox.skipped = true; },
      addEventListener: (type: string, fn: Function) => { listeners[type] = fn; },
    },
    console,
  };
  sandbox.self.self = sandbox.self;
  vm.runInNewContext(source, sandbox);
  return { listeners, caches, shown, opened, badge, state, sandbox };
}

const waitUntil = () => { let p: Promise<any> = Promise.resolve(); return { event: (extra: any = {}) => ({ ...extra, waitUntil: (x: Promise<any>) => { p = x; } }), done: () => p }; };
const get = (url: string, extra: any = {}) => {
  const { request: over = {}, ...rest } = extra;
  return { request: { method: 'GET', url, headers: { get: () => null }, mode: 'cors', destination: '', ...over }, ...rest };
};

test('install precaches the offline page; activate removes old versions', async () => {
  const sw = boot();
  const w = waitUntil();
  sw.listeners.install(w.event()); await w.done();
  assert.ok((await sw.caches.get('shell-v2')!.match('/offline.html')));
  (await sw.sandbox.caches.open('shell-v1')).put('x', 1);
  const a = waitUntil();
  sw.listeners.activate(a.event()); await a.done();
  assert.equal(sw.caches.has('shell-v1'), false, 'old cache version is deleted');
  assert.equal(sw.caches.has('shell-v2'), true);
});

test('authenticated / private API calls are never cached', async () => {
  const sw = boot();
  let responded = false;
  sw.listeners.fetch({ ...get('https://shop.test/api/orders'), respondWith: () => { responded = true; } });
  sw.listeners.fetch({ ...get('https://shop.test/api/downloads'), respondWith: () => { responded = true; } });
  sw.listeners.fetch({ ...get('https://shop.test/api/notifications'), respondWith: () => { responded = true; } });
  sw.listeners.fetch({ ...get('https://shop.test/api/products', { request: { headers: { get: (h: string) => (h === 'authorization' ? 'Bearer x' : null) } } }), respondWith: () => { responded = true; } });
  assert.equal(responded, false, 'must fall through to the network');
});

test('public catalogue API is served stale-while-revalidate (works offline after one visit)', async () => {
  const sw = boot();
  let res: any;
  sw.listeners.fetch({ ...get('https://shop.test/api/products'), respondWith: (p: any) => { res = p; } });
  await res;
  sw.state.online = false;
  sw.listeners.fetch({ ...get('https://shop.test/api/products'), respondWith: (p: any) => { res = p; } });
  const offline = await res;
  assert.equal(offline.ok, true, 'cached copy is returned while offline');
});

test('offline navigation falls back to the last app shell, then to /offline.html', async () => {
  const sw = boot();
  const nav = (url: string) => ({ ...get(url, { request: { mode: 'navigate' } }), preloadResponse: Promise.resolve(undefined) });
  let res: any;
  const install = waitUntil(); sw.listeners.install(install.event()); await install.done();

  sw.state.online = false;
  sw.listeners.fetch({ ...nav('https://shop.test/products'), respondWith: (p: any) => { res = p; } });
  assert.equal((await res).url, '/offline.html', 'never visited -> branded offline page');

  sw.state.online = true;
  sw.listeners.fetch({ ...nav('https://shop.test/products'), respondWith: (p: any) => { res = p; } });
  await res;
  sw.state.online = false;
  sw.listeners.fetch({ ...nav('https://shop.test/cart'), respondWith: (p: any) => { res = p; } });
  assert.equal((await res).url, 'https://shop.test/products', 'visited before -> cached shell loads the SPA offline');
});

test('push shows a notification with RTL, tag, badge and a deep link (and sets the app badge)', async () => {
  const sw = boot();
  const w = waitUntil();
  const payload = { title: 'تم اعتماد دفعتك', body: 'جاهز', url: '/portal/downloads', tag: 'order-1', renotify: true, unread: 3, id: 'n1' };
  sw.listeners.push(w.event({ data: { json: () => payload, text: () => '' } }));
  await w.done();
  assert.equal(sw.shown.length, 1);
  assert.equal(sw.shown[0].t, 'تم اعتماد دفعتك');
  assert.equal(sw.shown[0].o.dir, 'rtl');
  assert.equal(sw.shown[0].o.tag, 'order-1');
  assert.equal(sw.shown[0].o.data.url, '/portal/downloads');
  assert.equal(sw.shown[0].o.badge, '/icons/badge-96.png');
  assert.deepEqual(sw.badge, [3]);
});

test('push is not shown as an OS banner while the app is open and focused (in-app toast instead)', async () => {
  const messages: any[] = [];
  const sw = boot({ windows: [{ visibilityState: 'visible', focused: true, url: 'https://shop.test/', postMessage: (m: any) => messages.push(m) }] });
  const w = waitUntil();
  sw.listeners.push(w.event({ data: { json: () => ({ title: 'x', body: 'y' }), text: () => '' } }));
  await w.done();
  assert.equal(sw.shown.length, 0);
  assert.equal(messages[0].type, 'push-received');
});

test('push survives non-JSON payloads', async () => {
  const sw = boot();
  const w = waitUntil();
  sw.listeners.push(w.event({ data: { json: () => { throw new Error('bad'); }, text: () => 'نص عادي' } }));
  await w.done();
  assert.equal(sw.shown[0].t, 'نص عادي');
});

test('notification click focuses the open app and navigates; otherwise opens a window; foreign origins are ignored', async () => {
  const msgs: any[] = [];
  let focused = false;
  const open = boot({ windows: [{ url: 'https://shop.test/products', focus: async () => { focused = true; }, postMessage: (m: any) => msgs.push(m) }] });
  let closed = false;
  const click = (sw: any, url: string) => { const w = waitUntil(); sw.listeners.notificationclick(w.event({ notification: { close: () => { closed = true; }, data: { url } } })); return w.done(); };
  await click(open, '/admin?tab=payments');
  assert.ok(closed && focused);
  assert.deepEqual(JSON.parse(JSON.stringify(msgs[0])), { type: 'navigate', url: '/admin?tab=payments' }); // vm realm objects

  const closedApp = boot();
  await click(closedApp, '/portal/downloads');
  assert.deepEqual(closedApp.opened, ['https://shop.test/portal/downloads']);

  const evil = boot();
  await click(evil, 'https://evil.example/phish');
  assert.deepEqual(evil.opened, []);
});

test('updates wait for the user: SKIP_WAITING is the only trigger', () => {
  const sw = boot();
  sw.listeners.message({ data: { type: 'noop' } });
  assert.equal(sw.sandbox.skipped, undefined);
  sw.listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(sw.sandbox.skipped, true);
});

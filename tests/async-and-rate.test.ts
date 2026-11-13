import test from 'node:test';
import assert from 'node:assert/strict';
import { protectRouter } from '../server/lib/asyncSafe.ts';
import { createRateLimiter, clientKey } from '../server/lib/rateLimit.ts';

test('protectRouter forwards async rejections and sync throws to next()', async () => {
  const errors: unknown[] = [];
  const router: any = {
    stack: [
      { handle: async () => { throw new Error('async boom'); } },
      { route: { stack: [{ handle: () => { throw new Error('sync boom'); } }] } },
      { route: { stack: [{ handle: async (_r: any, _s: any, next: any) => next() }] } },
    ],
  };
  protectRouter(router);
  const next = (e?: unknown) => { if (e) errors.push(e); };
  await router.stack[0].handle({}, {}, next);
  await new Promise((r) => setImmediate(r));
  router.stack[1].route.stack[0].handle({}, {}, next);
  assert.equal(errors.length, 2);
  assert.match(String((errors[0] as Error).message), /async boom/);
  assert.match(String((errors[1] as Error).message), /sync boom/);
});

test('error-handling middleware (arity 4) is left untouched', () => {
  const eh = (_e: any, _a: any, _b: any, _c: any) => 1;
  const router: any = { stack: [{ handle: eh }] };
  protectRouter(router);
  assert.equal(router.stack[0].handle, eh);
});

function fakeRes() {
  const r: any = { code: 200, headers: {} as Record<string, string> };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  return r;
}

test('rate limiter: blocks after max, resets after the window, keyed per client', () => {
  let t = 1000;
  const limit = createRateLimiter('t', 2, 1000, () => t);
  const req: any = { headers: { 'x-forwarded-for': '9.9.9.9' }, ip: '1.1.1.1' };
  let passed = 0;
  const next = () => { passed++; };
  for (let i = 0; i < 4; i++) limit(req, fakeRes(), next);
  assert.equal(passed, 2);
  const blocked = fakeRes();
  limit(req, blocked, next);
  assert.equal(blocked.code, 429);
  assert.ok(Number(blocked.headers['Retry-After']) >= 1);
  t += 1500;
  limit(req, fakeRes(), next);
  assert.equal(passed, 3);
  limit({ headers: { 'x-forwarded-for': '8.8.8.8' } } as any, fakeRes(), next);
  assert.equal(passed, 4);
});

test('client key: spoofed leading x-forwarded-for entries are ignored', () => {
  assert.equal(clientKey({ headers: { 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }, ip: 'x' } as any), 'ip:7.7.7.7');
  assert.equal(clientKey({ headers: {}, ip: '2.2.2.2' } as any), 'ip:2.2.2.2');
  assert.equal(clientKey({ headers: {}, ip: 'x', user: { id: 'U' } } as any), 'u:U');
});

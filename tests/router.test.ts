import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, buildPath, isAppPath, type View } from '../src/lib/router.ts';

test('every view round-trips through buildPath -> parsePath', () => {
  const cases: Array<[View, Record<string, string>]> = [
    ['home', {}], ['products', {}], ['products', { filter: 'featured' }], ['product_details', { slug: 'نظام-محاسبة' }],
    ['product_details', { slug: 'a b/c' }], ['cart', {}], ['checkout', {}], ['order_success', {}],
    ['portal', { tab: 'orders' }], ['policies', { tab: 'refunds' }], ['notifications', {}], ['admin', {}], ['admin', { tab: 'payments' }], ['login', {}], ['login', { next: '/portal/orders' }],
  ];
  for (const [view, params] of cases) {
    const url = new URL(buildPath(view, params), 'https://x.test');
    const back = parsePath(url.pathname, url.search);
    assert.equal(back.view, view, `${view} ${JSON.stringify(params)}`);
    for (const [k, v] of Object.entries(params)) assert.equal(back.params[k], v, `${view}.${k}`);
  }
});

test('unknown paths fall back to home; trailing slashes and bad tabs are tolerated', () => {
  assert.equal(parsePath('/nope/nothing').view, 'home');
  assert.equal(parsePath('/products/').view, 'products');
  assert.equal(parsePath('/portal/hacked').params.tab, 'downloads');
  assert.equal(parsePath('/policies').params.tab, 'terms');
  assert.equal(parsePath('/products/%E0%A4%A').params.slug, '%E0%A4%A', 'malformed escapes do not throw');
});

test('deep links used by notifications and the web manifest all resolve', () => {
  for (const link of ['/portal/downloads', '/portal/orders', '/portal/services', '/admin?tab=payments', '/admin?tab=orders', '/notifications']) {
    const u = new URL(link, 'https://x.test');
    assert.notEqual(parsePath(u.pathname, u.search).view, 'home', link);
  }
  assert.equal(parsePath('/admin', '?tab=payments').params.tab, 'payments');
});

test('login ?next only accepts same-origin paths (no open redirect)', () => {
  assert.equal(parsePath('/login', '?next=https://evil.com').params.next, undefined);
  assert.equal(parsePath('/login', '?next=//evil.com').params.next, undefined);
  assert.equal(parsePath('/login', '?next=/portal').params.next, '/portal');
});

test('isAppPath rejects absolute and protocol-relative URLs', () => {
  assert.equal(isAppPath('/portal'), true);
  for (const bad of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '']) assert.equal(isAppPath(bad), false, bad);
});

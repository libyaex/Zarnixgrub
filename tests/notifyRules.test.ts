import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, localHour, isQuietHour, planDelivery, collapsedCopy, safeLink, pushPayload } from '../server/lib/notifyRules.ts';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_KEYS } from '../src/shared/notificationTypes.ts';

const at = (iso: string) => new Date(iso);

test('catalogue: every type has label, icon, color and a working collapsed title', () => {
  for (const k of NOTIFICATION_TYPE_KEYS) {
    const m = NOTIFICATION_TYPES[k];
    assert.ok(m.label && m.icon && /^#[0-9a-f]{6}$/i.test(m.color), k);
    assert.ok(m.collapsedTitle(3).includes('3') || m.collapsedTitle(3).length > 3, k);
  }
  assert.equal(NOTIFICATION_TYPES.order_new.collapsedTitle(2), 'طلبان جديدان');
  assert.equal(NOTIFICATION_TYPES.order_new.collapsedTitle(5), '5 طلبات جديدة');
});

test('preferences are normalised defensively', () => {
  const p = normalizePreferences({ muted_types: ['order_new', 'bogus'], quiet_start: 25, quiet_end: 7, push: false, tz_offset_minutes: 99999 });
  assert.deepEqual(p.muted_types, ['order_new']);
  assert.equal(p.quiet_start, null);
  assert.equal(p.quiet_end, 7);
  assert.equal(p.push, false);
  assert.equal(p.tz_offset_minutes, 120);
  assert.equal(normalizePreferences(null).in_app, true);
});

test('local hour honours the device timezone offset', () => {
  assert.equal(localHour(at('2026-06-01T22:30:00Z'), 120), 0); // Libya UTC+2
  assert.equal(localHour(at('2026-06-01T10:00:00Z'), 120), 12);
  assert.equal(localHour(at('2026-06-01T01:00:00Z'), -300), 20);
});

test('quiet hours wrap past midnight and are disabled when start == end or unset', () => {
  const base = normalizePreferences({ quiet_start: 23, quiet_end: 7, tz_offset_minutes: 120 });
  assert.equal(isQuietHour(base, at('2026-06-01T21:30:00Z')), true);  // 23:30 local
  assert.equal(isQuietHour(base, at('2026-06-01T04:00:00Z')), true);  // 06:00 local
  assert.equal(isQuietHour(base, at('2026-06-01T10:00:00Z')), false); // 12:00 local
  assert.equal(isQuietHour(normalizePreferences({ quiet_start: 5, quiet_end: 5 }), at('2026-06-01T03:00:00Z')), false);
  assert.equal(isQuietHour(normalizePreferences({}), at('2026-06-01T03:00:00Z')), false);
  const day = normalizePreferences({ quiet_start: 13, quiet_end: 15, tz_offset_minutes: 0 });
  assert.equal(isQuietHour(day, at('2026-06-01T14:00:00Z')), true);
});

test('delivery plan: mute > push off > quiet hours (high priority breaks through quiet hours only)', () => {
  const quiet = normalizePreferences({ quiet_start: 23, quiet_end: 7, tz_offset_minutes: 120 });
  const night = at('2026-06-01T22:00:00Z'); // 00:00 local
  assert.deepEqual(planDelivery(quiet, 'order_new', 'normal', night), { inApp: true, push: false, reason: 'quiet' });
  assert.deepEqual(planDelivery(quiet, 'payment_approved', 'high', night), { inApp: true, push: true });
  assert.deepEqual(planDelivery(normalizePreferences({ muted_types: ['order_new'] }), 'order_new', 'high', night), { inApp: false, push: false, reason: 'muted' });
  assert.deepEqual(planDelivery(normalizePreferences({ push: false }), 'order_new', 'high'), { inApp: true, push: false, reason: 'push_off' });
  assert.equal(planDelivery(normalizePreferences({ in_app: false }), 'order_new', 'normal').inApp, false);
});

test('collapsed copy merges counts; deep links must be same-origin paths', () => {
  assert.deepEqual(collapsedCopy('order_new', 4, 'ZNX-9'), { title: '4 طلبات جديدة', body: 'ZNX-9' });
  assert.equal(safeLink('/admin?tab=payments'), '/admin?tab=payments');
  for (const bad of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/a b', '', null, undefined, 5]) assert.equal(safeLink(bad as any), null, String(bad));
});

test('push payload is compact and truncated', () => {
  const p = pushPayload({ id: 'i', type: 'order_new', title: 'x'.repeat(500), body: 'y'.repeat(2000), link: null, priority: 'high', group_key: null });
  assert.ok(p.title.length <= 90 && p.body.length <= 220);
  assert.equal(p.url, '/notifications');
  assert.equal(p.renotify, true);
  assert.ok(JSON.stringify(p).length < 1000);
});

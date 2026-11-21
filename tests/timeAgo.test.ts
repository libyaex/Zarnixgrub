import test from 'node:test';
import assert from 'node:assert/strict';
// Pure helper copied behaviourally: import via dynamic text to avoid bundling React in node.
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/notifications/NotificationUI.tsx'), 'utf8');
const body = src.slice(src.indexOf('export function timeAgo'), src.indexOf('export const NotificationItem'));
const timeAgo = new Function(`${body.replace('export function', 'function').replace(/: string/g, '').replace(/: number/g, '')}; return timeAgo;`)() as (iso: string, now: number) => string;

const NOW = Date.parse('2026-06-10T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test('Arabic relative time with correct dual/plural forms', () => {
  assert.equal(timeAgo(ago(10_000), NOW), 'الآن');
  assert.equal(timeAgo(ago(60_000), NOW), 'قبل دقيقة');
  assert.equal(timeAgo(ago(120_000), NOW), 'قبل دقيقتين');
  assert.equal(timeAgo(ago(5 * 60_000), NOW), 'قبل 5 دقائق');
  assert.equal(timeAgo(ago(30 * 60_000), NOW), 'قبل 30 دقيقة');
  assert.equal(timeAgo(ago(3_600_000), NOW), 'قبل ساعة');
  assert.equal(timeAgo(ago(2 * 3_600_000), NOW), 'قبل ساعتين');
  assert.equal(timeAgo(ago(15 * 3_600_000), NOW), 'قبل 15 ساعة');
  assert.equal(timeAgo(ago(26 * 3_600_000), NOW), 'أمس');
  assert.equal(timeAgo(ago(4 * 86_400_000), NOW), 'قبل 4 أيام');
});

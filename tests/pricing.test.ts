import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCoupon, priceLine, missingRequiredOptions, round2, type CouponRow } from '../server/lib/pricing.ts';

const base: CouponRow = {
  discount_type: 'percentage', discount_value: 10, minimum_order: 0, max_uses: 5,
  used_count: 0, starts_at: '2026-01-01T00:00:00Z', expires_at: null, is_active: true,
};
const now = new Date('2026-06-01T00:00:00Z');

test('percentage coupon', () => {
  assert.deepEqual(evaluateCoupon(base, 200, now), { valid: true, discount: 20 });
});
test('fixed coupon never exceeds subtotal', () => {
  const r = evaluateCoupon({ ...base, discount_type: 'fixed', discount_value: 500 }, 120, now);
  assert.deepEqual(r, { valid: true, discount: 120 });
});
test('inactive / not started / expired / exhausted / below minimum', () => {
  assert.equal((evaluateCoupon({ ...base, is_active: false }, 100, now) as any).reason, 'inactive');
  assert.equal((evaluateCoupon({ ...base, starts_at: '2027-01-01T00:00:00Z' }, 100, now) as any).reason, 'not_started');
  assert.equal((evaluateCoupon({ ...base, expires_at: '2026-05-31T00:00:00Z' }, 100, now) as any).reason, 'expired');
  assert.equal((evaluateCoupon({ ...base, used_count: 5 }, 100, now) as any).reason, 'exhausted');
  const r = evaluateCoupon({ ...base, minimum_order: 300 }, 100, now) as any;
  assert.equal(r.reason, 'below_minimum');
  assert.equal(r.minimum, 300);
});
test('numeric strings from Postgres NUMERIC are handled', () => {
  assert.deepEqual(evaluateCoupon({ ...base, discount_value: '12.50', minimum_order: '50.00' }, 100, now), { valid: true, discount: 12.5 });
});
test('line pricing, rounding and quantity clamp', () => {
  assert.equal(priceLine(100, [25, 10.5], 2), 271);
  assert.equal(priceLine(10, [], 0), 10);
  assert.equal(priceLine(10, [], 1000), 990);
  assert.equal(round2(0.1 + 0.2), 0.3);
});
test('required options enforcement', () => {
  const opts = [{ id: 'a', is_required: true }, { id: 'b', is_required: false }, { id: 'c', is_required: true }];
  assert.deepEqual(missingRequiredOptions(opts, ['a']), ['c']);
  assert.deepEqual(missingRequiredOptions(opts, ['a', 'c']), []);
});

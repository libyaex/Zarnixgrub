import test from 'node:test';
import assert from 'node:assert/strict';
import { niceCeil, priceBounds, passesPriceFilter, sliderToMax } from '../src/lib/priceFilter.ts';

test('regression: a product above the old 5,000 cap is never hidden', () => {
  const prices = [450, 1500, 5300, 1_000_000];
  const { ceiling } = priceBounds(prices);
  assert.ok(ceiling >= 1_000_000);
  for (const p of prices) assert.equal(passesPriceFilter(p, null), true, `default (no limit) shows ${p}`);
  assert.equal(passesPriceFilter(5300, 5000), false, 'an explicit limit still filters');
  assert.equal(passesPriceFilter(5000, 5000), true);
});

test('bounds follow the catalogue and step stays usable at any scale', () => {
  assert.equal(niceCeil(0), 1000);
  assert.equal(niceCeil(4999), 5000);
  assert.equal(niceCeil(5001), 6000);
  assert.equal(niceCeil(1_000_000), 1_000_000);
  assert.equal(niceCeil(NaN), 1000);
  assert.deepEqual(priceBounds([]), { ceiling: 1000, step: 20 });
  const big = priceBounds([2_500_000]);
  assert.equal(big.ceiling, 3_000_000);
  assert.ok(big.step >= 10_000 && big.step <= 100_000);
  const { ceiling, step } = priceBounds([450, 1500]);
  assert.ok(ceiling / step >= 20 && ceiling / step <= 100, 'between 20 and 100 slider stops');
});

test('dragging the slider to its end clears the limit (and new pricier products still show)', () => {
  assert.equal(sliderToMax(6000, 6000), null);
  assert.equal(sliderToMax(2000, 6000), 2000);
  // after adding a 9,000 product the ceiling grows, so an end-position slider is still "no limit"
  const before = priceBounds([450, 5300]).ceiling;
  const after = priceBounds([450, 5300, 9000]).ceiling;
  assert.ok(after > before);
  assert.equal(passesPriceFilter(9000, sliderToMax(after, after)), true);
});

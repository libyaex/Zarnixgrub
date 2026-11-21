import test from 'node:test';
import assert from 'node:assert/strict';
import { paletteFromAccent, hexToRgb, readableOn } from '../src/lib/color.ts';

test('palette: 11 shades, 500 is the accent, lighter shades are lighter, darker are darker', () => {
  const p = paletteFromAccent('#10b981')!;
  assert.equal(Object.keys(p).length, 11);
  assert.equal(p['500'], '#10b981');
  const lum = (h: string) => { const [r, g, b] = hexToRgb(h)!; return r + g + b; };
  const order = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'].map((k) => lum(p[k]));
  for (let i = 1; i < order.length; i++) assert.ok(order[i] < order[i - 1], `shade ${i}`);
});
test('invalid colors are rejected and text contrast flips on light accents', () => {
  assert.equal(paletteFromAccent('green'), null);
  assert.equal(hexToRgb('#12345'), null);
  assert.equal(readableOn('#ffee00'), '#04130d');
  assert.equal(readableOn('#1e3a8a'), '#ffffff');
});

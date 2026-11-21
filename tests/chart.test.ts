import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/admin/MonthlyRevenueChart.tsx'), 'utf8');
const months = src.match(/const MONTHS_AR = (\[[^\]]*\])/)![1];
const monthLabel = new Function(`const MONTHS_AR = ${months}; return (ym) => MONTHS_AR[Math.max(0, Math.min(11, Number(ym.slice(5, 7)) - 1))] ?? ym;`)() as (s: string) => string;

test('month labels are Arabic and clamp bad input', () => {
  assert.equal(monthLabel('2026-01'), 'يناير');
  assert.equal(monthLabel('2026-12'), 'ديسمبر');
  assert.equal(monthLabel('2026-06'), 'يونيو');
  assert.equal(monthLabel('2026-99'), 'ديسمبر');
});

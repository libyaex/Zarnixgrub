import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeProduct, parseProductPayload, shapeRole } from '../server/lib/shape.ts';

const cat = '22222222-2222-4222-8222-222222222222';
const full = { name: 'N', slug: 'my-app', short_description: 's', full_description: 'f', main_image: 'http://x/y.png', base_price: '150.505', category_id: cat };

test('shapeProduct exposes options (not product_options) and hides files publicly', () => {
  const row = { id: 'p', base_price: '10.50', product_options: [{ id: 'b', price: '5', sort_order: 2 }, { id: 'a', price: '1', sort_order: 1 }], product_files: [{ storage_path: 'secret' }], categories: { name: 'C' } };
  const pub: any = shapeProduct(row);
  assert.deepEqual(pub.options.map((o: any) => o.id), ['a', 'b']);
  assert.equal(pub.base_price, 10.5);
  assert.equal(pub.category_name, 'C');
  assert.equal('files' in pub, false);
  assert.equal('product_options' in pub, false);
  assert.equal((shapeProduct(row, { includeFiles: true }) as any).files.length, 1);
});

test('create requires the essentials and rounds price', () => {
  const r: any = parseProductPayload(full, false);
  assert.equal(r.ok, true);
  assert.equal(r.value.base_price, 150.51);
  assert.equal(r.value.status, 'draft');
  assert.equal(parseProductPayload({ ...full, name: '' }, false).ok, false);
  assert.equal(parseProductPayload({ ...full, base_price: -1 }, false).ok, false);
  assert.equal(parseProductPayload({ ...full, slug: 'bad slug!' }, false).ok, false);
  assert.equal(parseProductPayload({ ...full, category_id: 'nope' }, false).ok, false);
  assert.equal(parseProductPayload({ ...full, status: 'weird' }, false).ok, false);
});

test('partial update only touches provided keys and can CLEAR fields', () => {
  const r: any = parseProductPayload({ demo_url: '', features: [], status: 'published' }, true);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.value).sort(), ['demo_url', 'features', 'status']);
  assert.equal(r.value.demo_url, null);
  assert.deepEqual(r.value.features, []);
});

test('options are validated; unknown ids become new rows', () => {
  const r: any = parseProductPayload({ ...full, options: [{ name: 'Install', price: 50, option_type: 'addon', id: 'tmp-1' }, { id: cat, name: 'Pro', price: '9' }] }, false);
  assert.equal(r.ok, true);
  assert.equal(r.options[0].id, undefined);
  assert.equal(r.options[1].id, cat);
  assert.equal(r.options[0].option_type, 'addon');
  assert.equal(parseProductPayload({ ...full, options: [{ name: '', price: 1 }] }, false).ok, false);
  assert.equal(parseProductPayload({ ...full, options: [{ name: 'x', price: -5 }] }, false).ok, false);
});

test('shapeRole uses the slug as id and flattens permissions', () => {
  const r = shapeRole({ id: 'u', name: 'night', name_ar: 'ليلي', color: '#fff', is_system: false, role_permissions: [{ permission_key: 'manage_orders' }] });
  assert.equal(r.id, 'night');
  assert.deepEqual(r.permissions, ['manage_orders']);
});

import { shapeOrder, fetchAll } from '../server/lib/shape.ts';

test('shapeOrder maps joins to items / payment_submission (latest) and numbers', () => {
  const o: any = shapeOrder({
    id: 'o', subtotal: '100.00', discount_amount: '10', total_amount: '90',
    order_items: [{ id: 'i' }],
    payment_submissions: [
      { id: 'old', created_at: '2026-01-01', transferred_amount: '1' },
      { id: 'new', created_at: '2026-02-01', transferred_amount: '90.00' },
    ],
  }, { full_name: 'Ali', email: 'a@b.co', phone: '09' });
  assert.equal(o.total_amount, 90);
  assert.equal(o.payment_submission.id, 'new');
  assert.equal(o.payment_submission.transferred_amount, 90);
  assert.equal(o.items.length, 1);
  assert.equal(o.customer_name, 'Ali');
  assert.equal('order_items' in o, false);
  assert.equal(shapeOrder({ subtotal: 1, discount_amount: 0, total_amount: 1 }).payment_submission, undefined);
});

test('fetchAll pages until a short page and surfaces errors', async () => {
  const calls: number[] = [];
  const rows = await fetchAll<number>(async (from, to) => {
    calls.push(from);
    const n = from === 0 ? 3 : 1;
    return { data: Array.from({ length: n }, (_, i) => from + i), error: null };
  }, 3);
  assert.equal(rows.length, 4);
  assert.deepEqual(calls, [0, 3]);
  await assert.rejects(fetchAll(async () => ({ data: null, error: { message: 'boom' } })), /boom/);
});

/**
 * Executes the REAL route handlers against an in-memory database:
 * checkout pricing, coupons, payment proof/review, order-status guard,
 * uploads and role-assignment rules.
 */
import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoutes, resetDb, call, db, user, staff, CUSTOMER, OTHER, STAFF, type Routes } from './helpers/harness.ts';

const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const O_INSTALL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const O_LICENSE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const ORDER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SUB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

let store: Routes, payments: Routes, dash: Routes, upload: Routes;
before(async () => {
  store = await loadRoutes('../../server/routes/store.ts', 'storeRouter');
  payments = await loadRoutes('../../server/routes/payments.ts', 'paymentsRouter');
  dash = await loadRoutes('../../server/routes/dashboard.ts', 'dashboardRouter');
  upload = await loadRoutes('../../server/routes/upload.ts', 'uploadRouter');
});

const catalog = () => ({
  products: [{ id: P1, name: 'App', base_price: '100', status: 'published' }],
  product_options: [
    { id: O_INSTALL, product_id: P1, name: 'Install', price: '50', is_required: false, is_active: true },
    { id: O_LICENSE, product_id: P1, name: 'License', price: '10', is_required: true, is_active: true },
  ],
  coupons: [{ code: 'SAVE10', discount_type: 'percentage', discount_value: 10, minimum_order: 0, max_uses: 1, used_count: 0, starts_at: '2020-01-01T00:00:00Z', expires_at: null, is_active: true }],
});

// ------------------------------------------------------------------ checkout
test('checkout: server recalculates price, ignores client-sent prices, returns the order at top level', async () => {
  resetDb(catalog());
  const res = await call(store, 'POST', '/orders', {
    user: user(),
    body: { items: [{ product_id: P1, quantity: 2, price: 1, selected_options: [{ option_id: O_LICENSE }, { option_id: O_INSTALL }] }] },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.total_amount, 320); // (100 + 10 + 50) * 2
  assert.equal(res.body.user_id, CUSTOMER);
  assert.ok(res.body.id && res.body.order_number.startsWith('ZNX-'));
  assert.equal(res.body.items.length, 1);
  assert.equal(db.T('order_items')[0].total_price, 320);
});

test('checkout: accepts the legacy option_ids shape too', async () => {
  resetDb(catalog());
  const res = await call(store, 'POST', '/orders', { user: user(), body: { items: [{ product_id: P1, quantity: 1, option_ids: [O_LICENSE] }] } });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.total_amount, 110);
});

test('checkout: required option missing, foreign option, unpublished product, empty cart are rejected', async () => {
  resetDb(catalog());
  const noRequired = await call(store, 'POST', '/orders', { user: user(), body: { items: [{ product_id: P1, quantity: 1, option_ids: [O_INSTALL] }] } });
  assert.equal(noRequired.statusCode, 400);
  const foreign = await call(store, 'POST', '/orders', { user: user(), body: { items: [{ product_id: P1, quantity: 1, option_ids: [O_LICENSE, OTHER] }] } });
  assert.equal(foreign.statusCode, 400);
  db.T('products')[0].status = 'draft';
  const draft = await call(store, 'POST', '/orders', { user: user(), body: { items: [{ product_id: P1, quantity: 1, option_ids: [O_LICENSE] }] } });
  assert.equal(draft.statusCode, 400);
  const empty = await call(store, 'POST', '/orders', { user: user(), body: { items: [] } });
  assert.equal(empty.statusCode, 400);
  assert.equal(db.T('orders').length, 0, 'no order may be created by failed checkouts');
});

test('coupon: invalid code is rejected (not silently ignored) and does not burn a use; valid code applies once', async () => {
  resetDb(catalog());
  const items = [{ product_id: P1, quantity: 1, option_ids: [O_LICENSE] }];
  const bad = await call(store, 'POST', '/orders', { user: user(), body: { items, coupon_code: 'NOPE' } });
  assert.equal(bad.statusCode, 400);
  assert.equal(db.T('coupons')[0].used_count, 0);

  const ok = await call(store, 'POST', '/orders', { user: user(), body: { items, coupon_code: 'save10' } });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.body.discount_amount, 11);
  assert.equal(ok.body.total_amount, 99);
  assert.equal(db.T('coupons')[0].used_count, 1);

  const again = await call(store, 'POST', '/orders', { user: user(), body: { items, coupon_code: 'SAVE10' } });
  assert.equal(again.statusCode, 400, 'max_uses=1 -> exhausted');
  assert.equal(db.T('orders').length, 1);
});

test('coupon preview endpoint returns { code, discount_amount } as the cart expects', async () => {
  resetDb(catalog());
  const res = await call(store, 'POST', '/coupons/validate', { user: user(), body: { code: 'save10', cart_subtotal: 200 } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { code: 'SAVE10', discount_amount: 20 });
  const missing = await call(store, 'POST', '/coupons/validate', { user: user(), body: { code: 'zzz', cart_subtotal: 200 } });
  assert.equal(missing.statusCode, 404);
});

// ------------------------------------------------------------------ payments
const paymentSeed = (over: Record<string, any> = {}) => ({
  ...catalog(),
  orders: [{ id: ORDER, order_number: 'ZNX-1', user_id: CUSTOMER, total_amount: '320', subtotal: '320', discount_amount: '0', payment_status: 'unsubmitted', order_status: 'pending' }],
  order_items: [{ id: 'i1', order_id: ORDER, product_id: P1 }],
  product_files: [
    { id: 'f1', product_id: P1, file_name: 'a.zip', storage_path: 'x/a.zip', is_downloadable: true, is_active: true },
    { id: 'f2', product_id: P1, file_name: 'b.zip', storage_path: 'x/b.zip', is_downloadable: true, is_active: true },
  ],
  ...over,
});
const proof = (over: Record<string, any> = {}) => ({
  order_id: ORDER, sender_name: 'Ali', transaction_reference: 'REF-1', transferred_amount: 320,
  receipt_storage_path: `${CUSTOMER}/receipt.png`, ...over,
});

test('payment proof: receipt must be the caller\'s own, uploaded object', async () => {
  resetDb(paymentSeed());
  db.objects.add(`payment_receipts/${CUSTOMER}/receipt.png`);
  const foreign = await call(payments, 'POST', '/submit', { user: user(), body: proof({ receipt_storage_path: `${OTHER}/receipt.png` }) });
  assert.equal(foreign.statusCode, 400);
  // Another user's receipt that REALLY exists in storage must still be refused (ownership, not just existence).
  db.objects.add(`payment_receipts/${OTHER}/receipt.png`);
  const stolen = await call(payments, 'POST', '/submit', { user: user(), body: proof({ receipt_storage_path: `${OTHER}/receipt.png`, transaction_reference: 'REF-STOLEN' }) });
  assert.equal(stolen.statusCode, 400);
  assert.equal(db.T('payment_submissions').length, 0);
  const ghost = await call(payments, 'POST', '/submit', { user: user(), body: proof({ receipt_storage_path: `${CUSTOMER}/never-uploaded.png` }) });
  assert.equal(ghost.statusCode, 400);
  assert.equal(db.T('orders')[0].payment_status, 'unsubmitted', 'failed attempts must not change the order');
});

test('payment proof: only the order owner; success moves order to under_review and returns the order', async () => {
  resetDb(paymentSeed());
  db.objects.add(`payment_receipts/${CUSTOMER}/receipt.png`);
  db.objects.add(`payment_receipts/${OTHER}/receipt.png`); // the stranger really uploaded a file
  const stranger = await call(payments, 'POST', '/submit', { user: user({ id: OTHER }), body: proof({ receipt_storage_path: `${OTHER}/receipt.png` }) });
  assert.equal(stranger.statusCode, 404);

  const ok = await call(payments, 'POST', '/submit', { user: user(), body: proof() });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.body.order.payment_status, 'under_review');
  assert.equal(ok.body.order.payment_submission.transaction_reference, 'REF-1');

  const dupe = await call(payments, 'POST', '/submit', { user: user(), body: proof() });
  assert.equal(dupe.statusCode, 409);
});

const reviewSeed = (amount = 320) => paymentSeed({
  orders: [{ id: ORDER, order_number: 'ZNX-1', user_id: CUSTOMER, total_amount: '320', payment_status: 'under_review', order_status: 'pending' }],
  payment_submissions: [{ id: SUB, order_id: ORDER, status: 'under_review', transferred_amount: String(amount), transaction_reference: 'REF-1' }],
});

test('review: customers and unrelated staff cannot approve', async () => {
  resetDb(reviewSeed());
  const cust = await call(payments, 'POST', '/review', { user: user(), body: { submission_id: SUB, decision: 'approve' } });
  assert.equal(cust.statusCode, 403);
  const wrong = await call(payments, 'POST', '/review', { user: staff(['manage_products'], 'product_manager'), body: { submission_id: SUB, decision: 'approve' } });
  assert.equal(wrong.statusCode, 403);
  assert.equal(db.T('orders')[0].payment_status, 'under_review');
});

test('review: super_admin CAN approve (regression: used to be 403) and entitlements are created exactly once', async () => {
  resetDb(reviewSeed());
  const owner = staff(['*'], 'owner');
  const res = await call(payments, 'POST', '/review', { user: owner, body: { submission_id: SUB, decision: 'approve' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.entitlements_created, 2);
  assert.equal(db.T('orders')[0].payment_status, 'paid');
  assert.equal(db.T('orders')[0].order_status, 'processing');
  assert.equal(db.T('download_entitlements').length, 2);
  assert.ok(db.T('download_entitlements').every((e) => e.user_id === CUSTOMER && e.allowed_downloads === 3));

  const again = await call(payments, 'POST', '/review', { user: owner, body: { submission_id: SUB, decision: 'approve' } });
  assert.equal(again.statusCode, 409);
  assert.equal(db.T('download_entitlements').length, 2, 'double approval must not duplicate entitlements');
  assert.equal(db.T('audit_logs').filter((a) => a.action === 'approve_payment').length, 1);
});

test('review: amount mismatch blocks approval; rejection needs a reason and frees the order for resubmission', async () => {
  resetDb(reviewSeed(100));
  const reviewer = staff(['approve_payments']);
  const mismatch = await call(payments, 'POST', '/review', { user: reviewer, body: { submission_id: SUB, decision: 'approve' } });
  assert.equal(mismatch.statusCode, 422);
  assert.equal(db.T('orders')[0].payment_status, 'under_review');
  assert.equal(db.T('download_entitlements').length, 0);

  const noReason = await call(payments, 'POST', '/review', { user: reviewer, body: { submission_id: SUB, decision: 'reject' } });
  assert.equal(noReason.statusCode, 400);
  const rejected = await call(payments, 'POST', '/review', { user: reviewer, body: { submission_id: SUB, decision: 'reject', rejection_reason: 'blurry' } });
  assert.equal(rejected.statusCode, 200);
  assert.equal(db.T('orders')[0].payment_status, 'rejected');

  // the customer can submit a corrected proof after a rejection
  db.objects.add(`payment_receipts/${CUSTOMER}/receipt.png`);
  const retry = await call(payments, 'POST', '/submit', { user: user(), body: proof({ transaction_reference: 'REF-2' }) });
  assert.equal(retry.statusCode, 201);
  assert.equal(db.T('orders')[0].payment_status, 'under_review');
});

// ------------------------------------------------------------------ dashboard rules
test('order status endpoint can never mark an order paid; refund revokes downloads', async () => {
  resetDb({
    orders: [{ id: ORDER, user_id: CUSTOMER, payment_status: 'under_review', order_status: 'pending' }],
    download_entitlements: [{ id: 'e1', order_id: ORDER, is_active: true }],
  });
  const manager = staff(['manage_orders']);
  const paid = await call(dash, 'PUT', '/orders/:id/status', { user: manager, params: { id: ORDER }, body: { payment_status: 'paid' } });
  assert.equal(paid.statusCode, 409);
  assert.equal(paid.body.code, 'use_payment_review');
  assert.equal(db.T('orders')[0].payment_status, 'under_review');

  const refund = await call(dash, 'PUT', '/orders/:id/status', { user: manager, params: { id: ORDER }, body: { payment_status: 'refunded', order_status: 'cancelled' } });
  assert.equal(refund.statusCode, 200);
  assert.equal(db.T('download_entitlements')[0].is_active, false);

  const nobody = await call(dash, 'PUT', '/orders/:id/status', { user: staff(['manage_products']), params: { id: ORDER }, body: { order_status: 'completed' } });
  assert.equal(nobody.statusCode, 403);
});

test('roles: nobody changes their own role; admins cannot touch the owner or mint admins', async () => {
  const ADMIN = '44444444-4444-4444-8444-444444444444', OWNER = '55555555-5555-4555-8555-555555555555';
  resetDb({ profiles: [
    { id: ADMIN, role: 'admin', status: 'active' },
    { id: OWNER, role: 'owner', status: 'active' },
    { id: CUSTOMER, role: 'customer', status: 'active' },
  ] });
  const admin = staff(['manage_users'], 'admin', ADMIN);
  const self = await call(dash, 'PUT', '/staff/:userId/role', { user: admin, params: { userId: ADMIN }, body: { role: 'owner' } });
  assert.equal(self.statusCode, 403);
  const owner = await call(dash, 'PUT', '/staff/:userId/role', { user: admin, params: { userId: OWNER }, body: { role: 'customer' } });
  assert.equal(owner.statusCode, 403);
  const mint = await call(dash, 'PUT', '/staff/:userId/role', { user: admin, params: { userId: CUSTOMER }, body: { role: 'admin' } });
  assert.equal(mint.statusCode, 403);
  const fine = await call(dash, 'PUT', '/staff/:userId/role', { user: admin, params: { userId: CUSTOMER }, body: { role: 'support_manager' } });
  assert.equal(fine.statusCode, 200);
  assert.equal(db.T('profiles').find((p) => p.id === CUSTOMER)!.role, 'support_manager');
});

test('custom roles: created with whitelisted permissions, cannot escalate, assignable to staff, deletion guarded', async () => {
  const CUST_ROLE = '66666666-6666-4666-8666-666666666666';
  resetDb({ roles: [], role_permissions: [], profiles: [{ id: CUSTOMER, role: 'customer', status: 'active' }] });
  const owner = staff(['*'], 'owner');
  const created = await call(dash, 'POST', '/roles', { user: owner, body: { name_ar: 'نوبة ليلية', permissions: ['manage_orders', 'drop_database'] } });
  assert.equal(created.statusCode, 201);
  const slug = created.body.role.name;
  assert.match(slug, /^custom_/);
  assert.deepEqual(db.T('role_permissions').map((p) => p.permission_key), ['manage_orders'], 'unknown permission keys are dropped');

  const limited = staff(['manage_roles_permissions', 'manage_orders'], 'custom_x');
  const escalate = await call(dash, 'POST', '/roles', { user: limited, body: { name_ar: 'x', permissions: ['manage_settings'] } });
  assert.equal(escalate.statusCode, 403, 'cannot grant permissions you do not hold');

  const admin = staff(['manage_users'], 'admin', STAFF);
  const assign = await call(dash, 'PUT', '/staff/:userId/role', { user: admin, params: { userId: CUSTOMER }, body: { role: slug } });
  assert.equal(assign.statusCode, 200);
  const profile = db.T('profiles').find((p) => p.id === CUSTOMER)!;
  assert.equal(profile.role, 'customer', 'DB-level role stays least-privileged');
  assert.ok(profile.custom_role_id);

  const del = await call(dash, 'DELETE', '/roles/:slug', { user: owner, params: { slug } });
  assert.equal(del.statusCode, 409, 'role in use cannot be deleted');
  void CUST_ROLE;
});

test('upload signing: receipts for any user, project archives only for product managers, bad types rejected', async () => {
  resetDb();
  const receipt = await call(upload, 'POST', '/sign', { user: user(), body: { kind: 'receipt', file_name: 'r.png', mime_type: 'image/png', size_bytes: 1000 } });
  assert.equal(receipt.statusCode, 200);
  assert.ok(receipt.body.path.startsWith(`${CUSTOMER}/`));
  assert.equal(receipt.body.bucket, 'payment_receipts');

  const svg = await call(upload, 'POST', '/sign', { user: user(), body: { kind: 'receipt', file_name: 'r.svg', mime_type: 'image/svg+xml', size_bytes: 10 } });
  assert.equal(svg.statusCode, 415);
  const huge = await call(upload, 'POST', '/sign', { user: user(), body: { kind: 'receipt', file_name: 'r.png', mime_type: 'image/png', size_bytes: 50 * 1048576 } });
  assert.equal(huge.statusCode, 413);

  const asCustomer = await call(upload, 'POST', '/sign', { user: user(), body: { kind: 'project', file_name: 'p.zip', mime_type: 'application/zip', size_bytes: 1000 } });
  assert.equal(asCustomer.statusCode, 403);
  const pm = staff(['manage_products'], 'product_manager');
  const project = await call(upload, 'POST', '/sign', { user: pm, body: { kind: 'project', file_name: 'p.zip', mime_type: 'application/octet-stream', size_bytes: 300 * 1048576 } });
  assert.equal(project.statusCode, 200);
  assert.equal(project.body.bucket, 'project_files');
  const exe = await call(upload, 'POST', '/sign', { user: pm, body: { kind: 'project', file_name: 'p.exe', mime_type: 'application/octet-stream', size_bytes: 10 } });
  assert.equal(exe.statusCode, 415);
});

test('product files: registering requires a real uploaded object; files with customer entitlements are archived, not deleted', async () => {
  resetDb({ product_files: [{ id: 'f9', product_id: P1, storage_path: 'x/z.zip', is_active: true }], download_entitlements: [{ id: 'e', product_file_id: 'f9' }] });
  const pm = staff(['manage_products'], 'product_manager');
  const ghost = await call(dash, 'POST', '/products/:id/files', { user: pm, params: { id: P1 }, body: { storage_path: `${STAFF}/missing.zip`, file_name: 'missing.zip' } });
  assert.equal(ghost.statusCode, 400);

  db.objects.add(`project_files/${STAFF}/real.zip`);
  const ok = await call(dash, 'POST', '/products/:id/files', { user: pm, params: { id: P1 }, body: { storage_path: `${STAFF}/real.zip`, file_name: 'real.zip', file_size: 5, version: '2.0.0' } });
  assert.equal(ok.statusCode, 201);
  assert.equal(db.T('product_files').length, 2);

  const FILE_ID = '77777777-7777-4777-8777-777777777777';
  db.T('product_files')[0].id = FILE_ID;
  db.T('download_entitlements')[0].product_file_id = FILE_ID;
  const del = await call(dash, 'DELETE', '/product-files/:fileId', { user: pm, params: { fileId: FILE_ID } });
  assert.equal(del.statusCode, 200);
  assert.equal(del.body.archived, true);
  assert.equal(db.T('product_files').find((f) => f.id === FILE_ID)!.is_active, false);
  assert.equal(db.T('download_entitlements').length, 1, 'customer entitlements survive');
});

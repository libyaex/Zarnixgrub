import test from 'node:test';
import assert from 'node:assert/strict';
import {
  permissionsFor, hasPermission, canChangeRole, isStaffRole, ALL_PERMISSIONS,
} from '../server/lib/permissions.ts';

test('owner and super_admin have every permission', () => {
  for (const role of ['owner', 'super_admin']) {
    for (const p of ALL_PERMISSIONS) assert.ok(hasPermission(permissionsFor(role), p), `${role} ${p}`);
  }
});

test('regression: super_admin can approve payments (was 403 before)', () => {
  assert.ok(hasPermission(permissionsFor('super_admin'), 'approve_payments'));
});

test('customer has no permissions and is not staff', () => {
  assert.equal(permissionsFor('customer').length, 0);
  assert.equal(isStaffRole('customer'), false);
  assert.equal(isStaffRole(undefined), false);
});

test('built-in scoped roles', () => {
  assert.ok(hasPermission(permissionsFor('payment_manager'), 'approve_payments'));
  assert.ok(!hasPermission(permissionsFor('payment_manager'), 'manage_products'));
  assert.ok(hasPermission(permissionsFor('product_manager'), 'manage_products'));
  assert.ok(!hasPermission(permissionsFor('product_manager'), 'manage_settings'));
  assert.ok(!hasPermission(permissionsFor('admin'), 'manage_roles_permissions'));
});

test('custom roles honour only whitelisted permission keys', () => {
  const p = permissionsFor('night_shift', ['manage_orders', 'drop_database', '*']);
  assert.deepEqual([...p], ['manage_orders']);
  assert.equal(permissionsFor('unknown_role').length, 0);
  assert.ok(isStaffRole('night_shift'));
});

test('role change rules', () => {
  const owner = { id: 'o', role: 'owner' };
  const admin = { id: 'a', role: 'admin' };
  const support = { id: 's', role: 'support_manager' };
  const cust = { id: 'c', role: 'customer' };
  assert.equal(canChangeRole(owner, owner, 'customer').ok, false, 'no self change');
  assert.equal(canChangeRole(admin, owner, 'customer').ok, false, 'admin cannot demote owner');
  assert.equal(canChangeRole(admin, cust, 'admin').ok, false, 'admin cannot mint admins');
  assert.equal(canChangeRole(admin, cust, 'owner').ok, false);
  assert.equal(canChangeRole(admin, cust, 'support_manager').ok, true);
  assert.equal(canChangeRole(owner, admin, 'customer').ok, true);
  assert.equal(canChangeRole(support, cust, 'product_manager').ok, true);
});

/**
 * Pure RBAC rules (no I/O) so they can be unit-tested and reused by the
 * middleware and the routes.
 *
 * Built-in roles map to fixed permission sets. Custom roles (created from the
 * dashboard) store their permissions in role_permissions and are resolved by
 * the caller, then passed in as `customPermissions`.
 */
export type PermissionKey =
  | 'manage_products'
  | 'manage_orders'
  | 'approve_payments'
  | 'manage_downloads'
  | 'manage_services'
  | 'manage_coupons'
  | 'manage_banks'
  | 'manage_roles_permissions'
  | 'manage_users'
  | 'view_financial_analytics'
  | 'manage_settings'
  | 'view_audit_logs';

export const ALL_PERMISSIONS: readonly PermissionKey[] = [
  'manage_products', 'manage_orders', 'approve_payments', 'manage_downloads',
  'manage_services', 'manage_coupons', 'manage_banks', 'manage_roles_permissions',
  'manage_users', 'view_financial_analytics', 'manage_settings', 'view_audit_logs',
];

export const BUILTIN_ROLES = [
  'owner', 'super_admin', 'admin', 'product_manager',
  'payment_manager', 'support_manager', 'customer',
] as const;

export const SUPER_ROLES = ['owner', 'super_admin'] as const;

const ROLE_PERMISSIONS: Record<string, readonly (PermissionKey | '*')[]> = {
  owner: ['*'],
  super_admin: ['*'],
  admin: [
    'manage_products', 'manage_orders', 'approve_payments', 'manage_downloads',
    'manage_services', 'manage_coupons', 'manage_banks', 'manage_users',
    'view_financial_analytics', 'manage_settings', 'view_audit_logs',
  ],
  product_manager: ['manage_products', 'manage_downloads'],
  payment_manager: ['approve_payments', 'manage_banks', 'manage_orders'],
  support_manager: ['manage_orders', 'manage_services', 'manage_downloads', 'manage_users'],
  customer: [],
};

export function isBuiltinRole(role: string | undefined): boolean {
  return !!role && (BUILTIN_ROLES as readonly string[]).includes(role);
}

export function isSuperRole(role: string | undefined): boolean {
  return !!role && (SUPER_ROLES as readonly string[]).includes(role);
}

/** Staff = anyone who is not a plain customer (built-in or custom role). */
export function isStaffRole(role: string | undefined): boolean {
  return !!role && role !== 'customer';
}

export function permissionsFor(
  role: string | undefined,
  customPermissions?: readonly string[]
): readonly (PermissionKey | '*')[] {
  const key = role ?? 'customer';
  if (ROLE_PERMISSIONS[key]) return ROLE_PERMISSIONS[key];
  // Custom role: only whitelisted permission keys are honoured.
  return (customPermissions ?? []).filter((p): p is PermissionKey =>
    (ALL_PERMISSIONS as readonly string[]).includes(p)
  );
}

export function hasPermission(
  granted: readonly (PermissionKey | '*')[] | readonly string[],
  needed: PermissionKey
): boolean {
  return granted.some((g) => g === '*' || g === needed);
}

export interface RoleChangeVerdict { ok: boolean; error?: string }

/**
 * Who may change whose role/status. Rules:
 *  - nobody changes their own role or suspends themselves (lock-out guard);
 *  - only owner/super_admin may touch another owner/super_admin, or grant
 *    owner/super_admin/admin;
 *  - everyone else (needs manage_users) may only manage non-super accounts.
 */
export function canChangeRole(
  actor: { id: string; role: string },
  target: { id: string; role: string },
  newRole: string | undefined
): RoleChangeVerdict {
  if (actor.id === target.id) {
    return { ok: false, error: 'لا يمكنك تغيير دورك أو حالتك بنفسك' };
  }
  const actorIsSuper = isSuperRole(actor.role);
  if (isSuperRole(target.role) && !actorIsSuper) {
    return { ok: false, error: 'فقط المالك يمكنه تعديل حساب المالك' };
  }
  if (newRole && !actorIsSuper && ['owner', 'super_admin', 'admin'].includes(newRole)) {
    return { ok: false, error: 'فقط المالك يمكنه منح دور مدير أو مالك' };
  }
  return { ok: true };
}

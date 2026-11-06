/**
 * Phase 1 — Authentication & Authorization middleware.
 *
 * Replaces the insecure shared `currentUser` variable and the forgeable
 * `x-auth-email` header with per-request JWT verification. Roles are read
 * from the `profiles` table (source of truth), never from the browser.
 */
import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from './supabaseAdmin';

export interface AuthedUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

/** Permission keys shared by the RBAC layer. Keep in sync with src/types. */
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

/**
 * Role → permission map. The DB role `owner` has unrestricted access.
 * `super_admin` is kept as a migration alias of the legacy in-memory role
 * so no legitimate admin is locked out during Phase 1; forging either
 * string in the browser still grants nothing because roles come from DB.
 */
const ROLE_PERMISSIONS: Record<string, PermissionKey[] | ['*']> = {
  owner: ['*'],
  super_admin: ['*'],
  admin: [
    'manage_products',
    'manage_orders',
    'approve_payments',
    'manage_downloads',
    'manage_services',
    'manage_coupons',
    'manage_banks',
    'manage_users',
    'view_financial_analytics',
    'manage_settings',
    'view_audit_logs',
  ],
  product_manager: ['manage_products', 'manage_downloads'],
  payment_manager: ['approve_payments', 'manage_banks'],
  support_manager: ['manage_orders', 'manage_services', 'manage_downloads'],
  customer: [],
};

export function permissionsFor(role: string | undefined): PermissionKey[] | ['*'] {
  return ROLE_PERMISSIONS[role ?? 'customer'] ?? [];
}

/**
 * Require a valid Supabase JWT (Authorization: Bearer <token>) and an
 * active profile. Attaches the verified user to the request — per
 * request, never shared across users.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'جلسة غير صالحة أو منتهية' });
    return;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, status')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    res.status(403).json({ error: 'لا يوجد ملف تعريف لهذا الحساب. يرجى التواصل مع الدعم.' });
    return;
  }
  if (profile.status !== 'active') {
    res.status(403).json({ error: 'هذا الحساب موقوف. يرجى التواصل مع الدعم.' });
    return;
  }

  req.user = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    status: profile.status,
  };
  next();
}

/** Require one of the listed roles (checked against DB role, not the browser). */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة' });
      return;
    }
    const role = req.user.role;
    const allowed = role === 'owner' || role === 'super_admin' || roles.includes(role);
    if (!allowed) {
      res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء' });
      return;
    }
    next();
  };
}

/** Require a specific permission for the authenticated user. */
export function requirePermission(perm: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة' });
      return;
    }
    const perms = permissionsFor(req.user.role);
    const allowed = perms.includes('*') || perms.includes(perm);
    if (!allowed) {
      res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء' });
      return;
    }
    next();
  };
}

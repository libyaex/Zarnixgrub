/**
 * Phase 1 — Authentication & Authorization middleware.
 *
 * Supabase JWT is verified for every authenticated request. The role is
 * loaded from the database on each request; browser state and identity
 * headers are never used as authorization sources.
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
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

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

const ROLE_PERMISSIONS: Record<string, readonly (PermissionKey | '*')[]> = {
  owner: ['*'],
  super_admin: ['*'],
  admin: [
    'manage_products', 'manage_orders', 'approve_payments', 'manage_downloads',
    'manage_services', 'manage_coupons', 'manage_banks', 'manage_users',
    'view_financial_analytics', 'manage_settings', 'view_audit_logs',
  ],
  product_manager: ['manage_products', 'manage_downloads'],
  payment_manager: ['approve_payments', 'manage_banks'],
  support_manager: ['manage_orders', 'manage_services', 'manage_downloads'],
  customer: [],
};

export function permissionsFor(role: string | undefined): readonly (PermissionKey | '*')[] {
  return ROLE_PERMISSIONS[role ?? 'customer'] ?? [];
}

/** Require valid Supabase JWT and active DB profile; attach per-request identity. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length).trim()
    : '';
  if (!token) {
    res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة' });
    return;
  }

  try {
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
  } catch (error) {
    // Express 4 does not automatically forward rejected async middleware promises.
    next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة' });
      return;
    }
    if (req.user.role !== 'owner' && req.user.role !== 'super_admin' && !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء' });
      return;
    }
    next();
  };
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة' });
      return;
    }
    if (!permissionsFor(req.user.role).some((granted) => granted === '*' || granted === permission)) {
      res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء' });
      return;
    }
    next();
  };
}

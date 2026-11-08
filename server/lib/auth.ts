/**
 * Phase 1 — Authentication & Authorization middleware.
 *
 * Supabase JWT is verified for every authenticated request. The role is
 * loaded from the database on each request; browser state and identity
 * headers are never used as authorization sources.
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions — required
 * by Node ESM on Vercel (ERR_MODULE_NOT_FOUND otherwise).
 */
import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseAdmin.ts';

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

/**
 * Require a valid Supabase JWT and an active DB profile; attach the
 * per-request identity.
 *
 * Self-healing: a user who authenticated with Google BEFORE the
 * auto-provision trigger existed (or whose trigger failed) has an
 * auth.users row but no profiles row. The profile is now created on
 * first authenticated request using an UPSERT — the dashboard fires
 * several /api calls in parallel on load, and a plain insert raced and
 * failed with duplicate-key errors; upsert tolerates the concurrency.
 *
 * Every failure carries a machine-readable `code` so the UI can explain it.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length).trim()
    : '';
  if (!token) {
    res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة', code: 'no_token' });
    return;
  }
  if (!isSupabaseConfigured) {
    res.status(500).json({
      error: 'الخادم غير مهيأ: متغيرات Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) غير مضبوطة في الاستضافة.',
      code: 'server_not_configured',
    });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({
        error: 'جلسة غير صالحة أو منتهية. إن تكرر ذلك فتأكد أن الخادم والواجهة يستخدمان نفس مشروع Supabase.',
        code: 'invalid_session',
      });
      return;
    }
    const authUser = data.user;

    const { data: found, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, status')
      .eq('id', authUser.id)
      .maybeSingle();
    if (lookupError) {
      console.error('[auth] profile lookup failed:', lookupError.message);
      res.status(500).json({ error: 'تعذر قراءة الملف الشخصي من قاعدة البيانات', code: 'profile_lookup_failed' });
      return;
    }

    let profile = found;
    if (!profile) {
      const email = authUser.email ?? '';
      if (!email) {
        res.status(403).json({ error: 'حساب Google لا يحتوي بريداً إلكترونياً', code: 'no_email' });
        return;
      }
      const { data: clash } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (clash) {
        res.status(409).json({
          error: 'يوجد ملف شخصي بنفس البريد مرتبط بحساب دخول آخر. يلزم حذفه أو دمجه يدوياً من لوحة Supabase.',
          code: 'profile_email_conflict',
        });
        return;
      }

      let role = 'customer';
      const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
      if (ownerEmail && email.toLowerCase() === ownerEmail && authUser.email_confirmed_at) {
        const { count } = await supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'owner');
        if ((count ?? 0) === 0) role = 'owner';
      }

      const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        email.split('@')[0];

      // UPSERT (not insert): tolerates the parallel /api calls the
      // dashboard fires on load — concurrent first requests each try to
      // create the same profile and the loser no longer errors out.
      const { data: created, error: createError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          { id: authUser.id, email, full_name: fullName, role, status: 'active' },
          { onConflict: 'id' }
        )
        .select('id, email, full_name, role, status')
        .maybeSingle();
      if (createError || !created) {
        console.error('[auth] profile auto-create failed:', createError?.message);
        res.status(500).json({
          error: 'تعذر إنشاء الملف الشخصي تلقائياً. تأكد من تنفيذ supabase/schema.sql أولاً.',
          code: 'profile_create_failed',
        });
        return;
      }
      profile = created;
    }

    if (profile.status !== 'active') {
      res.status(403).json({ error: 'هذا الحساب موقوف. يرجى التواصل مع الدعم.', code: 'account_suspended' });
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
    // Express 4 does not forward rejected async middleware promises.
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

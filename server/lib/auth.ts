/**
 * Authentication & authorization middleware.
 *
 * - The Supabase JWT is verified on every request; the role and the
 *   permission set are loaded from the database (never from the browser).
 * - Built-in roles use the fixed map in permissions.ts; custom roles
 *   (profiles.custom_role_id) resolve their permissions from role_permissions.
 * - A profile is auto-created on first verified sign-in (self-healing) and
 *   a pending staff invitation for that email is applied.
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions (required by
 * Node ESM on Vercel).
 */
import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseAdmin.ts';
import {
  permissionsFor, hasPermission, isBuiltinRole, isStaffRole,
  type PermissionKey,
} from './permissions.ts';

export type { PermissionKey } from './permissions.ts';
export { permissionsFor } from './permissions.ts';

export interface AuthedUser {
  id: string;
  email: string;
  full_name: string;
  /** Effective role slug: built-in role, or the custom role's name. */
  role: string;
  status: string;
  permissions: string[];
  is_staff: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  custom_role_id?: string | null;
}

const BASE_COLUMNS = 'id, email, full_name, role, status';

/** Works before AND after phase3-complete.sql (custom_role_id may not exist yet). */
async function loadProfile(id: string): Promise<{ profile: ProfileRow | null; failed: boolean }> {
  let { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`${BASE_COLUMNS}, custom_role_id`)
    .eq('id', id)
    .maybeSingle();
  if (error && /custom_role_id/.test(error.message)) {
    ({ data, error } = (await supabaseAdmin
      .from('profiles')
      .select(BASE_COLUMNS)
      .eq('id', id)
      .maybeSingle()) as typeof data extends never ? never : { data: any; error: any });
  }
  if (error) {
    console.error('[auth] profile lookup failed:', error.message);
    return { profile: null, failed: true };
  }
  return { profile: (data as ProfileRow | null) ?? null, failed: false };
}

/** Resolve the effective role + permissions (custom roles come from the DB). */
async function resolveAccess(profile: ProfileRow): Promise<{ role: string; permissions: string[] }> {
  if (profile.custom_role_id) {
    const { data } = await supabaseAdmin
      .from('roles')
      .select('name, role_permissions(permission_key)')
      .eq('id', profile.custom_role_id)
      .maybeSingle();
    if (data?.name) {
      const keys = ((data as any).role_permissions ?? []).map((r: any) => r.permission_key as string);
      return { role: data.name as string, permissions: [...permissionsFor(data.name as string, keys)] as string[] };
    }
  }
  return { role: profile.role, permissions: [...permissionsFor(profile.role)] as string[] };
}

/** Apply a pending staff invitation to a freshly created profile. */
async function applyInvite(profileId: string, email: string): Promise<Partial<ProfileRow>> {
  const { data: invite } = await supabaseAdmin
    .from('staff_invites')
    .select('id, role, full_name, phone')
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .maybeSingle();
  if (!invite) return {};

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isBuiltinRole(invite.role) && invite.role !== 'owner' && invite.role !== 'super_admin') {
    updates.role = invite.role;
  } else if (!isBuiltinRole(invite.role)) {
    const { data: custom } = await supabaseAdmin.from('roles').select('id').eq('name', invite.role).maybeSingle();
    if (custom) updates.custom_role_id = custom.id;
  }
  if (invite.phone) updates.phone = invite.phone;
  await supabaseAdmin.from('profiles').update(updates).eq('id', profileId);
  await supabaseAdmin.from('staff_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
  return { role: (updates.role as string) ?? 'customer', custom_role_id: (updates.custom_role_id as string) ?? null };
}

/**
 * Require a valid Supabase JWT and an active DB profile; attach the
 * per-request identity. Every failure carries a machine-readable `code`.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const loaded = await loadProfile(authUser.id);
    if (loaded.failed) {
      res.status(500).json({ error: 'تعذر قراءة الملف الشخصي من قاعدة البيانات', code: 'profile_lookup_failed' });
      return;
    }

    let profile = loaded.profile;
    if (!profile) {
      const email = authUser.email ?? '';
      if (!email) {
        res.status(403).json({ error: 'حساب Google لا يحتوي بريداً إلكترونياً', code: 'no_email' });
        return;
      }
      const { data: clash } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
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
          .from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner');
        if ((count ?? 0) === 0) role = 'owner';
      }

      const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        email.split('@')[0];

      const { data: created, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({ id: authUser.id, email, full_name: fullName, role, status: 'active' })
        .select(BASE_COLUMNS)
        .single();
      if (createError || !created) {
        console.error('[auth] profile auto-create failed:', createError?.message);
        res.status(500).json({
          error: 'تعذر إنشاء الملف الشخصي تلقائياً. تأكد من تنفيذ supabase/schema.sql أولاً.',
          code: 'profile_create_failed',
        });
        return;
      }
      profile = created as ProfileRow;
      if (role === 'customer' && authUser.email_confirmed_at) {
        try { Object.assign(profile, await applyInvite(profile.id, email)); } catch (e) {
          console.error('[auth] invite apply failed (phase3 migration missing?):', e);
        }
      }
    }

    if (profile.status !== 'active') {
      res.status(403).json({ error: 'هذا الحساب موقوف. يرجى التواصل مع الدعم.', code: 'account_suspended' });
      return;
    }

    const access = await resolveAccess(profile);
    req.user = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: access.role,
      status: profile.status,
      permissions: access.permissions,
      is_staff: isStaffRole(access.role),
    };
    next();
  } catch (error) {
    next(error); // Express 4 does not forward rejected async middleware promises
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة', code: 'no_token' });
      return;
    }
    if (req.user.role !== 'owner' && req.user.role !== 'super_admin' && !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء', code: 'forbidden' });
      return;
    }
    next();
  };
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة', code: 'no_token' });
      return;
    }
    if (!hasPermission(req.user.permissions, permission)) {
      res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء', code: 'forbidden' });
      return;
    }
    next();
  };
}

/** Any staff member (built-in or custom role). */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'مطلوب تسجيل الدخول للمتابعة', code: 'no_token' });
    return;
  }
  if (!req.user.is_staff) {
    res.status(403).json({ error: 'هذه الصفحة للإدارة فقط', code: 'forbidden' });
    return;
  }
  next();
}

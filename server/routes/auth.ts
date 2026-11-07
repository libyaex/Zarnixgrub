/**
 * Phase 1+2 — Auth API routes backed by Supabase.
 *
 * Replaces the legacy in-memory `/api/auth/*` handlers. Identity is
 * verified via Supabase JWT (no email headers, no browser-chosen roles).
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions — required
 * by Node ESM on Vercel (ERR_MODULE_NOT_FOUND otherwise).
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth, requirePermission } from '../lib/auth.ts';

export const authRouter = Router();

const ASSIGNABLE_ROLES = [
  'owner',
  'admin',
  'product_manager',
  'payment_manager',
  'support_manager',
  'customer',
];

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile (DB-sourced role included).
 * The frontend uses this to read its role; it can never choose one.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      full_name: req.user!.full_name,
      role: req.user!.role, // source of truth: profiles.role
      status: req.user!.status,
    },
  });
});

/**
 * POST /api/auth/switch-role
 * Admin-only role assignment (guarded by manage_users). Only an owner
 * may grant the owner role. The legacy unguarded dev switcher is gone.
 */
authRouter.post(
  '/switch-role',
  requireAuth,
  requirePermission('manage_users'),
  async (req: Request, res: Response) => {
    const newRole = String(req.body?.role ?? '');
    const targetUserId = req.body?.user_id
      ? String(req.body.user_id)
      : req.user!.id;

    if (!ASSIGNABLE_ROLES.includes(newRole)) {
      res.status(400).json({ error: 'دور غير صالح' });
      return;
    }
    if (newRole === 'owner' && req.user!.role !== 'owner' && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'فقط المالك يمكنه منح دور المالك' });
      return;
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select('id, email, full_name, role, status')
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'لم يتم العثور على المستخدم' });
      return;
    }

    res.json({ user: profile });
  }
);

/**
 * POST /api/auth/logout
 * JWTs are verified per request and stateful sessions were removed in
 * Phase 1, so there is no server session map to clear. The frontend
 * also calls Supabase client signOut to clear the browser session.
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'تم تسجيل الخروج' });
});

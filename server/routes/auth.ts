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
import { requireAuth } from '../lib/auth.ts';

export const authRouter = Router();

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
      role: req.user!.role, // source of truth: database (effective role slug)
      status: req.user!.status,
      permissions: req.user!.permissions,
      is_staff: req.user!.is_staff,
    },
  });
});

/**
 * POST /api/auth/logout
 * JWTs are verified per request and stateful sessions were removed in
 * Phase 1, so there is no server session map to clear. The frontend
 * also calls Supabase client signOut to clear the browser session.
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'تم تسجيل الخروج' });
});

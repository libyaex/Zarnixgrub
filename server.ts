/**
 * server.ts — NIZAR DIGITAL (Zarnix Group) API server.
 *
 * Phase 2–6 wiring:
 * - Removed: forgeable `x-auth-email` header trust, shared mutable
 *   `currentUser`, in-memory `activeSessions`, and the unverified
 *   `/api/auth/google`, `/api/auth/login`, `/api/auth/register` routes.
 * - Added: JWT-authenticated `/api/auth/me`, guarded `/api/auth/switch-role`,
 *   Supabase-backed store/orders/coupons/payments/uploads/downloads/admin
 *   routes, and Supabase as the sole identity + storage provider.
 * - Compatibility: legacy dashboard endpoints (stats, audit-logs, staff,
 *   bank-accounts, all-entitlements, logs, settings, coupons, orders)
 *   are served by server/routes/compat.ts with the same permission guards.
 *
 * ESM NOTE: Node ESM requires explicit file extensions on all relative
 * imports (ERR_MODULE_NOT_FOUND on Vercel otherwise).
 *
 * Migration notes: server/ROUTES-MIGRATION.md. Progress: PROGRESS.md.
 */
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './server/routes/auth.ts';
import { storeRouter } from './server/routes/store.ts';
import { paymentsRouter } from './server/routes/payments.ts';
import { uploadRouter } from './server/routes/upload.ts';
import { downloadsRouter } from './server/routes/downloads.ts';
import { adminRouter } from './server/routes/admin.ts';
import { manageRouter } from './server/routes/manage.ts';
import { compatRouter } from './server/routes/compat.ts';
import { isSupabaseConfigured, SUPABASE_HOST } from './server/lib/supabaseAdmin.ts';
import { supabaseAdmin } from './server/lib/supabaseAdmin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Production Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Production In-Memory Rate Limiting (best-effort; per instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(prefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip || req.socket.remoteAddress ||
      '127.0.0.1';
    const key = `${prefix}:${clientIp}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'تم تجاوز الحد المسموح من الطلبات المتكررة. يرجى الانتظار قليلاً والمحاولة مجدداً لأسباب أمنية.',
      });
    }
    entry.count += 1;
    next();
  };
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---------------------------------------------------------------------------
// HEALTH (diagnostics): booleans + project host only — never secrets.
// ---------------------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: isSupabaseConfigured,
    supabase_configured: isSupabaseConfigured,
    supabase_host: SUPABASE_HOST || null,
    has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    has_owner_email: Boolean(process.env.OWNER_EMAIL),
    node_env: process.env.NODE_ENV || null,
  });
});

// ---------------------------------------------------------------------------
// AUTH (Phase 2): Supabase JWT only.
// ---------------------------------------------------------------------------
app.use('/api/auth', rateLimit('auth', 30, 60_000), authRouter);

// ---------------------------------------------------------------------------
// COMPATIBILITY (legacy dashboard endpoints, permission-guarded per route).
// Mounted BEFORE the store router so admin-only URLs like /api/orders,
// /api/coupons and /api/settings are answered by the guarded handlers.
// ---------------------------------------------------------------------------
app.use('/api', rateLimit('compat', 120, 60_000), compatRouter);

// ---------------------------------------------------------------------------
// STORE (Phase 3): products, categories, orders (server-priced), coupons.
// ---------------------------------------------------------------------------
app.use('/api', rateLimit('store', 120, 60_000), storeRouter);

// ---------------------------------------------------------------------------
// PAYMENTS (Phase 4): translate the legacy dashboard review body
// { order_id, action } into the canonical { submission_id, decision } shape.
// ---------------------------------------------------------------------------
app.use(
  '/api/payments',
  rateLimit('payments', 60, 60_000),
  async (req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/review' && req.method === 'POST' && req.body && typeof req.body === 'object') {
      const body = req.body as Record<string, unknown>;
      const action = String(body.action ?? '').toLowerCase();
      if (action === 'approve') body.decision = 'approve';
      if (action === 'reject') body.decision = 'reject';
      const legacyOrderId = String(body.order_id ?? '');
      if (legacyOrderId && !body.submission_id) {
        const { data: submission } = await supabaseAdmin
          .from('payment_submissions')
          .select('id')
          .eq('order_id', legacyOrderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (submission) body.submission_id = submission.id;
      }
    }
    next();
  },
  paymentsRouter
);

// ---------------------------------------------------------------------------
// UPLOADS + DOWNLOADS (Phase 5): private Storage buckets, signed URLs.
// ---------------------------------------------------------------------------
app.use('/api/upload', rateLimit('upload', 20, 60_000), uploadRouter);
app.use('/api/downloads', rateLimit('downloads', 60, 60_000), downloadsRouter);

// ---------------------------------------------------------------------------
// ADMIN (Phase 6): per-route permission guards; role from DB via JWT.
// ---------------------------------------------------------------------------
app.use('/api/admin', rateLimit('admin', 120, 60_000), adminRouter);
app.use('/api/admin', rateLimit('manage', 60, 60_000), manageRouter);

// ---------------------------------------------------------------------------
// SPA static serving (Vite build output)
// ---------------------------------------------------------------------------
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'المسار غير موجود' });
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

// Always answer API errors as JSON (Express 4 would send an HTML stack page,
// which the UI could not parse and reported as a silent login failure).
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  console.error('[api] unhandled error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', code: 'internal_error' });
  }
  next(err);
});

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(`Zarnix Group development server listening on 0.0.0.0:${PORT}`);
  });
}

export default app;

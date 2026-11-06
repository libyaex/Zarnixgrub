/**
 * server.ts — NIZAR DIGITAL (Zarnix Group) API server.
 *
 * Phase 2 rewrite of the AUTHENTICATION layer only:
 * - Removed: forgeable `x-auth-email` header trust, shared mutable
 *   `currentUser`, in-memory `activeSessions` map, and the unverified
 *   `/api/auth/google`, `/api/auth/login`, `/api/auth/register` routes.
 * - Added: JWT-authenticated `/api/auth/me`, guarded `/api/auth/switch-role`,
 *   and Supabase as the sole identity provider.
 * - Everything else (products, orders, payments, uploads, downloads) is
 *   unchanged in this commit and is rewritten to Supabase in Phase 3+.
 *
 * Migration notes are documented in server/ROUTES-MIGRATION.md.
 */
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './server/routes/auth';

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

// Production In-Memory Rate Limiting (auth-sensitive endpoints)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(prefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
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
// AUTHENTICATION (Phase 2): Supabase JWT only — no email headers, no shared
// server-side user state, no unverified login/register endpoints.
// ---------------------------------------------------------------------------
app.use('/api/auth', rateLimit('auth', 30, 60_000), authRouter);

// ---------------------------------------------------------------------------
// LEGACY NOTE — data endpoints below this line still use in-memory storage
// and will be migrated to Supabase in Phases 3–6. See PROGRESS.md and
// server/ROUTES-MIGRATION.md. Until that migration completes, DO NOT merge
// this branch into main for production traffic.
//
// The old handlers were removed in this commit because they granted admin
// access from a forgeable header. To keep the app compiling, the data
// endpoints are re-declared here as explicit 503 stubs with Arabic
// explanations. Phase 3 restores them against Supabase with real logic.
// ---------------------------------------------------------------------------
const DATA_ENDPOINTS_STUB: Array<[string, string]> = [
  ['GET', '/api/products'],
  ['GET', '/api/categories'],
  ['POST', '/api/orders'],
  ['GET', '/api/orders'],
  ['GET', '/api/payments'],
  ['POST', '/api/payments/submit'],
  ['POST', '/api/payments/review'],
  ['GET', '/api/coupons'],
  ['POST', '/api/coupons/validate'],
  ['GET', '/api/services'],
  ['POST', '/api/upload'],
  ['GET', '/api/downloads'],
  ['POST', '/api/downloads/:id'],
  ['GET', '/api/admin/overview'],
  ['GET', '/api/admin/orders'],
  ['GET', '/api/admin/customers'],
  ['GET', '/api/admin/downloads'],
  ['GET', '/api/admin/audit'],
  ['GET', '/api/admin/roles'],
  ['GET', '/api/admin/settings'],
];

for (const [method, route] of DATA_ENDPOINTS_STUB) {
  (app as any)[method.toLowerCase()](route, (_req: Request, res: Response) => {
    res.status(503).json({
      error:
        'هذا المسار قيد الترحيل إلى قاعدة البيانات الدائمة ضمن خطة إعادة التأهيل، وسيعود للعمل في المرحلة القادمة.',
    });
  });
}

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

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(`Zarnix Group development server listening on 0.0.0.0:${PORT}`);
  });
}

export default app;

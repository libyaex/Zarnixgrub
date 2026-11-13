/**
 * server.ts — NIZAR DIGITAL (Zarnix Group) API server.
 *
 * Identity, data and files all live in Supabase; this process holds no state.
 *  - Auth: Supabase JWT verified per request (never headers / browser roles).
 *  - Every router is wrapped with protectRouter so a rejected promise in an
 *    async handler becomes a JSON 500 instead of a hung request.
 *  - Body limit is 1 MB: files never travel through the API (signed uploads).
 *
 * ESM NOTE: relative imports carry explicit `.ts` extensions (Node ESM).
 */
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './server/routes/auth.ts';
import { storeRouter } from './server/routes/store.ts';
import { paymentsRouter } from './server/routes/payments.ts';
import { uploadRouter } from './server/routes/upload.ts';
import { downloadsRouter } from './server/routes/downloads.ts';
import { adminRouter } from './server/routes/admin.ts';
import { manageRouter } from './server/routes/manage.ts';
import { dashboardRouter } from './server/routes/dashboard.ts';
import { isSupabaseConfigured, SUPABASE_HOST } from './server/lib/supabaseAdmin.ts';
import { requireAuth, requireStaff } from './server/lib/auth.ts';
import { protectRouter } from './server/lib/asyncSafe.ts';
import { createRateLimiter } from './server/lib/rateLimit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Vercel terminates TLS in front of us: trust exactly one proxy hop for req.ip.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use('/api', express.json({ limit: '1mb' }));

// Rate limits (best-effort, per serverless instance): public reads per IP,
// writes stricter, authenticated admin traffic per user (limiter runs after auth).
const publicLimit = createRateLimiter('api', 300, 60_000);
const writeLimit = createRateLimiter('write', 60, 60_000);
const authLimit = createRateLimiter('auth', 60, 60_000);
const adminLimit = createRateLimiter('admin', 600, 60_000);
app.use('/api', publicLimit);
app.use('/api', (req, res, next) => (req.method === 'GET' ? next() : writeLimit(req, res, next)));

// Health (diagnostics): booleans + project host only — never secrets.
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

app.use('/api/auth', authLimit, protectRouter(authRouter));
app.use('/api/payments', protectRouter(paymentsRouter));
app.use('/api/upload', protectRouter(uploadRouter));
app.use('/api/downloads', protectRouter(downloadsRouter));

// Admin: authenticate ONCE, require staff, then per-route permissions.
app.use(
  '/api/admin',
  requireAuth,
  requireStaff,
  adminLimit,
  protectRouter(dashboardRouter),
  protectRouter(adminRouter),
  protectRouter(manageRouter)
);

// Storefront routes (products, categories, orders, coupons, services, banks).
app.use('/api', protectRouter(storeRouter));

// SPA static serving (Vite build output)
const distDir = path.join(__dirname, 'dist');
app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(distDir, { maxAge: 0 }));

app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'المسار غير موجود', code: 'not_found' });
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

// Always answer API errors as JSON (Express 4 would send an HTML stack page).
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  const status = (err as { status?: number })?.status;
  if (status === 413) {
    return res.status(413).json({ error: 'حجم الطلب كبير جداً', code: 'payload_too_large' });
  }
  if (status === 400 && (err as { type?: string })?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'صيغة JSON غير صالحة', code: 'bad_json' });
  }
  console.error('[api] unhandled error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', code: 'internal_error' });
  }
  next(err);
});

// Vercel imports the app as a serverless handler (api/index.ts); everywhere else we listen.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Zarnix server listening on 0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

export default app;

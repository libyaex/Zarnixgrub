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
import fs from 'node:fs/promises';
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
import { notificationsRouter } from './server/routes/notifications.ts';
import { isSupabaseConfigured, SUPABASE_HOST } from './server/lib/supabaseAdmin.ts';
import { requireAuth, requireStaff } from './server/lib/auth.ts';
import { protectRouter } from './server/lib/asyncSafe.ts';
import { createRateLimiter } from './server/lib/rateLimit.ts';
import { supabaseAdmin } from './server/lib/supabaseAdmin.ts';
import { loadSiteConfig } from './server/lib/siteConfig.ts';
import {
  buildHead, injectHead, buildManifest, buildRobots, buildSitemap, productJsonLd, siteOrigin,
  type PageMeta,
} from './server/lib/htmlMeta.ts';

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
app.use('/api/notifications', protectRouter(notificationsRouter));

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

// ---------------------------------------------------------------------------
// Dynamic, dashboard-driven web assets: manifest, robots.txt, sitemap.xml and
// the HTML shell (SEO tags are rendered per page, before any JavaScript runs).
// ---------------------------------------------------------------------------
const distDir = path.join(__dirname, 'dist');

/** Request origin, but never trust an arbitrary Host header for canonical URLs. */
function requestOrigin(req: Request): string {
  const host = req.get('host') ?? '';
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? `${req.protocol}://${host}` : '';
}

async function pageOrigin(req: Request) {
  const cfg = await loadSiteConfig();
  return { cfg, origin: siteOrigin(cfg, requestOrigin(req)) };
}

app.get('/manifest.webmanifest', async (req: Request, res: Response) => {
  const { cfg, origin } = await pageOrigin(req);
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.type('application/manifest+json').send(JSON.stringify(buildManifest(cfg, origin)));
});

app.get('/robots.txt', async (req: Request, res: Response) => {
  const { cfg, origin } = await pageOrigin(req);
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.type('text/plain').send(buildRobots(cfg, origin));
});

app.get('/sitemap.xml', async (req: Request, res: Response) => {
  const { cfg, origin } = await pageOrigin(req);
  const { data } = await supabaseAdmin
    .from('products').select('slug, updated_at').eq('status', 'published').range(0, 4999);
  res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900');
  res.type('application/xml').send(buildSitemap(cfg, origin, data ?? []));
});

let htmlTemplate: string | null = null;
async function readTemplate(origin: string): Promise<string> {
  if (htmlTemplate) return htmlTemplate;
  for (const file of [path.join(distDir, 'index.html'), path.join(__dirname, 'index.html')]) {
    try {
      htmlTemplate = await fs.readFile(file, 'utf8');
      return htmlTemplate;
    } catch { /* try next */ }
  }
  // Serverless bundle without dist/: the CDN serves the static file directly.
  const res = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`index.html unavailable (${res.status})`);
  htmlTemplate = await res.text();
  return htmlTemplate;
}

const POLICY_TITLES: Record<string, string> = {
  terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية', refunds: 'سياسة الاسترجاع والإلغاء',
  digital_goods: 'سياسة المنتجات الرقمية', licensing: 'سياسة الترخيص', support: 'سياسة الدعم الفني',
};

async function metaForPath(pathname: string, cfg: Awaited<ReturnType<typeof loadSiteConfig>>, origin: string): Promise<PageMeta> {
  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (productMatch) {
    let slug = productMatch[1];
    try { slug = decodeURIComponent(slug); } catch { /* keep raw */ }
    const { data: p } = await supabaseAdmin
      .from('products').select('name, slug, short_description, main_image, base_price')
      .eq('slug', slug).eq('status', 'published').maybeSingle();
    if (p) {
      return {
        path: pathname, title: p.name, description: p.short_description, image: p.main_image, ogType: 'product',
        jsonLd: [productJsonLd(p, cfg, origin)],
      };
    }
    return { path: pathname, noindex: true };
  }
  if (pathname === '/products') return { path: pathname, title: 'جميع المنتجات' };
  const policy = pathname.match(/^\/policies\/([^/]+)\/?$/);
  if (policy && POLICY_TITLES[policy[1]]) return { path: pathname, title: POLICY_TITLES[policy[1]] };
  return { path: pathname === '' ? '/' : pathname };
}

app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(distDir, { index: false, maxAge: '1h' }));

app.get('*', async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'المسار غير موجود', code: 'not_found' });
  }
  try {
    const { cfg, origin } = await pageOrigin(req);
    const html = await readTemplate(origin || requestOrigin(req));
    const meta = await metaForPath(req.path, cfg, origin);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.type('html').send(injectHead(html, buildHead(cfg, meta, origin)));
  } catch (error) {
    next(error);
  }
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

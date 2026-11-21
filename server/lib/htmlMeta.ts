/**
 * Pure builders for everything crawlers and the installed app read BEFORE any
 * JavaScript runs: <head> tags, JSON-LD, web manifest, robots.txt, sitemap.xml.
 * Driven entirely by the dashboard settings.
 */
import type { SiteConfig } from '../../src/shared/siteSchema.ts';

export const HEAD_MARKER = '<!--SEO_HEAD-->';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Safe inside <script>: never lets the data close the tag or open a comment. */
export const jsonForScript = (v: unknown): string =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const PRIVATE_PATHS = ['/admin', '/portal', '/cart', '/checkout', '/orders', '/notifications', '/login'];

export function isPrivatePath(path: string): boolean {
  return PRIVATE_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

/** Origin used in canonical URLs: the configured domain, else the request's own. */
export function siteOrigin(cfg: SiteConfig, requestOrigin: string): string {
  const configured = str(cfg.canonical_domain).replace(/\/+$/, '');
  return /^https?:\/\//i.test(configured) ? configured : requestOrigin.replace(/\/+$/, '');
}

export const absoluteUrl = (origin: string, u: string): string =>
  !u ? '' : /^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith('/') ? '' : '/'}${u}`;

export function isIndexable(cfg: SiteConfig, path: string, forceNoindex = false): boolean {
  return Boolean(cfg.seo_allow_indexing) && !cfg.require_login_to_browse && !forceNoindex && !isPrivatePath(path);
}

export interface PageMeta {
  path: string;
  title?: string;
  description?: string;
  image?: string;
  ogType?: 'website' | 'product';
  jsonLd?: Record<string, unknown>[];
  noindex?: boolean;
}

export function organizationJsonLd(cfg: SiteConfig, origin: string): Record<string, unknown>[] {
  const sameAs = ['facebook_url', 'instagram_url', 'x_url', 'youtube_url', 'linkedin_url', 'tiktok_url']
    .map((k) => str(cfg[k])).filter(Boolean);
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: cfg.store_name,
    url: origin,
    logo: absoluteUrl(origin, str(cfg.logo_url)),
  };
  if (sameAs.length) org.sameAs = sameAs;
  if (cfg.support_email || cfg.support_phone) {
    org.contactPoint = {
      '@type': 'ContactPoint', contactType: 'customer support',
      ...(cfg.support_email ? { email: cfg.support_email } : {}),
      ...(cfg.support_phone ? { telephone: cfg.support_phone } : {}),
    };
  }
  return [org, { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.store_name, url: origin }];
}

export function productJsonLd(
  p: { name: string; slug: string; short_description?: string; main_image?: string; base_price: number | string },
  cfg: SiteConfig, origin: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.short_description ?? '',
    image: p.main_image && !p.main_image.startsWith('data:') ? absoluteUrl(origin, p.main_image) : undefined,
    url: `${origin}/products/${encodeURIComponent(p.slug)}`,
    brand: { '@type': 'Brand', name: cfg.store_name },
    offers: {
      '@type': 'Offer', priceCurrency: 'LYD', price: Number(p.base_price),
      availability: 'https://schema.org/InStock',
      url: `${origin}/products/${encodeURIComponent(p.slug)}`,
    },
  };
}

/** The complete <head> fragment for a page (replaces HEAD_MARKER). */
export function buildHead(cfg: SiteConfig, meta: PageMeta, origin: string): string {
  const suffix = str(cfg.seo_title_suffix);
  const title = meta.title ? `${meta.title}${suffix}` : str(cfg.seo_title) || str(cfg.store_name);
  const description = meta.description || str(cfg.seo_description);
  const image = absoluteUrl(origin, meta.image || str(cfg.seo_og_image) || str(cfg.logo_url));
  const url = `${origin}${meta.path === '/' ? '' : meta.path}` || origin;
  const indexable = isIndexable(cfg, meta.path, meta.noindex);
  const favicon = str(cfg.favicon_url) || str(cfg.logo_url);
  const touch = str(cfg.pwa_icon_192) || str(cfg.logo_url);
  const handle = str(cfg.seo_twitter_handle);

  const tags: string[] = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    cfg.seo_keywords ? `<meta name="keywords" content="${esc(cfg.seo_keywords)}" />` : '',
    `<meta name="robots" content="${indexable ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}" />`,
    indexable ? `<link rel="canonical" href="${esc(url)}" />` : '',
    `<meta property="og:site_name" content="${esc(cfg.store_name)}" />`,
    `<meta property="og:type" content="${meta.ogType ?? 'website'}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:locale" content="ar_AR" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
    handle ? `<meta name="twitter:site" content="${esc(handle.startsWith('@') ? handle : '@' + handle)}" />` : '',
    `<meta name="theme-color" content="${esc(cfg.pwa_theme_color)}" />`,
    `<link rel="manifest" href="/manifest.webmanifest" />`,
    favicon ? `<link rel="icon" href="${esc(favicon)}" />` : '',
    touch ? `<link rel="apple-touch-icon" href="${esc(touch)}" />` : '',
    cfg.seo_google_verification ? `<meta name="google-site-verification" content="${esc(cfg.seo_google_verification)}" />` : '',
    cfg.seo_bing_verification ? `<meta name="msvalidate.01" content="${esc(cfg.seo_bing_verification)}" />` : '',
  ].filter(Boolean);

  const ld = meta.jsonLd ?? (meta.path === '/' ? organizationJsonLd(cfg, origin) : []);
  for (const block of ld) tags.push(`<script type="application/ld+json">${jsonForScript(block)}</script>`);

  const ga = str(cfg.analytics_ga_id);
  if (/^G-[A-Z0-9]{4,20}$/.test(ga)) {
    tags.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');</script>`
    );
  }
  // Branding is available before first paint (no flash of default name/logo).
  tags.push(`<script>window.__SITE_CONFIG__=${jsonForScript(cfg)};</script>`);
  return tags.join('\n    ');
}

export function injectHead(html: string, head: string): string {
  if (html.includes(HEAD_MARKER)) return html.replace(HEAD_MARKER, () => head);
  return html.replace('</head>', () => `    ${head}\n  </head>`);
}

const mimeOf = (src: string): string =>
  /\.webp(\?|$)/i.test(src) ? 'image/webp' : /\.(jpe?g)(\?|$)/i.test(src) ? 'image/jpeg' : /\.svg(\?|$)/i.test(src) ? 'image/svg+xml' : 'image/png';

export function buildManifest(cfg: SiteConfig, origin: string): Record<string, unknown> {
  const icon = (src: string, sizes: string, purpose: string) => ({ src: absoluteUrl(origin, src), sizes, type: mimeOf(src), purpose });
  const i192 = str(cfg.pwa_icon_192) || '/icons/icon-192.png';
  const i512 = str(cfg.pwa_icon_512) || '/icons/icon-512.png';
  const maskable = str(cfg.pwa_icon_maskable) || i512;
  return {
    id: '/',
    name: cfg.pwa_name || cfg.store_name,
    short_name: cfg.pwa_short_name || String(cfg.store_name).slice(0, 12),
    description: cfg.seo_description,
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    lang: 'ar',
    dir: 'rtl',
    theme_color: cfg.pwa_theme_color,
    background_color: cfg.pwa_background_color,
    categories: ['shopping', 'business', 'productivity'],
    prefer_related_applications: false,
    icons: [icon(i192, '192x192', 'any'), icon(i512, '512x512', 'any'), icon(maskable, '512x512', 'maskable')],
    shortcuts: [
      { name: 'تصفح المنتجات', short_name: 'المنتجات', url: '/products?source=shortcut', icons: [icon(i192, '192x192', 'any')] },
      { name: 'تحميلاتي', short_name: 'تحميلاتي', url: '/portal/downloads?source=shortcut', icons: [icon(i192, '192x192', 'any')] },
      { name: 'الإشعارات', short_name: 'الإشعارات', url: '/notifications?source=shortcut', icons: [icon(i192, '192x192', 'any')] },
    ],
  };
}

export function buildRobots(cfg: SiteConfig, origin: string): string {
  if (!isIndexable(cfg, '/')) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /portal',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /orders',
    'Disallow: /notifications',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemap(
  cfg: SiteConfig, origin: string,
  products: Array<{ slug: string; updated_at?: string | null }>
): string {
  const urls: Array<{ loc: string; lastmod?: string; priority: string }> = [];
  if (isIndexable(cfg, '/')) {
    urls.push({ loc: origin + '/', priority: '1.0' }, { loc: origin + '/products', priority: '0.9' });
    for (const tab of ['terms', 'privacy', 'refunds']) urls.push({ loc: `${origin}/policies/${tab}`, priority: '0.3' });
    for (const p of products) {
      urls.push({
        loc: `${origin}/products/${encodeURIComponent(p.slug)}`,
        lastmod: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : undefined,
        priority: '0.8',
      });
    }
  }
  const body = urls.map((u) =>
    `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

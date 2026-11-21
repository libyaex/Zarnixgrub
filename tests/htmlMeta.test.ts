import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, mergeSettings } from '../src/shared/siteSchema.ts';
import {
  buildHead, injectHead, buildManifest, buildRobots, buildSitemap, esc, jsonForScript,
  siteOrigin, isIndexable, productJsonLd, HEAD_MARKER,
} from '../server/lib/htmlMeta.ts';

const open = mergeSettings({ require_login_to_browse: false, store_name: 'متجر "الاختبار" <b>' });
const ORIGIN = 'https://shop.example';

test('escaping: attributes and inline script data cannot break out', () => {
  assert.equal(esc(`"><script>`), '&quot;&gt;&lt;script&gt;');
  assert.ok(!jsonForScript({ a: '</script><script>alert(1)' }).includes('</script>'));
  const head = buildHead(open, { path: '/' }, ORIGIN);
  assert.ok(!head.includes('<b>'), 'store name must be escaped in meta tags');
  assert.ok(head.includes('&lt;b&gt;'));
});

test('home page head: title, description, og, canonical, manifest, JSON-LD, hydrated config', () => {
  const head = buildHead(open, { path: '/' }, ORIGIN);
  assert.match(head, /<title>/);
  assert.match(head, /name="description"/);
  assert.match(head, /property="og:title"/);
  assert.match(head, /rel="canonical" href="https:\/\/shop\.example"/);
  assert.match(head, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(head, /application\/ld\+json/);
  assert.match(head, /window\.__SITE_CONFIG__=/);
  assert.match(head, /content="index,follow/);
});

test('product page: custom title with suffix, absolute og:image, Product JSON-LD with LYD offer', () => {
  const p = { name: 'نظام محاسبة', slug: 'acc-system', short_description: 'وصف', main_image: '/img/a.jpg', base_price: '1500.00' };
  const head = buildHead(open, { path: '/products/acc-system', title: p.name, description: p.short_description, image: p.main_image, ogType: 'product', jsonLd: [productJsonLd(p, open, ORIGIN)] }, ORIGIN);
  assert.match(head, /<title>نظام محاسبة \| ZARNIX-Group<\/title>/);
  assert.match(head, /og:image" content="https:\/\/shop\.example\/img\/a\.jpg"/);
  assert.match(head, /"priceCurrency":"LYD"/);
  assert.match(head, /"price":1500/);
});

test('indexing rules: login wall, master switch, private paths and per-page noindex all force noindex', () => {
  assert.equal(isIndexable(open, '/'), true);
  assert.equal(isIndexable(mergeSettings({ require_login_to_browse: true }), '/'), false);
  assert.equal(isIndexable(mergeSettings({ require_login_to_browse: false, seo_allow_indexing: false }), '/'), false);
  assert.equal(isIndexable(open, '/cart'), false);
  assert.equal(isIndexable(open, '/portal/downloads'), false);
  assert.equal(isIndexable(open, '/products/x', true), false);
  const head = buildHead(defaultSettings(), { path: '/' }, ORIGIN); // default = login wall ON
  assert.match(head, /noindex,nofollow/);
  assert.ok(!head.includes('rel="canonical"'));
});

test('injectHead replaces the marker, or falls back to </head>', () => {
  assert.equal(injectHead(`<head>${HEAD_MARKER}</head>`, 'X'), '<head>X</head>');
  assert.match(injectHead('<head></head>', 'X'), /X\n {2}<\/head>/);
  assert.equal(injectHead(`<head>${HEAD_MARKER}</head>`, 'a$&b'), '<head>a$&b</head>', 'replacement text must not be treated as a pattern');
});

test('manifest: installable, RTL Arabic, maskable icon, shortcuts, colors from settings', () => {
  const m: any = buildManifest(mergeSettings({ pwa_name: 'My App', pwa_short_name: 'Mine', pwa_theme_color: '#112233' }), ORIGIN);
  assert.equal(m.name, 'My App');
  assert.equal(m.short_name, 'Mine');
  assert.equal(m.display, 'standalone');
  assert.equal(m.dir, 'rtl');
  assert.equal(m.theme_color, '#112233');
  assert.ok(m.icons.some((i: any) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'maskable'));
  assert.ok(m.icons.every((i: any) => i.src.startsWith('https://')));
  assert.ok(m.shortcuts.length >= 3);
});

test('robots.txt and sitemap follow the indexing switches', () => {
  assert.match(buildRobots(open, ORIGIN), /Sitemap: https:\/\/shop\.example\/sitemap\.xml/);
  assert.match(buildRobots(open, ORIGIN), /Disallow: \/admin/);
  assert.equal(buildRobots(defaultSettings(), ORIGIN), 'User-agent: *\nDisallow: /\n');
  const xml = buildSitemap(open, ORIGIN, [{ slug: 'a b', updated_at: '2026-03-04T00:00:00Z' }, { slug: 'x&y' }]);
  assert.match(xml, /<loc>https:\/\/shop\.example\/products\/a%20b<\/loc><lastmod>2026-03-04<\/lastmod>/);
  assert.ok(xml.includes('x%26y'));
  assert.ok(!buildSitemap(defaultSettings(), ORIGIN, [{ slug: 'a' }]).includes('<loc>'), 'no URLs when the store is behind a login wall');
});

test('origin: configured canonical domain wins over the request origin', () => {
  assert.equal(siteOrigin(mergeSettings({ canonical_domain: 'https://real.com/' }), 'http://x.vercel.app'), 'https://real.com');
  assert.equal(siteOrigin(defaultSettings(), 'https://x.vercel.app/'), 'https://x.vercel.app');
});

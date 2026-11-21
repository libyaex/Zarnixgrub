/**
 * Runtime site configuration. Everything the owner edits in
 * Dashboard -> Settings (brand, hero text, contact, SEO, PWA, flags) arrives
 * here: first from the HTML the server rendered (no flash of default branding),
 * then refreshed from /api/site.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { mergeSettings, type SiteConfig } from '../shared/siteSchema';
import { paletteFromAccent } from '../lib/color';
import { apiFetch } from '../lib/api';

declare global {
  interface Window { __SITE_CONFIG__?: Record<string, unknown> }
}

const DEFAULT_ACCENT = '#10b981';
const SiteContext = createContext<SiteConfig>(mergeSettings({}));
export const useSite = (): SiteConfig => useContext(SiteContext);

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}

/** Applies branding to the live document: theme color, favicon and the global accent palette. */
export function applyBranding(cfg: SiteConfig): void {
  const root = document.documentElement;
  const accent = String(cfg.accent_color || DEFAULT_ACCENT).toLowerCase();
  const palette = accent === DEFAULT_ACCENT ? null : paletteFromAccent(accent);
  // Tailwind v4 reads colors from CSS variables, so overriding emerald re-themes the whole UI.
  for (const shade of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']) {
    if (palette) root.style.setProperty(`--color-emerald-${shade}`, palette[shade]);
    else root.style.removeProperty(`--color-emerald-${shade}`);
  }
  setMeta('meta[name="theme-color"]', () => Object.assign(document.createElement('meta'), { name: 'theme-color' }), 'content', String(cfg.pwa_theme_color));
  const favicon = String(cfg.favicon_url || cfg.logo_url || '');
  if (favicon) setMeta('link[rel="icon"]', () => Object.assign(document.createElement('link'), { rel: 'icon' }), 'href', favicon);
}

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cfg, setCfg] = useState<SiteConfig>(() => mergeSettings(window.__SITE_CONFIG__ ?? {}));

  useEffect(() => {
    let alive = true;
    const load = () => {
      apiFetch('/api/site')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (alive && data) setCfg(mergeSettings(data)); })
        .catch(() => { /* keep what we have (offline) */ });
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  useEffect(() => { applyBranding(cfg); }, [cfg]);

  return <SiteContext.Provider value={cfg}>{children}</SiteContext.Provider>;
};

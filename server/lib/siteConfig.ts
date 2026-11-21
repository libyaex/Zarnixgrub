/** Runtime site configuration: DB overrides merged over schema defaults, cached briefly. */
import { supabaseAdmin } from './supabaseAdmin.ts';
import { mergeSettings, type SiteConfig } from '../../src/shared/siteSchema.ts';

const TTL_MS = 30_000;
let cache: { at: number; value: SiteConfig } | null = null;

export function invalidateSiteConfig(): void {
  cache = null;
}

export async function loadSiteConfig(): Promise<SiteConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { data, error } = await supabaseAdmin.from('site_settings').select('setting_key, setting_value');
  if (error) {
    console.error('[site] could not load settings, using defaults:', error.message);
    return cache?.value ?? mergeSettings({});
  }
  const stored: Record<string, unknown> = {};
  for (const row of data ?? []) {
    const v = row.setting_value as { value?: unknown } | null;
    stored[row.setting_key] = v && typeof v === 'object' && 'value' in v ? v.value : row.setting_value;
  }
  const value = mergeSettings(stored);
  cache = { at: Date.now(), value };
  return value;
}

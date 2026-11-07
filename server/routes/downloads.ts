/**
 * Phase 5 — Secure downloads backed by Supabase Storage.
 * ALIGNED WITH THE PRODUCTION SCHEMA:
 * - download_logs has `timestamp` (not created_at) and references orders/files.
 * - Entitlements reference auth.users directly.
 * Fixes:
 * - No fake placeholder files: entitlements point to real product_files.
 * - Download URLs are SIGNED and expire in 5 minutes; storage paths are
 *   never exposed to the browser.
 * - Download attempts are counted and logged; limits are enforced.
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions — required
 * by Node ESM on Vercel (ERR_MODULE_NOT_FOUND otherwise).
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth } from '../lib/auth.ts';

export const downloadsRouter = Router();

const SIGNED_URL_TTL_SECONDS = 300;

/** GET /api/downloads — authenticated: the caller's own entitlements only. */
downloadsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('download_entitlements')
    .select('id, order_id, product_id, product_file_id, allowed_downloads, used_downloads, expires_at, is_active')
    .eq('user_id', req.user!.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل حصص التحميل' });
    return;
  }

  // Enrich with product and file metadata without exposing storage paths.
  const enriched = await Promise.all(
    (data ?? []).map(async (ent) => {
      const { data: file } = await supabaseAdmin
        .from('product_files')
        .select('file_name, file_size, version, mime_type')
        .eq('id', ent.product_file_id)
        .single();
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('name')
        .eq('id', ent.product_id)
        .single();
      return {
        ...ent,
        file_name: file?.file_name ?? 'ملف',
        file_size: file?.file_size ?? 0,
        version: file?.version ?? '1.0.0',
        product_name: product?.name ?? '',
      };
    })
  );
  res.json(enriched);
});

/**
 * POST /api/downloads/:id — authenticated: generate a short-lived signed
 * download URL for one of the caller's own entitlements.
 */
downloadsRouter.post('/:id', requireAuth, async (req: Request, res: Response) => {
  const { data: ent, error: entError } = await supabaseAdmin
    .from('download_entitlements')
    .select('*, product_files!inner(storage_path, file_name, is_active, is_downloadable)')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();
  if (entError || !ent) {
    res.status(404).json({ error: 'لا يوجد استحقاق تحميل بهذا المعرف' });
    return;
  }

  const file = ent.product_files as {
    storage_path: string;
    file_name: string;
    is_active: boolean;
    is_downloadable: boolean;
  };
  if (!file.is_active || !file.is_downloadable) {
    res.status(410).json({ error: 'هذا الملف لم يعد متاحاً للتحميل' });
    return;
  }

  if (ent.expires_at && new Date(ent.expires_at) < new Date()) {
    await supabaseAdmin.from('download_entitlements').update({ is_active: false }).eq('id', ent.id);
    res.status(410).json({ error: 'انتهت صلاحية رخصة التحميل لهذا الملف' });
    return;
  }
  if (ent.used_downloads >= ent.allowed_downloads) {
    res.status(429).json({ error: 'استنفدت جميع محاولات التحميل المسموح بها' });
    return;
  }

  // Optimistic concurrency: only succeed if the counter is still below limit.
  const { data: updated, error: countError } = await supabaseAdmin
    .from('download_entitlements')
    .update({ used_downloads: ent.used_downloads + 1 })
    .eq('id', ent.id)
    .lt('used_downloads', ent.allowed_downloads)
    .select('id')
    .single();
  if (countError || !updated) {
    res.status(429).json({ error: 'استنفدت جميع محاولات التحميل المسموح بها' });
    return;
  }

  const { data: urlData, error: urlError } = await supabaseAdmin.storage
    .from('project_files')
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS, { download: file.file_name });
  if (urlError || !urlData) {
    await supabaseAdmin
      .from('download_entitlements')
      .update({ used_downloads: ent.used_downloads })
      .eq('id', ent.id);
    res.status(500).json({ error: 'تعذر توليد رابط التحميل الآمن' });
    return;
  }

  // Schema: download_logs uses `timestamp` (default NOW()), not created_at.
  await supabaseAdmin.from('download_logs').insert({
    entitlement_id: ent.id,
    user_id: req.user!.id,
    file_id: ent.product_file_id,
    order_id: ent.order_id,
    status: 'success',
  });

  res.json({ download_url: urlData.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS });
});

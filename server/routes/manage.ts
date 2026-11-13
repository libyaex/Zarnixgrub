/**
 * Phase 6 (part 2) — Admin WRITE endpoints backed by Supabase.
 * ALIGNED WITH THE PRODUCTION SCHEMA (supabase/schema.sql):
 * - products: full_description, main_image, short_description (NOT
 *   description/cover_image_url/sale_price).
 * - bank accounts: payment_accounts (bank_name, account_holder,
 *   account_number, iban, instructions, is_default).
 * - services: service_tasks catalog via products; there is no separate
 *   `services` table in the production schema, so service management
 *   works through product options and service_tasks.
 * - site_settings: key/value rows (setting_key, setting_value JSONB).
 * Every mutation requires authentication plus a specific permission and
 * records an audit_logs row. audit_logs.details is JSONB and
 * audit_logs has admin_id (auth.users FK) — no admin_name column.
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions — required
 * by Node ESM on Vercel (ERR_MODULE_NOT_FOUND otherwise).
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requirePermission } from '../lib/auth.ts';

export const manageRouter = Router();

async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>
) {
  await supabaseAdmin.from('audit_logs').insert({
    admin_id: req.user!.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}

const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : fallback;

// ---------------------------------------------------------------------------
// CATEGORIES (schema: name, slug, description, image_path, sort_order, is_active)
// ---------------------------------------------------------------------------
manageRouter.post('/categories', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    name: str(body.name, 120),
    slug: str(body.slug, 120),
    description: str(body.description, 500),
    image_path: str(body.image_path, 1000),
    sort_order: num(body.sort_order) ?? 0,
    is_active: bool(body.is_active, true),
  };
  if (!payload.name || !payload.slug) {
    res.status(400).json({ error: 'الاسم والمعرف النصي (slug) مطلوبان' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('categories').insert(payload).select().single();
  if (error || !data) {
    res.status(500).json({ error: 'تعذر إنشاء التصنيف — تأكد أن المعرف غير مستخدم' });
    return;
  }
  await audit(req, 'create', 'category', data.id, { name: payload.name });
  res.status(201).json({ category: data });
});

manageRouter.put('/categories/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (str(body.name, 120)) updates.name = str(body.name, 120);
  if (str(body.description, 500)) updates.description = str(body.description, 500);
  if (str(body.image_path, 1000)) updates.image_path = str(body.image_path, 1000);
  if (num(body.sort_order) !== null) updates.sort_order = num(body.sort_order);
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

  const { data, error } = await supabaseAdmin.from('categories').update(updates).eq('id', req.params.id).select().single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على التصنيف' });
    return;
  }
  await audit(req, 'update', 'category', req.params.id, updates);
  res.json({ category: data });
});

// ---------------------------------------------------------------------------
// COUPONS (schema: code, discount_type, discount_value, minimum_order,
// max_uses, used_count, starts_at, expires_at, is_active)
// ---------------------------------------------------------------------------
manageRouter.post('/coupons', requirePermission('manage_coupons'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    code: (str(body.code, 64) ?? '').toUpperCase(),
    discount_type: ['percentage', 'fixed'].includes(String(body.discount_type)) ? body.discount_type : null,
    discount_value: num(body.discount_value),
    minimum_order: num(body.minimum_order) ?? 0,
    max_uses: num(body.max_uses) ?? 100,
    starts_at: str(body.starts_at, 40) ?? new Date().toISOString(),
    expires_at: str(body.expires_at, 40),
    is_active: bool(body.is_active, true),
  };
  if (!payload.code || !payload.discount_type || payload.discount_value === null) {
    res.status(400).json({ error: 'الكود ونوع وقيمة الخصم مطلوبة' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('coupons').insert(payload).select().single();
  if (error || !data) {
    res.status(500).json({ error: 'تعذر إنشاء كود الخصم — تأكد أن الكود غير مستخدم مسبقاً' });
    return;
  }
  await audit(req, 'create', 'coupon', data.id, { code: payload.code });
  res.status(201).json({ coupon: data });
});

manageRouter.put('/coupons/:id', requirePermission('manage_coupons'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (num(body.discount_value) !== null) updates.discount_value = num(body.discount_value);
  if (num(body.minimum_order) !== null) updates.minimum_order = num(body.minimum_order);
  if (num(body.max_uses) !== null) updates.max_uses = num(body.max_uses);
  if (str(body.expires_at, 40)) updates.expires_at = str(body.expires_at, 40);
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

  const { data, error } = await supabaseAdmin.from('coupons').update(updates).eq('id', req.params.id).select().single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على كود الخصم' });
    return;
  }
  await audit(req, 'update', 'coupon', req.params.id, updates);
  res.json({ coupon: data });
});

manageRouter.delete('/coupons/:id', requirePermission('manage_coupons'), async (req: Request, res: Response) => {
  const { error } = await supabaseAdmin.from('coupons').update({ is_active: false }).eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: 'تعذر تعطيل كود الخصم' });
    return;
  }
  await audit(req, 'deactivate', 'coupon', req.params.id, {});
  res.json({ success: true, message: 'تم تعطيل كود الخصم' });
});

// ---------------------------------------------------------------------------
// BANK ACCOUNTS (production schema: payment_accounts with account_holder)
// ---------------------------------------------------------------------------
manageRouter.post('/banks', requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    bank_name: str(body.bank_name, 120),
    account_holder: str(body.account_holder ?? body.account_name, 120),
    account_number: str(body.account_number, 64),
    iban: str(body.iban, 64),
    instructions: str(body.instructions, 1000),
    is_active: bool(body.is_active, true),
    is_default: bool(body.is_default),
  };
  if (!payload.bank_name || !payload.account_holder || !payload.account_number) {
    res.status(400).json({ error: 'اسم البنك واسم صاحب الحساب والرقم مطلوبة' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('payment_accounts').insert(payload).select().single();
  if (error || !data) {
    res.status(500).json({ error: 'تعذر إضافة الحساب البنكي' });
    return;
  }
  await audit(req, 'create', 'payment_account', data.id, { bank_name: payload.bank_name });
  res.status(201).json({ bank: data });
});

manageRouter.put('/banks/:id', requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (str(body.bank_name, 120)) updates.bank_name = str(body.bank_name, 120);
  if (str(body.account_holder ?? body.account_name, 120)) updates.account_holder = str(body.account_holder ?? body.account_name, 120);
  if (str(body.account_number, 64)) updates.account_number = str(body.account_number, 64);
  if (str(body.iban, 64)) updates.iban = str(body.iban, 64);
  if (str(body.instructions, 1000)) updates.instructions = str(body.instructions, 1000);
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (typeof body.is_default === 'boolean') updates.is_default = body.is_default;

  const { data, error } = await supabaseAdmin.from('payment_accounts').update(updates).eq('id', req.params.id).select().single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على الحساب البنكي' });
    return;
  }
  await audit(req, 'update', 'payment_account', req.params.id, updates);
  res.json({ bank: data });
});

// ---------------------------------------------------------------------------
// SITE SETTINGS (production schema: key/value rows setting_key/setting_value)
// PUT /api/admin/settings expects { entries: [{ key, value }] }
// ---------------------------------------------------------------------------
manageRouter.put('/settings', requirePermission('manage_settings'), async (req: Request, res: Response) => {
  const entries: Array<{ key?: unknown; value?: unknown }> = Array.isArray(req.body?.entries) ? req.body.entries : [];
  if (entries.length === 0) {
    res.status(400).json({ error: 'لا توجد إعدادات للحفظ' });
    return;
  }

  const saved: string[] = [];
  for (const entry of entries.slice(0, 50)) {
    const key = str(entry.key, 100);
    if (!key) continue;
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({ setting_key: key, setting_value: { value: entry.value ?? null }, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
    if (error) {
      res.status(500).json({ error: `تعذر حفظ الإعداد: ${key}` });
      return;
    }
    saved.push(key);
  }

  await audit(req, 'update', 'site_settings', 'bulk', { keys: saved });
  res.json({ settings: { saved_keys: saved } });
});

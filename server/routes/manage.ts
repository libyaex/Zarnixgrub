/**
 * Phase 6 (part 2) — Admin WRITE endpoints backed by Supabase.
 *
 * Every mutation requires authentication plus a specific permission and
 * records an audit_logs row. These endpoints let the dashboard actually
 * create and update data persistently (the old in-memory handlers lost
 * everything on restart).
 *
 * Mounted at /api/admin in server.ts alongside the read-only admin router.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, requirePermission } from '../lib/auth';

export const manageRouter = Router();

manageRouter.use(requireAuth);

async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>
) {
  await supabaseAdmin.from('audit_logs').insert({
    admin_id: req.user!.id,
    admin_name: req.user!.full_name,
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
// PRODUCTS
// ---------------------------------------------------------------------------
manageRouter.post('/products', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    name: str(body.name, 200),
    slug: str(body.slug, 200),
    category_id: str(body.category_id, 64),
    short_description: str(body.short_description, 500),
    description: str(body.description, 5000),
    base_price: num(body.base_price),
    sale_price: num(body.sale_price),
    cover_image_url: str(body.cover_image_url, 1000),
    status: ['draft', 'published', 'archived'].includes(String(body.status)) ? body.status : 'draft',
    is_featured: bool(body.is_featured),
  };
  if (!payload.name || !payload.category_id || payload.base_price === null) {
    res.status(400).json({ error: 'الاسم والتصنيف والسعر أساسية مطلوبة' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('products').insert(payload).select().single();
  if (error || !data) {
    res.status(500).json({ error: 'تعذر إنشاء المنتج' });
    return;
  }
  await audit(req, 'create', 'product', data.id, { name: payload.name });
  res.status(201).json({ product: data });
});

manageRouter.put('/products/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const id = req.params.id;
  const body = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (str(body.name, 200)) updates.name = str(body.name, 200);
  if (str(body.short_description, 500)) updates.short_description = str(body.short_description, 500);
  if (str(body.description, 5000)) updates.description = str(body.description, 5000);
  if (num(body.base_price) !== null) updates.base_price = num(body.base_price);
  if (num(body.sale_price) !== null) updates.sale_price = num(body.sale_price);
  if (str(body.cover_image_url, 1000)) updates.cover_image_url = str(body.cover_image_url, 1000);
  if (['draft', 'published', 'archived'].includes(String(body.status))) updates.status = body.status;
  if (typeof body.is_featured === 'boolean') updates.is_featured = body.is_featured;

  const { data, error } = await supabaseAdmin.from('products').update(updates).eq('id', id).select().single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على المنتج' });
    return;
  }
  await audit(req, 'update', 'product', id, updates);
  res.json({ product: data });
});

manageRouter.delete('/products/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const id = req.params.id;
  const { error } = await supabaseAdmin.from('products').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    res.status(500).json({ error: 'تعذر أرشفة المنتج' });
    return;
  }
  await audit(req, 'archive', 'product', id, {});
  res.json({ success: true, message: 'تم أرشفة المنتج' });
});

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------
manageRouter.post('/categories', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    name: str(body.name, 120),
    slug: str(body.slug, 120),
    description: str(body.description, 500),
    icon: str(body.icon, 120),
    sort_order: num(body.sort_order) ?? 0,
    is_active: bool(body.is_active, true),
  };
  if (!payload.name || !payload.slug) {
    res.status(400).json({ error: 'الاسم والمعرف النصي (slug) مطلوبان' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('categories').insert(payload).select().single();
  if (error || !data) {
    res.status(500).json({ error: 'تعذر إنشاء التصنيف' });
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
  if (str(body.icon, 120)) updates.icon = str(body.icon, 120);
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
// COUPONS
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
// BANK ACCOUNTS
// ---------------------------------------------------------------------------
manageRouter.post('/banks', requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    bank_name: str(body.bank_name, 120),
    account_name: str(body.account_name, 120),
    account_number: str(body.account_number, 64),
    iban: str(body.iban, 64),
    is_active: bool(body.is_active, true),
  };
  if (!payload.bank_name || !payload.account_name || !payload.account_number) {
    res.status(400).json({ error: 'اسم البنك واسم الحساب والرقم مطلوبة' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('bank_accounts').insert(payload).select().single();
  if (error || !data) {
    res.status(500).json({ error: 'تعذر إضافة الحساب البنكي' });
    return;
  }
  await audit(req, 'create', 'bank_account', data.id, { bank_name: payload.bank_name });
  res.status(201).json({ bank: data });
});

manageRouter.put('/banks/:id', requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (str(body.bank_name, 120)) updates.bank_name = str(body.bank_name, 120);
  if (str(body.account_name, 120)) updates.account_name = str(body.account_name, 120);
  if (str(body.account_number, 64)) updates.account_number = str(body.account_number, 64);
  if (str(body.iban, 64)) updates.iban = str(body.iban, 64);
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

  const { data, error } = await supabaseAdmin.from('bank_accounts').update(updates).eq('id', req.params.id).select().single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على الحساب البنكي' });
    return;
  }
  await audit(req, 'update', 'bank_account', req.params.id, updates);
  res.json({ bank: data });
});

// ---------------------------------------------------------------------------
// SERVICES
// ---------------------------------------------------------------------------
manageRouter.post('/services', requirePermission('manage_services'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    name: str(body.name, 200),
    description: str(body.description, 2000),
    price: num(body.price),
    duration_days: num(body.duration_days) ?? 7,
    is_active: bool(body.is_active, true),
  };
  if (!payload.name || payload.price === null) {
    res.status(400).json({ error: 'اسم الخدمة والسعر مطلوبان' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('services').insert(payload).select().single();
  if (error || !data) {
    res.status(500).json({ error: 'تعذر إنشاء الخدمة' });
    return;
  }
  await audit(req, 'create', 'service', data.id, { name: payload.name });
  res.status(201).json({ service: data });
});

manageRouter.put('/services/:id', requirePermission('manage_services'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (str(body.name, 200)) updates.name = str(body.name, 200);
  if (str(body.description, 2000)) updates.description = str(body.description, 2000);
  if (num(body.price) !== null) updates.price = num(body.price);
  if (num(body.duration_days) !== null) updates.duration_days = num(body.duration_days);
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

  const { data, error } = await supabaseAdmin.from('services').update(updates).eq('id', req.params.id).select().single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على الخدمة' });
    return;
  }
  await audit(req, 'update', 'service', req.params.id, updates);
  res.json({ service: data });
});

// ---------------------------------------------------------------------------
// SITE SETTINGS (single-row table)
// ---------------------------------------------------------------------------
manageRouter.put('/settings', requirePermission('manage_settings'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (str(body.site_name, 200)) updates.site_name = str(body.site_name, 200);
  if (str(body.support_email, 200)) updates.support_email = str(body.support_email, 200);
  if (str(body.support_phone, 40)) updates.support_phone = str(body.support_phone, 40);
  if (str(body.currency, 10)) updates.currency = str(body.currency, 10);

  const { data: existing } = await supabaseAdmin.from('site_settings').select('id').limit(1).maybeSingle();
  let result;
  if (existing) {
    result = await supabaseAdmin.from('site_settings').update(updates).eq('id', existing.id).select().single();
  } else {
    result = await supabaseAdmin.from('site_settings').insert(updates).select().single();
  }
  if (result.error || !result.data) {
    res.status(500).json({ error: 'تعذر حفظ الإعدادات' });
    return;
  }
  await audit(req, 'update', 'site_settings', result.data.id, updates);
  res.json({ settings: result.data });
});

// ---------------------------------------------------------------------------
// STAFF (customer profile management: role / status)
// ---------------------------------------------------------------------------
manageRouter.put('/staff/:userId', requirePermission('manage_users'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const assignable = ['owner', 'admin', 'product_manager', 'payment_manager', 'support_manager', 'customer'];
  if (typeof body.role === 'string' && assignable.includes(body.role)) {
    if (body.role === 'owner' && req.user!.role !== 'owner' && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'فقط المالك يمكنه منح دور المالك' });
      return;
    }
    updates.role = body.role;
  }
  if (typeof body.status === 'string' && ['active', 'suspended'].includes(body.status)) {
    updates.status = body.status;
  }
  if (str(body.full_name, 200)) updates.full_name = str(body.full_name, 200);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.params.userId)
    .select('id, full_name, email, role, status, created_at')
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على المستخدم' });
    return;
  }
  await audit(req, 'update', 'profile', req.params.userId, updates);
  res.json({ user: data });
});

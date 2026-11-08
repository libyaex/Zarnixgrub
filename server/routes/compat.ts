/**
 * Compatibility layer — LEGACY dashboard endpoints backed by Supabase.
 *
 * WHY: the AdminDashboard still calls pre-migration route names. This
 * router answers those URLs with the SAME data and the SAME permission
 * guards as the canonical routes.
 *
 * SECURITY: NO router-level requireAuth (mounted at '/api'; public store
 * routes must stay anonymous). Guarded routes below carry requireAuth +
 * requirePermission individually; public paths call next().
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth, requirePermission, permissionsFor } from '../lib/auth.ts';

export const compatRouter = Router();

const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

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

const can = (req: Request, permission: string): boolean =>
  permissionsFor(req.user?.role).some((p) => p === '*' || p === permission);

/** GET /api/products — public when plain; include_drafts=true requires
 *  manage_products and returns the FULL catalog (drafts included). */
compatRouter.get('/products', (req: Request, res: Response, next: NextFunction) => {
  const includeDrafts = ['true', '1', 'yes'].includes(String(req.query.include_drafts ?? '').toLowerCase());
  if (!includeDrafts) {
    next(); // public store read — handled by store.ts
    return;
  }
  Promise.resolve(
    requireAuth(req, res, async () => {
      if (!can(req, 'manage_products')) {
        res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء' });
        return;
      }
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('*, categories(name), product_options(*)')
        .order('created_at', { ascending: false });
      if (error) {
        res.status(500).json({ error: 'تعذر تحميل المنتجات' });
        return;
      }
      res.json(data ?? []);
    })
  ).catch(() => {
    if (!res.headersSent) res.status(500).json({ error: 'خطأ داخلي في الخادم' });
  });
});

/** DELETE /api/products/:id — archive a product (guarded). */
compatRouter.delete('/products/:id', requireAuth, requirePermission('manage_products'), async (req: Request, res: Response) => {
  const { error } = await supabaseAdmin
    .from('products')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: 'تعذر أرشفة المنتج' });
    return;
  }
  await audit(req, 'archive', 'product', req.params.id, {});
  res.json({ success: true, message: 'تم أرشفة المنتج' });
});

/** GET /api/orders — staff with manage_orders see ALL orders; customers
 *  see only their own (store.ts behavior). */
compatRouter.get('/orders', requireAuth, async (req: Request, res: Response) => {
  if (can(req, 'manage_orders')) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*), payment_submissions(*)')
      .order('created_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: 'تعذر تحميل الطلبات' });
      return;
    }
    res.json(data ?? []);
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الطلبات' });
    return;
  }
  res.json(data ?? []);
});

/** PUT /api/orders/:id/status — order_status transition (guarded). */
compatRouter.put('/orders/:id/status', requireAuth, requirePermission('manage_orders'), async (req: Request, res: Response) => {
  const allowed = ['pending', 'processing', 'completed', 'cancelled'];
  const newStatus = String(req.body?.status ?? '');
  if (!allowed.includes(newStatus)) {
    res.status(400).json({ error: 'حالة طلب غير صالحة' });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ order_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على الطلب' });
    return;
  }
  await audit(req, 'update', 'order_status', req.params.id, { newStatus });
  res.json({ order: data });
});

/** PUT /api/services/:id — update a service task (guarded). */
compatRouter.put('/services/:id', requireAuth, requirePermission('manage_services'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  const statuses = ['not_started', 'in_progress', 'waiting_customer_info', 'completed', 'cancelled'];
  if (typeof body.status === 'string' && statuses.includes(body.status)) updates.status = body.status;
  if (typeof body.admin_notes === 'string') updates.admin_notes = body.admin_notes.slice(0, 2000);
  if (typeof body.details === 'string') updates.details = body.details.slice(0, 2000);
  if (body.status === 'in_progress') updates.started_at = new Date().toISOString();
  if (body.status === 'completed') updates.completed_at = new Date().toISOString();
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'لا توجد تغييرات لتطبيقها' });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('service_tasks')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على الخدمة' });
    return;
  }
  await audit(req, 'update', 'service_task', req.params.id, updates);
  res.json({ service: data });
});

/** GET /api/downloads/all-entitlements — legacy admin entitlements list. */
compatRouter.get('/downloads/all-entitlements', requireAuth, requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('download_entitlements')
    .select('*, products(name, main_image)')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل حصص التحميل' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/downloads/logs — legacy admin download logs list. */
compatRouter.get('/downloads/logs', requireAuth, requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('download_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(200);
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل سجل التحميلات' });
    return;
  }
  res.json(data ?? []);
});

/** POST /api/downloads/reset-limit — extend an entitlement's download count. */
compatRouter.post('/downloads/reset-limit', requireAuth, requirePermission('manage_downloads'), async (req: Request, res: Response) => {
  const entitlementId = String(req.body?.entitlement_id ?? '');
  const newLimit = num(req.body?.new_limit) ?? 5;
  if (!entitlementId) {
    res.status(400).json({ error: 'معرف استحقاق التحميل مطلوب' });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('download_entitlements')
    .update({ allowed_downloads: Math.floor(newLimit), used_downloads: 0, is_active: true })
    .eq('id', entitlementId)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على استحقاق التحميل' });
    return;
  }
  await audit(req, 'update', 'download_entitlement', entitlementId, { new_limit: newLimit });
  res.json({ success: true, message: 'تمت إعادة تعيين محاولات التحميل' });
});

/** GET /api/coupons — legacy admin coupon list. */
compatRouter.get('/coupons', requireAuth, requirePermission('manage_coupons'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل كوبونات الخصم' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/settings — legacy alias of the admin settings map. */
compatRouter.get('/settings', requireAuth, requirePermission('manage_settings'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('setting_key, setting_value, updated_at')
    .order('setting_key');
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الإعدادات' });
    return;
  }
  const map: Record<string, unknown> = {};
  for (const row of data ?? []) {
    map[row.setting_key] = (row.setting_value as { value?: unknown })?.value ?? row.setting_value;
  }
  res.json(map);
});

/** PUT /api/settings — accepts entries array or a flat object. */
compatRouter.put('/settings', requireAuth, requirePermission('manage_settings'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const all: Array<{ key?: unknown; value?: unknown }> = [];
  if (Array.isArray(body.entries)) {
    all.push(...body.entries);
  } else if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      all.push({ key, value });
    }
  }
  if (all.length === 0) {
    res.status(400).json({ error: 'لا توجد إعدادات للحفظ' });
    return;
  }
  const saved: string[] = [];
  for (const entry of all.slice(0, 50)) {
    const key = typeof entry?.key === 'string' ? entry.key.trim().slice(0, 100) : '';
    if (!key) continue;
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert(
        { setting_key: key, setting_value: { value: entry.value ?? null }, updated_at: new Date().toISOString() },
        { onConflict: 'setting_key' }
      );
    if (error) {
      res.status(500).json({ error: `تعذر حفظ الإعداد: ${key}` });
      return;
    }
    saved.push(key);
  }
  await audit(req, 'update', 'site_settings', 'bulk', { keys: saved });
  res.json({ settings: { saved_keys: saved } });
});

/** GET /api/bank-accounts — legacy alias of payment accounts (all). */
compatRouter.get('/bank-accounts', requireAuth, requirePermission('manage_banks'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payment_accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الحسابات البنكية' });
    return;
  }
  res.json(data ?? []);
});

/** POST /api/bank-accounts — legacy create. */
compatRouter.post('/bank-accounts', requireAuth, requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const payload = {
    bank_name: str(body.bank_name),
    account_holder: str(body.account_holder ?? body.account_name),
    account_number: str(body.account_number, 64),
    iban: str(body.iban, 64),
    instructions: str(body.instructions, 1000),
    is_active: typeof body.is_active === 'boolean' ? body.is_active : true,
    is_default: typeof body.is_default === 'boolean' ? body.is_default : false,
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
  res.status(201).json(data);
});

/** PUT /api/bank-accounts/:id — legacy update. */
compatRouter.put('/bank-accounts/:id', requireAuth, requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (str(body.bank_name, 120)) updates.bank_name = str(body.bank_name, 120);
  if (str(body.account_holder ?? body.account_name, 120)) updates.account_holder = str(body.account_holder ?? body.account_name, 120);
  if (str(body.account_number, 64)) updates.account_number = str(body.account_number, 64);
  if (str(body.iban, 64)) updates.iban = str(body.iban, 64);
  if (str(body.instructions, 1000)) updates.instructions = str(body.instructions, 1000);
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (typeof body.is_default === 'boolean') updates.is_default = body.is_default;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'لا توجد تغييرات لتطبيقها' });
    return;
  }
  const { data, error } = await supabaseAdmin.from('payment_accounts').update(updates).eq('id', req.params.id).select().single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على الحساب البنكي' });
    return;
  }
  await audit(req, 'update', 'payment_account', req.params.id, updates);
  res.json({ bank: data });
});

/** DELETE /api/bank-accounts/:id — legacy deactivate. */
compatRouter.delete('/bank-accounts/:id', requireAuth, requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const { error } = await supabaseAdmin
    .from('payment_accounts')
    .update({ is_active: false })
    .eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: 'تعذر تعطيل الحساب البنكي' });
    return;
  }
  await audit(req, 'deactivate', 'payment_account', req.params.id, {});
  res.json({ success: true });
});

/** GET /api/admin/stats — legacy alias of /overview, including the
 *  under_review_payments_count field the dashboard badge expects. */
compatRouter.get('/admin/stats', requireAuth, requirePermission('view_financial_analytics'), async (_req: Request, res: Response) => {
  const [ordersRes, usersRes, productsRes, servicesRes] = await Promise.all([
    supabaseAdmin.from('orders').select('total_amount, payment_status, order_status'),
    supabaseAdmin.from('profiles').select('id'),
    supabaseAdmin.from('products').select('id, status'),
    supabaseAdmin.from('service_tasks').select('id, status'),
  ]);
  const list = ordersRes.data ?? [];
  const paid = list.filter((o) => o.payment_status === 'paid');
  const pending = list.filter(
    (o) => o.payment_status === 'under_review' || o.payment_status === 'submitted'
  );
  const products = productsRes.data ?? [];
  const services = servicesRes.data ?? [];
  const revenue = paid.reduce((sum, o) => sum + Number(o.total_amount), 0);
  res.json({
    totals: {
      orders: list.length,
      paid_orders: paid.length,
      revenue,
      pending_reviews: pending.length,
      customers: usersRes.data?.length ?? 0,
      products_total: products.length,
      products_published: products.filter((p) => p.status === 'published').length,
      services_active: services.filter(
        (s) => s.status === 'in_progress' || s.status === 'waiting_customer_info'
      ).length,
    },
    orders: list.length,
    paid_orders: paid.length,
    revenue,
    under_review_payments_count: pending.length,
    customers: usersRes.data?.length ?? 0,
    products_total: products.length,
    products_published: products.filter((p) => p.status === 'published').length,
    services_active: services.filter(
      (s) => s.status === 'in_progress' || s.status === 'waiting_customer_info'
    ).length,
  });
});

/** GET /api/admin/audit-logs — legacy alias of /audit. */
compatRouter.get('/admin/audit-logs', requireAuth, requirePermission('view_audit_logs'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select('id, admin_id, action, entity_type, entity_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل سجل التدقيق' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/admin/staff — profiles with non-customer roles. */
compatRouter.get('/admin/staff', requireAuth, requirePermission('manage_users'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, status, created_at')
    .neq('role', 'customer')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الطاقم' });
    return;
  }
  res.json(data ?? []);
});

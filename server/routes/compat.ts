/**
 * Compatibility layer — LEGACY dashboard endpoints backed by Supabase.
 *
 * WHY THIS EXISTS: the AdminDashboard (a single ~174KB component) still
 * calls the pre-migration route names:
 *   /api/admin/stats, /api/admin/audit-logs, /api/admin/staff,
 *   /api/products?include_drafts=true, /api/orders (admin view),
 *   /api/bank-accounts, /api/downloads/all-entitlements, /api/downloads/logs,
 *   /api/coupons, /api/settings, /api/services, /api/categories?all=true
 * Editing that file call-site by call-site is fragile; this router answers
 * those legacy URLs with the SAME data and the SAME permission guards as
 * the canonical routes in admin.ts / manage.ts.
 *
 * SECURITY: every route requires a valid Supabase JWT and the same
 * permission as its canonical twin. No local-storage products are served
 * here — data comes exclusively from the database.
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions — required
 * by Node ESM on Vercel (ERR_MODULE_NOT_FOUND otherwise).
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth, requirePermission } from '../lib/auth.ts';

export const compatRouter = Router();

compatRouter.use(requireAuth);

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

/** GET /api/admin/stats — legacy alias of /api/admin/overview. */
compatRouter.get('/stats', requirePermission('view_financial_analytics'), async (_req: Request, res: Response) => {
  const [ordersRes, usersRes, productsRes, servicesRes] = await Promise.all([
    supabaseAdmin.from('orders').select('total_amount, payment_status, order_status'),
    supabaseAdmin.from('profiles').select('id'),
    supabaseAdmin.from('products').select('id, status'),
    supabaseAdmin.from('service_tasks').select('id, status'),
  ]);
  const list = ordersRes.data ?? [];
  const paid = list.filter((o) => o.payment_status === 'paid');
  const products = productsRes.data ?? [];
  const services = servicesRes.data ?? [];
  res.json({
    totals: {
      orders: list.length,
      paid_orders: paid.length,
      revenue: paid.reduce((sum, o) => sum + Number(o.total_amount), 0),
      pending_reviews: list.filter(
        (o) => o.payment_status === 'under_review' || o.payment_status === 'submitted'
      ).length,
      customers: usersRes.data?.length ?? 0,
      products_total: products.length,
      products_published: products.filter((p) => p.status === 'published').length,
      services_active: services.filter(
        (s) => s.status === 'in_progress' || s.status === 'waiting_customer_info'
      ).length,
    },
  });
});

/** GET /api/admin/audit-logs — legacy alias of /api/admin/audit. */
compatRouter.get('/audit-logs', requirePermission('view_audit_logs'), async (_req: Request, res: Response) => {
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

/** GET /api/admin/staff — profiles with staff/admin roles. */
compatRouter.get('/staff', requirePermission('manage_users'), async (_req: Request, res: Response) => {
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

/** GET /api/orders — LEGACY ADMIN VIEW: the dashboard expects ALL orders
 *  here (not just the caller's own). Permission-guarded, unlike the
 *  customer-facing /api/orders in store.ts. */
compatRouter.get('/orders', requirePermission('manage_orders'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*), payment_submissions(*)')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الطلبات' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/downloads/all-entitlements — legacy admin entitlements list. */
compatRouter.get('/downloads/all-entitlements', requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
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
compatRouter.get('/downloads/logs', requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
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

/** GET /api/coupons — legacy admin coupon list (all coupons). */
compatRouter.get('/coupons', requirePermission('manage_coupons'), async (_req: Request, res: Response) {
  const { data, error } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    response500(res, 'تعذر تحميل كوبونات الخصم');
    return;
  }
  res.json(data ?? []);
});

function response500(res: Response, message: string): void {
  res.status(500).json({ error: message });
}

/** GET /api/settings — legacy alias of /api/admin/settings. */
compatRouter.get('/settings', requirePermission('manage_settings'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('setting_key, setting_value, updated_at')
    .order('setting_key');
  if (error) {
    response500(res, 'تعذر تحميل الإعدادات');
    return;
  }
  const map: Record<string, unknown> = {};
  for (const row of data ?? []) {
    map[row.setting_key] = (row.setting_value as { value?: unknown })?.value ?? row.setting_value;
  }
  res.json(map);
});

/** PUT /api/settings — legacy alias of the canonical settings write. */
compatRouter.put('/settings', requirePermission('manage_settings'), async (req: Request, res: Response) => {
  const entries: Array<{ key?: unknown; value?: unknown }> = Array.isArray(req.body?.entries)
    ? req.body.entries
    : [];
  const flat = req.body && typeof req.body === 'object' && !Array.isArray(req.body.entries)
    ? Object.entries(req.body as Record<string, unknown>).filter(([, v]) => typeof v !== 'object' || v === null)
    : [];
  const all: Array<{ key?: unknown; value?: unknown }> = [...entries, ...flat.map(([key, value]) => ({ key, value }))];
  if (all.length === 0) {
    res.status(400).json({ error: 'لا توجد إعدادات للحفظ' });
    return;
  }
  const saved: string[] = [];
  for (const entry of all.slice(0, 50)) {
    const key = typeof entry.key === 'string' ? entry.key.trim().slice(0, 100) : '';
    if (!key) continue;
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({ setting_key: key, setting_value: { value: entry.value ?? null }, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
    if (error) {
      response500(res, `تعذر حفظ الإعداد: ${key}`);
      return;
    }
    saved.push(key);
  }
  await audit(req, 'update', 'site_settings', 'bulk', { keys: saved });
  res.json({ settings: { saved_keys: saved } });
});

/** GET /api/bank-accounts — legacy alias of payment accounts (all). */
compatRouter.get('/bank-accounts', requirePermission('manage_banks'), async (_req: Request, res: Response) {
  const { data, error } = await supabaseAdmin
    .from('payment_accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    response500(res, 'تعذر تحميل الحسابات البنكية');
    return;
  }
  res.json(data ?? []);
});

/** POST /api/bank-accounts — legacy create. */
compatRouter.post('/bank-accounts', requirePermission('manage_banks'), async (req: Request, res: Response) => {
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
    response500(res, 'تعذر إضافة الحساب البنكي');
    return;
  }
  await audit(req, 'create', 'payment_account', data.id, { bank_name: payload.bank_name });
  res.status(201).json(data);
});

/** DELETE /api/bank-accounts/:id — legacy deactivate. */
compatRouter.delete('/bank-accounts/:id', requirePermission('manage_banks'), async (req: Request, res: Response) => {
  const { error } = await supabaseAdmin
    .from('payment_accounts')
    .update({ is_active: false })
    .eq('id', req.params.id);
  if (error) {
    response500(res, 'تعذر تعطيل الحساب البنكي');
    return;
  }
  await audit(req, 'deactivate', 'payment_account', req.params.id, {});
  res.json({ success: true });
});

const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

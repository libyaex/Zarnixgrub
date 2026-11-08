/**
 * Phase 6 — Admin API backed by Supabase with per-endpoint permissions.
 * ALIGNED WITH THE PRODUCTION SCHEMA:
 * - audit_logs.admin_id references auth.users (no profiles embed; the
 *   frontend resolves the admin name from the customers list).
 * - download_entitlements.user_id references auth.users (same).
 * Every route requires authentication plus a specific permission; the
 * role always comes from the verified JWT + profiles table.
 *
 * THIS FILE COMPLETES the admin surface the dashboard actually calls:
 * GET  /overview, /statistics, /orders, /customers, /downloads, /audit,
 *      /roles, /settings, /services, /permissions/me
 * GET  /products            — admin product list (all statuses, incl. drafts)
 * GET  /products/:id/files  — product files for the edit dialog
 * GET  /coupons             — coupon management list
 * GET  /banks               — payment accounts management list
 * PUT  /orders/:id/status   — order_status transitions
 * PUT  /downloads/:id       — extend/reset download counters
 * POST /roles, PUT/DELETE /roles/:id — custom RBAC roles
 * DELETE /categories/:id    — deactivate a category (soft delete)
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions — required
 * by Node ESM on Vercel (ERR_MODULE_NOT_FOUND otherwise).
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth, requirePermission, permissionsFor } from '../lib/auth.ts';

export const adminRouter = Router();

adminRouter.use(requireAuth);

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

/** GET /api/admin/overview — financial analytics dashboard. */
adminRouter.get(
  '/overview',
  requirePermission('view_financial_analytics'),
  async (_req: Request, res: Response) => {
    const [ordersRes, usersRes, productsRes, servicesRes] = await Promise.all([
      supabaseAdmin.from('orders').select('total_amount, payment_status, order_status, created_at'),
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
    const activeServices = services.filter(
      (s) => s.status === 'in_progress' || s.status === 'waiting_customer_info'
    );
    res.json({
      totals: {
        orders: list.length,
        paid_orders: paid.length,
        revenue: paid.reduce((sum, o) => sum + Number(o.total_amount), 0),
        pending_reviews: pending.length,
        customers: usersRes.data?.length ?? 0,
        products_total: products.length,
        products_published: products.filter((p) => p.status === 'published').length,
        services_active: activeServices.length,
      },
    });
  }
);

/** GET /api/admin/statistics — same KPIs as /overview (dashboard calls both). */
adminRouter.get(
  '/statistics',
  requirePermission('view_financial_analytics'),
  async (_req: Request, res: Response) => {
    const [ordersRes, usersRes, productsRes] = await Promise.all([
      supabaseAdmin.from('orders').select('total_amount, payment_status, order_status'),
      supabaseAdmin.from('profiles').select('id'),
      supabaseAdmin.from('products').select('id, status'),
    ]);
    const list = ordersRes.data ?? [];
    const paid = list.filter((o) => o.payment_status === 'paid');
    const products = productsRes.data ?? [];
    res.json({
      totals: {
        orders: list.length,
        paid_orders: paid.length,
        revenue: paid.reduce((sum, o) => sum + Number(o.total_amount), 0),
        customers: usersRes.data?.length ?? 0,
        products_total: products.length,
        products_published: products.filter((p) => p.status === 'published').length,
      },
    });
  }
);

/** GET /api/admin/products — ALL products (drafts incl.) for the dashboard catalog. */
adminRouter.get('/products', requirePermission('manage_products'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, categories(name), product_options(*)')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل المنتجات' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/admin/products/:id/files — product files for the edit dialog. */
adminRouter.get('/products/:id/files', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('product_files')
    .select('id, product_id, file_name, file_size, version, mime_type, is_downloadable, is_active, created_at')
    .eq('product_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل ملفات المنتج' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/admin/orders */
adminRouter.get('/orders', requirePermission('manage_orders'), async (_req: Request, res: Response) => {
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

/** PUT /api/admin/orders/:id/status — order_status transition + audit. */
adminRouter.put(
  '/orders/:id/status',
  requirePermission('manage_orders'),
  async (req: Request, res: Response) => {
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
  }
);

/** GET /api/admin/customers — includes admin/staff so the frontend can
 *  resolve names for audit logs and submissions. */
adminRouter.get('/customers', requirePermission('manage_users'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, status, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل العملاء' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/admin/downloads — user_id resolved by the frontend via /customers. */
adminRouter.get('/downloads', requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
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

/** PUT /api/admin/downloads/:id — extend/reset download counters (manage_downloads). */
adminRouter.put('/downloads/:id', requirePermission('manage_downloads'), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (Number.isFinite(Number(body.allowed_downloads)) && Number(body.allowed_downloads) >= 0) {
    updates.allowed_downloads = Math.floor(Number(body.allowed_downloads));
  }
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (Number.isFinite(Number(body.used_downloads)) && Number(body.used_downloads) >= 0) {
    updates.used_downloads = Math.floor(Number(body.used_downloads));
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'لا توجد تغييرات لتطبيقها' });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('download_entitlements')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'لم يتم العثور على استحقاق التحميل' });
    return;
  }
  await audit(req, 'update', 'download_entitlement', req.params.id, updates);
  res.json({ entitlement: data });
});

/** GET /api/admin/audit — admin_id returned raw (no auth.users embed). */
adminRouter.get('/audit', requirePermission('view_audit_logs'), async (_req: Request, res: Response) => {
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

/** GET /api/admin/roles — system + custom roles from the DB. */
adminRouter.get('/roles', requirePermission('manage_roles_permissions'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('*, role_permissions(permission_key)')
    .order('created_at');
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الأدوار' });
    return;
  }
  res.json(data ?? []);
});

/** POST /api/admin/roles — create a custom role with its permissions. */
adminRouter.post('/roles', requirePermission('manage_roles_permissions'), async (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
  const nameAr = typeof req.body?.name_ar === 'string' ? req.body.name_ar.trim().slice(0, 120) : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.slice(0, 500) : null;
  const color = typeof req.body?.color === 'string' ? req.body.color.slice(0, 20) : '#3b82f6';
  const permissions = Array.isArray(req.body?.permissions)
    ? req.body.permissions.map(String).slice(0, 50)
    : [];
  if (!name || !nameAr) {
    res.status(400).json({ error: 'اسم الدور بالعربية والإنجليزية مطلوب' });
    return;
  }
  const { data: role, error } = await supabaseAdmin
    .from('roles')
    .insert({ name, name_ar: nameAr, description, color, is_system: false })
    .select()
    .single();
  if (error || !role) {
    res.status(500).json({ error: 'تعذر إنشاء الدور — تأكد أن الاسم غير مستخدم' });
    return;
  }
  if (permissions.length > 0) {
    await supabaseAdmin
      .from('role_permissions')
      .insert(permissions.map((p) => ({ role_id: role.id, permission_key: p })));
  }
  await audit(req, 'create', 'role', role.id, { name });
  res.status(201).json({ role });
});

/** PUT /api/admin/roles/:id — replace a custom role's permission set. */
adminRouter.put('/roles/:id', requirePermission('manage_roles_permissions'), async (req: Request, res: Response) => {
  const permissions = Array.isArray(req.body?.permissions)
    ? req.body.permissions.map(String).slice(0, 50)
    : null;
  const { data: existing } = await supabaseAdmin
    .from('roles')
    .select('id, is_system')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!existing) {
    res.status(404).json({ error: 'لم يتم العثور على الدور' });
    return;
  }
  if (permissions) {
    await supabaseAdmin.from('role_permissions').delete().eq('role_id', req.params.id);
    if (permissions.length > 0) {
      await supabaseAdmin
        .from('role_permissions')
        .insert(permissions.map((p) => ({ role_id: req.params.id, permission_key: p })));
    }
  }
  await audit(req, 'update', 'role', req.params.id, { permissions: permissions ?? [] });
  res.json({ success: true });
});

/** DELETE /api/admin/roles/:id — delete a CUSTOM (non-system) role. */
adminRouter.delete('/roles/:id', requirePermission('manage_roles_permissions'), async (req: Request, res: Response) => {
  const { data: existing } = await supabaseAdmin
    .from('roles')
    .select('id, is_system, name')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!existing) {
    res.status(404).json({ error: 'لم يتم العثور على الدور' });
    return;
  }
  if (existing.is_system) {
    res.status(403).json({ error: 'لا يمكن حذف دور نظام' });
    return;
  }
  await supabaseAdmin.from('role_permissions').delete().eq('role_id', req.params.id);
  const { error } = await supabaseAdmin.from('roles').delete().eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: 'تعذر حذف الدور' });
    return;
  }
  await audit(req, 'delete', 'role', req.params.id, { name: existing.name });
  res.json({ success: true });
});

/** GET /api/admin/settings — key/value rows returned as a flat map. */
adminRouter.get('/settings', requirePermission('manage_settings'), async (_req: Request, res: Response) => {
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

/** GET /api/admin/services — service tasks across all customers. */
adminRouter.get('/services', requirePermission('manage_services'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('service_tasks')
    .select('*, orders(order_number), products(name)')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الخدمات' });
    return;
  }
  res.json(data ?? []);
});

/** PUT /api/admin/services/:id — update service task status/notes. */
adminRouter.put('/services/:id', requirePermission('manage_services'), async (req: Request, res: Response) => {
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

/** GET /api/admin/coupons — coupon management list. */
adminRouter.get('/coupons', requirePermission('manage_coupons'), async (_req: Request, res: Response) => {
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

/** GET /api/admin/banks — payment accounts management list. */
adminRouter.get('/banks', requirePermission('manage_banks'), async (_req: Request, res: Response) => {
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

/** DELETE /api/admin/categories/:id — deactivate a category (soft delete). */
adminRouter.delete('/categories/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('category_id', req.params.id)
    .eq('status', 'published')
    .limit(1);
  if (products && products.length > 0) {
    res.status(409).json({ error: 'لا يمكن حذف تصنيف يحتوي منتجات منشورة — أرشف المنتجات أولاً' });
    return;
  }
  const { error } = await supabaseAdmin
    .from('categories')
    .update({ is_active: false })
    .eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: 'تعذر حذف التصنيف' });
    return;
  }
  await audit(req, 'deactivate', 'category', req.params.id, {});
  res.json({ success: true, message: 'تم حذف التصنيف' });
});

/** GET /api/admin/permissions/me — the caller's effective permissions. */
adminRouter.get('/permissions/me', async (req: Request, res: Response) => {
  res.json({ role: req.user!.role, permissions: permissionsFor(req.user!.role) });
});

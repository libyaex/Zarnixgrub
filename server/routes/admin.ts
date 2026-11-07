/**
 * Phase 6 — Admin API backed by Supabase with per-endpoint permissions.
 * ALIGNED WITH THE PRODUCTION SCHEMA:
 * - audit_logs.admin_id references auth.users (no profiles embed; the
 *   frontend resolves the admin name from the customers list).
 * - download_entitlements.user_id references auth.users (same).
 * Every route requires authentication plus a specific permission; the
 * role always comes from the verified JWT + profiles table.
 *
 * ESM FIX: internal imports carry explicit `.ts` extensions.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth, requirePermission, permissionsFor } from '../lib/auth.ts';

export const adminRouter = Router();

adminRouter.use(requireAuth);

/** GET /api/admin/overview — financial analytics dashboard. */
adminRouter.get(
  '/overview',
  requirePermission('view_financial_analytics'),
  async (_req: Request, res: Response) => {
    const [{ data: orders }, { data: users }] = await Promise.all([
      supabaseAdmin.from('orders').select('total_amount, payment_status, order_status, created_at'),
      supabaseAdmin.from('profiles').select('id'),
    ]);
    const list = orders ?? [];
    const paid = list.filter((o) => o.payment_status === 'paid');
    const pending = list.filter((o) => o.payment_status === 'under_review' || o.payment_status === 'submitted');
    res.json({
      totals: {
        orders: list.length,
        paid_orders: paid.length,
        revenue: paid.reduce((s, o) => s + Number(o.total_amount), 0),
        pending_reviews: pending.length,
        customers: users?.length ?? 0,
      },
    });
  }
);

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
  await supabaseAdmin.from('audit_logs').insert({
    admin_id: req.user!.id,
    action: 'update',
    entity_type: 'service_task',
    entity_id: req.params.id,
    details: updates,
  });
  res.json({ service: data });
});

/** GET /api/admin/permissions/me — the caller's effective permissions. */
adminRouter.get('/permissions/me', async (req: Request, res: Response) => {
  res.json({ role: req.user!.role, permissions: permissionsFor(req.user!.role) });
});

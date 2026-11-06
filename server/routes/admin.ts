/**
 * Phase 6 — Admin API backed by Supabase with per-endpoint permissions.
 * Every route requires authentication plus a specific permission; the
 * role always comes from the verified JWT + profiles table.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, requirePermission, permissionsFor } from '../lib/auth';

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
    const pending = list.filter((o) => o.payment_status === 'under_review');
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

/** GET /api/admin/customers */
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

/** GET /api/admin/downloads */
adminRouter.get('/downloads', requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('download_entitlements')
    .select('*, profiles(full_name, email), products(name)')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل حصص التحميل' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/admin/audit */
adminRouter.get('/audit', requirePermission('view_audit_logs'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select('*, profiles!admin_id(full_name, email)')
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

/** GET /api/admin/settings */
adminRouter.get('/settings', requirePermission('manage_settings'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الإعدادات' });
    return;
  }
  res.json(data ?? {});
});

/** GET /api/admin/permissions/me — the caller's effective permissions. */
adminRouter.get('/permissions/me', async (req: Request, res: Response) => {
  res.json({ role: req.user!.role, permissions: permissionsFor(req.user!.role) });
});

/** Internal helper for other routes to record audit actions. */
export async function recordAudit(
  adminId: string,
  adminName: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>
) {
  await supabaseAdmin.from('audit_logs').insert({
    admin_id: adminId,
    admin_name: adminName,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}

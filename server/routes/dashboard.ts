/**
 * Dashboard API (mounted at /api/admin, authentication applied in server.ts).
 *
 * Everything the admin dashboard needs that the read/write routers did not
 * cover: full product CRUD with options, product files, orders, downloads,
 * staff, custom roles, services and statistics. Every mutation checks a
 * specific permission and writes an audit row.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requirePermission, requireStaff } from '../lib/auth.ts';
import {
  hasPermission, canChangeRole, isBuiltinRole, isSuperRole,
  ALL_PERMISSIONS, BUILTIN_ROLES,
} from '../lib/permissions.ts';
import { parseProductPayload, shapeProduct, shapeOrder, shapeRole, fetchAll } from '../lib/shape.ts';
import { isUuid, isEmail } from '../lib/validators.ts';
import { audit } from '../lib/audit.ts';
import { storageObjectExists, PROJECT_BUCKET } from './upload.ts';

export const dashboardRouter = Router();

const LIST_LIMIT = 500;
const fail = (res: Response, code: number, error: string, extra: Record<string, unknown> = {}) =>
  res.status(code).json({ error, ...extra });
const dbFail = (res: Response, what: string, error?: { message?: string; code?: string } | null) => {
  console.error(`[dashboard] ${what}:`, error?.message);
  return fail(res, 500, `تعذر ${what}`);
};

/** id -> {full_name,email,phone} for a set of user ids. */
async function profileMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, { full_name: string; email: string; phone: string | null }>();
  if (!unique.length) return map;
  const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email, phone').in('id', unique);
  for (const p of data ?? []) map.set(p.id, p as any);
  return map;
}

// ---------------------------------------------------------------------------
// STATS
// ---------------------------------------------------------------------------
dashboardRouter.get('/stats', requireStaff, async (req: Request, res: Response) => {
  const canMoney = hasPermission(req.user!.permissions, 'view_financial_analytics');
  try {
    const [orders, products, services] = await Promise.all([
      fetchAll<any>((f, t) => supabaseAdmin.from('orders').select('total_amount, payment_status, order_status, created_at').range(f, t)),
      fetchAll<any>((f, t) => supabaseAdmin.from('products').select('status').range(f, t)),
      fetchAll<any>((f, t) => supabaseAdmin.from('service_tasks').select('status').range(f, t)),
    ]);
    const paid = orders.filter((o) => o.payment_status === 'paid');
    const monthly = new Map<string, number>();
    for (const o of paid) {
      const key = String(o.created_at).slice(0, 7);
      monthly.set(key, (monthly.get(key) ?? 0) + Number(o.total_amount));
    }
    res.json({
      confirmed_revenue_lyd: canMoney ? paid.reduce((s, o) => s + Number(o.total_amount), 0) : null,
      monthly_revenue: canMoney
        ? [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, total]) => ({ month, total }))
        : [],
      total_orders_count: orders.length,
      paid_orders_count: paid.length,
      pending_orders_count: orders.filter((o) => o.order_status === 'pending').length,
      under_review_payments_count: orders.filter((o) => ['submitted', 'under_review'].includes(o.payment_status)).length,
      published_products_count: products.filter((p) => p.status === 'published').length,
      total_products_count: products.length,
      active_services_count: services.filter((s) => ['not_started', 'in_progress', 'waiting_customer_info'].includes(s.status)).length,
    });
  } catch (e) {
    dbFail(res, 'تحميل الإحصائيات', e as Error);
  }
});

// ---------------------------------------------------------------------------
// PRODUCTS (+ options + files)
// ---------------------------------------------------------------------------
const PRODUCT_SELECT = '*, product_options(*), product_files(*), categories(name)';

dashboardRouter.get('/products', requirePermission('manage_products'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false }).range(0, LIST_LIMIT - 1);
  if (error) return dbFail(res, 'تحميل المنتجات', error);
  res.json((data ?? []).map((p) => shapeProduct(p, { includeFiles: true })));
});

async function syncOptions(productId: string, options: any[]) {
  const { data: existing } = await supabaseAdmin.from('product_options').select('id').eq('product_id', productId);
  const keep = new Set(options.filter((o) => o.id).map((o) => o.id as string));
  const removeIds = (existing ?? []).map((o) => o.id).filter((id) => !keep.has(id));
  if (removeIds.length) await supabaseAdmin.from('product_options').delete().in('id', removeIds);
  for (const o of options) {
    const row = { ...o, product_id: productId };
    if (o.id) {
      delete row.id;
      await supabaseAdmin.from('product_options').update(row).eq('id', o.id).eq('product_id', productId);
    } else {
      delete row.id;
      await supabaseAdmin.from('product_options').insert(row);
    }
  }
}

async function loadProduct(id: string) {
  const { data } = await supabaseAdmin.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle();
  return data ? shapeProduct(data, { includeFiles: true }) : null;
}

dashboardRouter.post('/products', requirePermission('manage_products'), async (req: Request, res: Response) => {
  const parsed = parseProductPayload(req.body, false);
  if (!parsed.ok) return fail(res, 400, parsed.error);
  const { data, error } = await supabaseAdmin.from('products').insert(parsed.value).select('id').single();
  if (error || !data) {
    if (error?.code === '23505') return fail(res, 409, 'المعرف (slug) مستخدم لمنتج آخر');
    return dbFail(res, 'إنشاء المنتج', error);
  }
  if (parsed.options?.length) await syncOptions(data.id, parsed.options);
  await audit(req, 'create', 'product', data.id, { name: parsed.value.name });
  res.status(201).json({ product: await loadProduct(data.id) });
});

dashboardRouter.put('/products/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف المنتج غير صالح');
  const parsed = parseProductPayload(req.body, true);
  if (!parsed.ok) return fail(res, 400, parsed.error);
  const update = { ...parsed.value, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin.from('products').update(update).eq('id', req.params.id).select('id').maybeSingle();
  if (error) {
    if (error.code === '23505') return fail(res, 409, 'المعرف (slug) مستخدم لمنتج آخر');
    return dbFail(res, 'تحديث المنتج', error);
  }
  if (!data) return fail(res, 404, 'المنتج غير موجود');
  if (parsed.options) await syncOptions(req.params.id, parsed.options);
  await audit(req, 'update', 'product', req.params.id, { fields: Object.keys(parsed.value) });
  res.json({ product: await loadProduct(req.params.id) });
});

/** Hard delete when never ordered; otherwise archive (order history must stay intact). */
dashboardRouter.delete('/products/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف المنتج غير صالح');
  const { data: files } = await supabaseAdmin.from('product_files').select('storage_path').eq('product_id', req.params.id);
  const { error } = await supabaseAdmin.from('products').delete().eq('id', req.params.id);
  if (error) {
    if (error.code === '23503') {
      await supabaseAdmin.from('products').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', req.params.id);
      await audit(req, 'archive', 'product', req.params.id, { reason: 'has_orders' });
      return res.json({ success: true, archived: true, message: 'للمنتج طلبات سابقة، لذلك تمت أرشفته بدل حذفه' });
    }
    return dbFail(res, 'حذف المنتج', error);
  }
  const paths = (files ?? []).map((f) => f.storage_path);
  if (paths.length) await supabaseAdmin.storage.from(PROJECT_BUCKET).remove(paths);
  await audit(req, 'delete', 'product', req.params.id, {});
  res.json({ success: true, archived: false });
});

/** Register a file that the browser already uploaded through a signed URL. */
dashboardRouter.post('/products/:id/files', requirePermission('manage_products'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف المنتج غير صالح');
  const b = req.body ?? {};
  const path = typeof b.storage_path === 'string' ? b.storage_path : '';
  const fileName = typeof b.file_name === 'string' ? b.file_name.trim().slice(0, 200) : '';
  if (!path || path.includes('..') || !fileName) return fail(res, 400, 'بيانات الملف غير مكتملة');
  if (!(await storageObjectExists(PROJECT_BUCKET, path))) return fail(res, 400, 'لم يتم العثور على الملف المرفوع في التخزين');

  const { data, error } = await supabaseAdmin.from('product_files').insert({
    product_id: req.params.id,
    file_name: fileName,
    storage_path: path,
    file_size: Math.max(0, Math.floor(Number(b.file_size) || 0)),
    mime_type: typeof b.mime_type === 'string' && b.mime_type ? b.mime_type.slice(0, 120) : 'application/zip',
    version: typeof b.version === 'string' && b.version.trim() ? b.version.trim().slice(0, 40) : '1.0.0',
  }).select().single();
  if (error || !data) {
    if (error?.code === '23505') return fail(res, 409, 'هذا الملف مسجّل مسبقاً');
    if (error?.code === '23503') return fail(res, 404, 'المنتج غير موجود');
    return dbFail(res, 'تسجيل ملف المنتج', error);
  }
  await audit(req, 'create', 'product_file', data.id, { product_id: req.params.id, file_name: fileName });
  res.status(201).json({ file: data });
});

dashboardRouter.delete('/product-files/:fileId', requirePermission('manage_products'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.fileId)) return fail(res, 400, 'معرف الملف غير صالح');
  const { data: file } = await supabaseAdmin.from('product_files').select('id, storage_path').eq('id', req.params.fileId).maybeSingle();
  if (!file) return fail(res, 404, 'الملف غير موجود');
  const { count } = await supabaseAdmin.from('download_entitlements').select('id', { count: 'exact', head: true }).eq('product_file_id', file.id);
  if ((count ?? 0) > 0) {
    // Customers already own this file: never cascade-delete their entitlements.
    await supabaseAdmin.from('product_files').update({ is_active: false, is_downloadable: false }).eq('id', file.id);
    await audit(req, 'deactivate', 'product_file', file.id, { entitlements: count });
    return res.json({ success: true, archived: true, message: 'الملف مرتبط بطلبات عملاء، تم تعطيله بدل حذفه' });
  }
  await supabaseAdmin.from('product_files').delete().eq('id', file.id);
  await supabaseAdmin.storage.from(PROJECT_BUCKET).remove([file.storage_path]);
  await audit(req, 'delete', 'product_file', file.id, {});
  res.json({ success: true, archived: false });
});

// ---------------------------------------------------------------------------
// CATEGORIES / BANKS / COUPONS (lists incl. inactive + deletes)
// ---------------------------------------------------------------------------
dashboardRouter.get('/categories', requirePermission('manage_products'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin.from('categories').select('*').order('sort_order');
  if (error) return dbFail(res, 'تحميل التصنيفات', error);
  res.json(data ?? []);
});
dashboardRouter.delete('/categories/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف التصنيف غير صالح');
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', req.params.id);
  if (error) return dbFail(res, 'حذف التصنيف', error);
  await audit(req, 'delete', 'category', req.params.id, {});
  res.json({ success: true });
});

dashboardRouter.get('/banks', requirePermission('manage_banks'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin.from('payment_accounts').select('*').order('is_default', { ascending: false });
  if (error) return dbFail(res, 'تحميل الحسابات البنكية', error);
  res.json(data ?? []);
});
dashboardRouter.delete('/banks/:id', requirePermission('manage_banks'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف الحساب غير صالح');
  const { error } = await supabaseAdmin.from('payment_accounts').delete().eq('id', req.params.id);
  if (error) return dbFail(res, 'حذف الحساب البنكي', error);
  await audit(req, 'delete', 'payment_account', req.params.id, {});
  res.json({ success: true });
});

dashboardRouter.get('/coupons', requirePermission('manage_coupons'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin.from('coupons').select('*').order('starts_at', { ascending: false });
  if (error) return dbFail(res, 'تحميل الكوبونات', error);
  res.json(data ?? []);
});

// ---------------------------------------------------------------------------
// ORDERS
// ---------------------------------------------------------------------------
dashboardRouter.get('/orders', requirePermission('manage_orders'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('orders').select('*, order_items(*), payment_submissions(*)')
    .order('created_at', { ascending: false }).range(0, LIST_LIMIT - 1);
  if (error) return dbFail(res, 'تحميل الطلبات', error);
  const profiles = await profileMap((data ?? []).map((o) => o.user_id));
  const signed = await signReceipts((data ?? []).flatMap((o) => o.payment_submissions ?? []));
  res.json((data ?? []).map((o) => shapeOrder(
    { ...o, payment_submissions: (o.payment_submissions ?? []).map((s: any) => ({ ...s, receipt_storage_path: signed.get(s.id) ?? s.receipt_storage_path })) },
    profiles.get(o.user_id)
  )));
});

/** Short-lived signed URLs so admins can view private receipts in <img>. */
export async function signReceipts(subs: Array<{ id: string; receipt_storage_path: string }>) {
  const out = new Map<string, string>();
  await Promise.all(subs.map(async (s) => {
    if (!s.receipt_storage_path) return;
    const { data } = await supabaseAdmin.storage.from('payment_receipts').createSignedUrl(s.receipt_storage_path, 3600);
    if (data?.signedUrl) out.set(s.id, data.signedUrl);
  }));
  return out;
}

const ORDER_STATUSES = ['pending', 'processing', 'completed', 'cancelled'];
const MANUAL_PAYMENT_STATUSES = ['unsubmitted', 'rejected', 'refunded'];

dashboardRouter.put('/orders/:id/status', requirePermission('manage_orders'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف الطلب غير صالح');
  const { order_status, payment_status, notes } = req.body ?? {};
  const { data: order } = await supabaseAdmin.from('orders').select('id, order_status, payment_status').eq('id', req.params.id).maybeSingle();
  if (!order) return fail(res, 404, 'الطلب غير موجود');

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (order_status !== undefined) {
    if (!ORDER_STATUSES.includes(order_status)) return fail(res, 400, 'حالة الطلب غير صالحة');
    update.order_status = order_status;
  }
  if (payment_status !== undefined && payment_status !== order.payment_status) {
    if (payment_status === 'paid') {
      return fail(res, 409, 'لا يمكن اعتماد الدفع من هنا. استخدم تبويب مراجعة المدفوعات حتى يُتحقق من الإيصال وتُفعَّل التنزيلات.', { code: 'use_payment_review' });
    }
    if (!MANUAL_PAYMENT_STATUSES.includes(payment_status)) return fail(res, 400, 'حالة الدفع غير صالحة');
    update.payment_status = payment_status;
  }

  const { error } = await supabaseAdmin.from('orders').update(update).eq('id', order.id);
  if (error) return dbFail(res, 'تحديث الطلب', error);

  // A refund or cancellation of a paid order must revoke delivered downloads.
  if (update.payment_status === 'refunded' || (update.order_status === 'cancelled' && order.payment_status === 'paid')) {
    await supabaseAdmin.from('download_entitlements').update({ is_active: false }).eq('order_id', order.id);
  }
  await audit(req, 'update_status', 'order', order.id, { from: { order_status: order.order_status, payment_status: order.payment_status }, to: update, notes: typeof notes === 'string' ? notes.slice(0, 500) : undefined });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// DOWNLOADS (entitlements + logs)
// ---------------------------------------------------------------------------
dashboardRouter.get('/entitlements', requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('download_entitlements')
    .select('*, products(name), product_files(file_name, file_size, version), orders(order_number)')
    .order('created_at', { ascending: false }).range(0, LIST_LIMIT - 1);
  if (error) return dbFail(res, 'تحميل تراخيص التنزيل', error);
  res.json((data ?? []).map(({ products, product_files, orders, ...e }: any) => ({
    ...e,
    product_name: products?.name ?? '',
    file_name: product_files?.file_name ?? '',
    file_size: Number(product_files?.file_size ?? 0),
    version: product_files?.version ?? '',
    order_number: orders?.order_number ?? '',
  })));
});

dashboardRouter.get('/download-logs', requirePermission('manage_downloads'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('download_logs')
    .select('*, product_files(file_name), orders(order_number)')
    .order('timestamp', { ascending: false }).range(0, LIST_LIMIT - 1);
  if (error) return dbFail(res, 'تحميل سجل التنزيلات', error);
  const profiles = await profileMap((data ?? []).map((l) => l.user_id));
  res.json((data ?? []).map(({ product_files, orders, ...l }: any) => ({
    ...l,
    file_name: product_files?.file_name,
    order_number: orders?.order_number,
    user_name: profiles.get(l.user_id)?.full_name,
  })));
});

dashboardRouter.post('/entitlements/:id/extend', requirePermission('manage_downloads'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف الترخيص غير صالح');
  const extra = Math.max(1, Math.min(100, Math.floor(Number(req.body?.extra) || 5)));
  const { data: ent } = await supabaseAdmin.from('download_entitlements').select('id, allowed_downloads, used_downloads').eq('id', req.params.id).maybeSingle();
  if (!ent) return fail(res, 404, 'الترخيص غير موجود');
  const allowed = Math.max(ent.allowed_downloads, ent.used_downloads) + extra;
  const { error } = await supabaseAdmin.from('download_entitlements').update({ allowed_downloads: allowed, is_active: true }).eq('id', ent.id);
  if (error) return dbFail(res, 'تمديد محاولات التنزيل', error);
  await audit(req, 'extend', 'download_entitlement', ent.id, { extra, allowed });
  res.json({ success: true, allowed_downloads: allowed });
});

dashboardRouter.put('/entitlements/:id/toggle', requirePermission('manage_downloads'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف الترخيص غير صالح');
  const { data: ent } = await supabaseAdmin.from('download_entitlements').select('id, is_active').eq('id', req.params.id).maybeSingle();
  if (!ent) return fail(res, 404, 'الترخيص غير موجود');
  const { error } = await supabaseAdmin.from('download_entitlements').update({ is_active: !ent.is_active }).eq('id', ent.id);
  if (error) return dbFail(res, 'تغيير حالة الترخيص', error);
  await audit(req, ent.is_active ? 'disable' : 'enable', 'download_entitlement', ent.id, {});
  res.json({ success: true, is_active: !ent.is_active });
});

// ---------------------------------------------------------------------------
// SERVICE TASKS
// ---------------------------------------------------------------------------
dashboardRouter.get('/services', requirePermission('manage_services'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('service_tasks').select('*, orders(order_number), products(name)')
    .order('created_at', { ascending: false }).range(0, LIST_LIMIT - 1);
  if (error) return dbFail(res, 'تحميل مهام الخدمات', error);
  const profiles = await profileMap((data ?? []).map((t) => t.user_id));
  res.json((data ?? []).map(({ orders, products, ...t }: any) => ({
    ...t,
    order_number: orders?.order_number ?? '',
    product_name: t.product_name ?? products?.name ?? '',
    customer_name: t.customer_name ?? profiles.get(t.user_id)?.full_name,
  })));
});

dashboardRouter.post('/services', requirePermission('manage_services'), async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const serviceName = typeof b.service_name === 'string' ? b.service_name.trim().slice(0, 200) : '';
  const customerName = typeof b.customer_name === 'string' ? b.customer_name.trim().slice(0, 200) : '';
  if (!serviceName || !customerName) return fail(res, 400, 'اسم الخدمة واسم العميل مطلوبان');
  const { data, error } = await supabaseAdmin.from('service_tasks').insert({
    service_name: serviceName,
    customer_name: customerName,
    customer_phone: typeof b.customer_phone === 'string' ? b.customer_phone.trim().slice(0, 40) : null,
    product_name: typeof b.product_name === 'string' ? b.product_name.trim().slice(0, 200) : null,
    details: typeof b.details === 'string' ? b.details.trim().slice(0, 2000) : null,
    status: 'not_started',
  }).select().single();
  if (error || !data) return dbFail(res, 'إنشاء مهمة الخدمة (نفّذ phase3-complete.sql)', error);
  await audit(req, 'create', 'service_task', data.id, { service_name: serviceName });
  res.status(201).json({ service: data });
});

// ---------------------------------------------------------------------------
// ROLES
// ---------------------------------------------------------------------------
async function fetchRoles() {
  const { data, error } = await supabaseAdmin.from('roles').select('*, role_permissions(permission_key)').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const shaped = shapeRole(r);
    if (r.name === 'owner') shaped.permissions = [...ALL_PERMISSIONS];
    return shaped;
  });
}

dashboardRouter.get('/roles', requireStaff, async (_req: Request, res: Response) => {
  try { res.json(await fetchRoles()); } catch (e) { dbFail(res, 'تحميل الأدوار', e as Error); }
});

function parseRoleBody(body: any) {
  const nameAr = typeof body?.name_ar === 'string' ? body.name_ar.trim().slice(0, 80) : '';
  const permissions = Array.isArray(body?.permissions)
    ? [...new Set<string>(body.permissions.filter((p: unknown): p is string => typeof p === 'string' && (ALL_PERMISSIONS as readonly string[]).includes(p)))]
    : [];
  return {
    nameAr,
    permissions,
    description: typeof body?.description === 'string' ? body.description.trim().slice(0, 300) : null,
    color: typeof body?.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#3b82f6',
  };
}

/** Non-super users can only grant permissions they hold themselves. */
function escalates(req: Request, permissions: string[]): boolean {
  if (isSuperRole(req.user!.role)) return false;
  return permissions.some((p) => !hasPermission(req.user!.permissions, p as any));
}

async function setRolePermissions(roleId: string, permissions: string[]) {
  await supabaseAdmin.from('role_permissions').delete().eq('role_id', roleId);
  if (permissions.length) {
    await supabaseAdmin.from('role_permissions').insert(permissions.map((permission_key) => ({ role_id: roleId, permission_key })));
  }
}

dashboardRouter.post('/roles', requirePermission('manage_roles_permissions'), async (req: Request, res: Response) => {
  const r = parseRoleBody(req.body);
  if (!r.nameAr) return fail(res, 400, 'اسم الدور مطلوب');
  if (escalates(req, r.permissions)) return fail(res, 403, 'لا يمكنك منح صلاحيات لا تملكها');
  const requested = typeof req.body?.name === 'string' ? req.body.name.trim().toLowerCase() : '';
  const slug = /^[a-z][a-z0-9_]{2,40}$/.test(requested) && !(BUILTIN_ROLES as readonly string[]).includes(requested)
    ? requested : `custom_${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabaseAdmin.from('roles')
    .insert({ name: slug, name_ar: r.nameAr, description: r.description, color: r.color, is_system: false })
    .select().single();
  if (error || !data) {
    if (error?.code === '23505') return fail(res, 409, 'يوجد دور بنفس الاسم');
    return dbFail(res, 'إنشاء الدور', error);
  }
  await setRolePermissions(data.id, r.permissions);
  await audit(req, 'create', 'role', data.id, { name: slug, permissions: r.permissions });
  res.status(201).json({ role: shapeRole({ ...data, role_permissions: r.permissions.map((permission_key) => ({ permission_key })) }) });
});

dashboardRouter.put('/roles/:slug', requirePermission('manage_roles_permissions'), async (req: Request, res: Response) => {
  const { data: role } = await supabaseAdmin.from('roles').select('*').eq('name', req.params.slug).maybeSingle();
  if (!role) return fail(res, 404, 'الدور غير موجود');
  if (role.is_system) return fail(res, 400, 'أدوار النظام الأساسية ثابتة ولا يمكن تعديل صلاحياتها');
  const r = parseRoleBody(req.body);
  if (!r.nameAr) return fail(res, 400, 'اسم الدور مطلوب');
  if (escalates(req, r.permissions)) return fail(res, 403, 'لا يمكنك منح صلاحيات لا تملكها');
  const { error } = await supabaseAdmin.from('roles').update({ name_ar: r.nameAr, description: r.description, color: r.color }).eq('id', role.id);
  if (error) return dbFail(res, 'تحديث الدور', error);
  await setRolePermissions(role.id, r.permissions);
  await audit(req, 'update', 'role', role.id, { permissions: r.permissions });
  res.json({ success: true });
});

dashboardRouter.delete('/roles/:slug', requirePermission('manage_roles_permissions'), async (req: Request, res: Response) => {
  const { data: role } = await supabaseAdmin.from('roles').select('id, is_system').eq('name', req.params.slug).maybeSingle();
  if (!role) return fail(res, 404, 'الدور غير موجود');
  if (role.is_system) return fail(res, 400, 'لا يمكن حذف أدوار النظام');
  const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('custom_role_id', role.id);
  if ((count ?? 0) > 0) return fail(res, 409, `لا يمكن حذف الدور: مُعيَّن لـ ${count} موظف. غيّر أدوارهم أولاً.`);
  const { error } = await supabaseAdmin.from('roles').delete().eq('id', role.id);
  if (error) return dbFail(res, 'حذف الدور', error);
  await audit(req, 'delete', 'role', role.id, {});
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// STAFF
// ---------------------------------------------------------------------------
/** Assign a built-in or custom role to a profile. */
async function assignRole(profileId: string, role: string): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  if (isBuiltinRole(role)) {
    const { error } = await supabaseAdmin.from('profiles').update({ role, custom_role_id: null, updated_at: now }).eq('id', profileId);
    if (error && /custom_role_id/.test(error.message)) {
      const retry = await supabaseAdmin.from('profiles').update({ role, updated_at: now }).eq('id', profileId);
      return retry.error ? { ok: false, error: retry.error.message } : { ok: true };
    }
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { data: custom } = await supabaseAdmin.from('roles').select('id').eq('name', role).eq('is_system', false).maybeSingle();
  if (!custom) return { ok: false, error: 'الدور المحدد غير موجود' };
  const { error } = await supabaseAdmin.from('profiles').update({ role: 'customer', custom_role_id: custom.id, updated_at: now }).eq('id', profileId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

async function effectiveRoleOf(profileId: string) {
  const { data } = await supabaseAdmin.from('profiles').select('id, role, status, custom_role_id').eq('id', profileId).maybeSingle();
  if (!data) return null;
  let role: string = data.role;
  if ((data as any).custom_role_id) {
    const { data: r } = await supabaseAdmin.from('roles').select('name').eq('id', (data as any).custom_role_id).maybeSingle();
    if (r?.name) role = r.name;
  }
  return { id: data.id as string, role, status: data.status as string };
}

dashboardRouter.get('/staff', requireStaff, async (_req: Request, res: Response) => {
  let query = await supabaseAdmin.from('profiles')
    .select('id, full_name, email, phone, role, status, created_at, custom_role_id')
    .or('role.neq.customer,custom_role_id.not.is.null').order('created_at');
  if (query.error && /custom_role_id/.test(query.error.message)) {
    query = (await supabaseAdmin.from('profiles')
      .select('id, full_name, email, phone, role, status, created_at').neq('role', 'customer').order('created_at')) as any;
  }
  if (query.error) return dbFail(res, 'تحميل الموظفين', query.error);
  const { data: roles } = await supabaseAdmin.from('roles').select('id, name');
  const byId = new Map((roles ?? []).map((r) => [r.id, r.name as string]));
  const members = (query.data ?? []).map((p: any) => ({
    id: p.id, full_name: p.full_name, email: p.email, phone: p.phone, status: p.status, created_at: p.created_at,
    role: (p.custom_role_id && byId.get(p.custom_role_id)) || p.role, pending: false,
  }));
  const { data: invites } = await supabaseAdmin.from('staff_invites').select('*').is('accepted_at', null).order('created_at');
  const pending = (invites ?? []).map((i) => ({
    id: `invite:${i.id}`, full_name: i.full_name ?? i.email, email: i.email, phone: i.phone,
    status: 'pending', created_at: i.created_at, role: i.role, pending: true,
  }));
  res.json([...members, ...pending]);
});

dashboardRouter.post('/staff', requirePermission('manage_users'), async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const role = typeof b.role === 'string' ? b.role : '';
  const fullName = typeof b.full_name === 'string' ? b.full_name.trim().slice(0, 200) : '';
  if (!isEmail(email) || !fullName) return fail(res, 400, 'الاسم والبريد الإلكتروني الصحيح مطلوبان');
  if (!role || role === 'customer' || role === 'owner' || role === 'super_admin') return fail(res, 400, 'الدور المحدد غير صالح للموظفين');
  const verdict = canChangeRole(req.user!, { id: '', role: 'customer' }, role);
  if (!verdict.ok) return fail(res, 403, verdict.error);

  const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) {
    const target = await effectiveRoleOf(existing.id);
    const v = canChangeRole(req.user!, { id: existing.id, role: target?.role ?? 'customer' }, role);
    if (!v.ok) return fail(res, 403, v.error);
    const assigned = await assignRole(existing.id, role);
    if (!assigned.ok) return fail(res, 400, assigned.error);
    await audit(req, 'assign_role', 'profile', existing.id, { role });
    return res.status(201).json({ invited: false, user_id: existing.id });
  }

  await supabaseAdmin.from('staff_invites').delete().eq('email', email).is('accepted_at', null);
  const { data: invite, error } = await supabaseAdmin.from('staff_invites').insert({
    email, full_name: fullName, role,
    phone: typeof b.phone === 'string' ? b.phone.trim().slice(0, 40) || null : null,
    notes: typeof b.notes === 'string' ? b.notes.trim().slice(0, 500) || null : null,
    invited_by: req.user!.id,
  }).select('id').single();
  if (error || !invite) return dbFail(res, 'حفظ دعوة الموظف (نفّذ phase3-complete.sql)', error);
  await audit(req, 'invite_staff', 'staff_invite', invite.id, { email, role });
  res.status(201).json({ invited: true, invite_id: invite.id, message: 'سيحصل على الدور تلقائياً عند أول تسجيل دخول بهذا البريد' });
});

dashboardRouter.put('/staff/:userId/role', requirePermission('manage_users'), async (req: Request, res: Response) => {
  const role = typeof req.body?.role === 'string' ? req.body.role : '';
  if (!isUuid(req.params.userId) || !role) return fail(res, 400, 'بيانات غير صالحة');
  if (role === 'super_admin') return fail(res, 400, 'الدور غير صالح');
  const target = await effectiveRoleOf(req.params.userId);
  if (!target) return fail(res, 404, 'لم يتم العثور على المستخدم');
  const verdict = canChangeRole(req.user!, target, role);
  if (!verdict.ok) return fail(res, 403, verdict.error);
  const assigned = await assignRole(req.params.userId, role);
  if (!assigned.ok) return fail(res, 400, assigned.error);
  await audit(req, 'change_role', 'profile', req.params.userId, { from: target.role, to: role });
  res.json({ success: true });
});

dashboardRouter.put('/staff/:userId', requirePermission('manage_users'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.userId)) return fail(res, 400, 'معرف المستخدم غير صالح');
  const target = await effectiveRoleOf(req.params.userId);
  if (!target) return fail(res, 404, 'لم يتم العثور على المستخدم');
  const verdict = canChangeRole(req.user!, target, undefined);
  if (!verdict.ok) return fail(res, 403, verdict.error);
  const b = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (['active', 'suspended'].includes(b.status)) updates.status = b.status;
  if (typeof b.full_name === 'string' && b.full_name.trim()) updates.full_name = b.full_name.trim().slice(0, 200);
  if (typeof b.phone === 'string') updates.phone = b.phone.trim().slice(0, 40) || null;
  const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.params.userId);
  if (error) return dbFail(res, 'تحديث المستخدم', error);
  await audit(req, 'update', 'profile', req.params.userId, updates);
  res.json({ success: true });
});

dashboardRouter.delete('/staff/invite/:id', requirePermission('manage_users'), async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 400, 'معرف الدعوة غير صالح');
  await supabaseAdmin.from('staff_invites').delete().eq('id', req.params.id).is('accepted_at', null);
  await audit(req, 'cancel_invite', 'staff_invite', req.params.id, {});
  res.json({ success: true });
});

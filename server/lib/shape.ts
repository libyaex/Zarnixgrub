/** Pure shaping/parsing helpers between DB rows and the storefront types. */
import { isUuid } from './validators.ts';

const clip = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** DB row (with joins) -> the Product type the UI expects. Never leaks storage paths publicly. */
export function shapeProduct(row: any, opts: { includeFiles?: boolean } = {}) {
  const { product_options, product_files, categories, ...rest } = row ?? {};
  const options = [...(product_options ?? [])]
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((o: any) => ({ ...o, price: Number(o.price) }));
  const out: Record<string, unknown> = {
    ...rest,
    base_price: Number(rest.base_price),
    category_name: categories?.name ?? undefined,
    options,
  };
  if (opts.includeFiles) out.files = product_files ?? [];
  return out;
}

/** NOTE: a plain object (not a boolean-discriminated union) so it narrows even with strictNullChecks off. */
export interface ParsedProduct { ok: boolean; error?: string; value?: Record<string, unknown>; options?: any[] }

const STATUSES = ['draft', 'published', 'archived'];
const OPTION_TYPES = ['checkbox', 'radio', 'addon', 'package'];

/**
 * Validate a product payload. `partial=true` (updates) only touches provided
 * keys, and an explicit empty string/array CLEARS a field (the old code could
 * never blank a value).
 */
export function parseProductPayload(body: any, partial: boolean): ParsedProduct {
  const b = body ?? {};
  const v: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);

  const text = (k: string, max: number, required = false) => {
    if (!has(k)) return required && !partial ? `الحقل ${k} مطلوب` : null;
    const s = typeof b[k] === 'string' ? b[k].trim().slice(0, max) : '';
    if (required && !s) return `الحقل ${k} مطلوب`;
    v[k] = s;
    return null;
  };
  const errs = [
    text('name', 200, true), text('slug', 200, true),
    text('short_description', 500, true), text('full_description', 8000, true),
    text('main_image', 2000, !partial),
  ].filter(Boolean);
  if (errs.length) return { ok: false, error: String(errs[0]) };

  if (has('slug') && !/^[a-z0-9\u0600-\u06FF]+(?:-[a-z0-9\u0600-\u06FF]+)*$/i.test(String(v.slug))) {
    return { ok: false, error: 'المعرف (slug) يجب أن يحتوي أحرفاً وأرقاماً وشرطات فقط' };
  }
  if (has('base_price') || !partial) {
    const n = Number(b.base_price);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) return { ok: false, error: 'السعر غير صالح' };
    v.base_price = Math.round(n * 100) / 100;
  }
  if (has('category_id') || !partial) {
    if (b.category_id === '' || b.category_id == null) v.category_id = null;
    else if (isUuid(b.category_id)) v.category_id = b.category_id;
    else return { ok: false, error: 'التصنيف غير صالح' };
  }
  if (has('status')) {
    if (!STATUSES.includes(String(b.status))) return { ok: false, error: 'حالة المنتج غير صالحة' };
    v.status = b.status;
  } else if (!partial) v.status = 'draft';

  for (const k of ['product_type', 'license_type']) if (has(k)) v[k] = clip(b[k], 60) ?? (k === 'product_type' ? 'software' : 'commercial');
  for (const k of ['installation_guide', 'demo_url', 'code_repository']) if (has(k)) v[k] = clip(b[k], 4000);
  if (has('is_featured')) v.is_featured = b.is_featured === true;

  const arr = (k: string, max: number) => {
    if (!has(k)) return;
    v[k] = Array.isArray(b[k]) ? b[k].slice(0, max) : [];
  };
  arr('features', 100); arr('faq', 100); arr('technical_requirements', 100); arr('gallery_images', 20);
  if (has('economic_study')) v.economic_study = b.economic_study && typeof b.economic_study === 'object' ? b.economic_study : {};

  let options: any[] | undefined;
  if (Array.isArray(b.options)) {
    options = [];
    for (const [i, o] of b.options.slice(0, 50).entries()) {
      const name = clip(o?.name, 200);
      const price = Number(o?.price);
      if (!name || !Number.isFinite(price) || price < 0) return { ok: false, error: `الخيار رقم ${i + 1} غير صالح` };
      options.push({
        id: isUuid(o.id) ? o.id : undefined,
        name,
        description: clip(o.description, 1000),
        price: Math.round(price * 100) / 100,
        option_type: OPTION_TYPES.includes(o.option_type) ? o.option_type : 'checkbox',
        is_required: o.is_required === true,
        is_active: o.is_active !== false,
        sort_order: Number.isFinite(Number(o.sort_order)) ? Number(o.sort_order) : i,
      });
    }
  }
  return { ok: true, value: v, options };
}

/** DB role + role_permissions rows -> the Role shape the dashboard renders (id = slug). */
export function shapeRole(row: any) {
  return {
    id: row.name,
    uuid: row.id,
    name: row.name,
    name_ar: row.name_ar,
    description: row.description ?? '',
    color: row.color,
    is_system: row.is_system,
    permissions: (row.role_permissions ?? []).map((p: any) => p.permission_key),
    created_at: row.created_at,
  };
}

/** Order row (with joins) -> the Order type the UI expects. */
export function shapeOrder(
  row: any,
  customer?: { full_name?: string | null; email?: string | null; phone?: string | null }
) {
  const { order_items, payment_submissions, ...rest } = row ?? {};
  const subs = [...(payment_submissions ?? [])].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const latest = subs[0];
  return {
    ...rest,
    subtotal: Number(rest.subtotal),
    discount_amount: Number(rest.discount_amount),
    total_amount: Number(rest.total_amount),
    customer_name: customer?.full_name ?? undefined,
    customer_email: customer?.email ?? undefined,
    customer_phone: customer?.phone ?? undefined,
    items: order_items ?? [],
    payment_submission: latest ? { ...latest, transferred_amount: Number(latest.transferred_amount) } : undefined,
  };
}

/** Run a paginated query to completion (PostgREST caps a single response at 1000 rows). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxPages = 50
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await page(i * pageSize, i * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

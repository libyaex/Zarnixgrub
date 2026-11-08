/**
 * Product save compatibility — the legacy dashboard form POSTs/PUTs the
 * FULL product object to /api/products and /api/products/:id. Those URLs
 * previously 404'd, so products silently fell back to localStorage.
 * ESM NOTE: internal imports carry explicit `.ts` extensions.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth, requirePermission } from '../lib/auth.ts';

export const productSaveRouter = Router();

const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

async function audit(
  req: Request,
  action: string,
  entityId: string,
  details: Record<string, unknown>
) {
  await supabaseAdmin.from('audit_logs').insert({
    admin_id: req.user!.id,
    action,
    entity_type: 'product',
    entity_id: entityId,
    details,
  });
}

function productRowFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: str(body.name, 200),
    slug: str(body.slug, 200) ?? `prod-${Date.now()}`,
    short_description: str(body.short_description, 500) ?? 'منتج جديد',
    full_description: str(body.full_description, 20000) ?? 'وصف المنتج يُحدَّث لاحقاً',
    category_id: str(body.category_id, 64),
    base_price: num(body.base_price) ?? 0,
    main_image: str(body.main_image, 1000000) ?? 'https://api.dicebear.com/7.x/initials/svg?seed=Zarnix',
    product_type: str(body.product_type, 60) ?? 'software',
    license_type: str(body.license_type, 60) ?? 'commercial',
    status: ['draft', 'published', 'archived'].includes(String(body.status)) ? String(body.status) : 'draft',
    is_featured: typeof body.is_featured === 'boolean' ? body.is_featured : false,
    technical_requirements: Array.isArray(body.technical_requirements) ? body.technical_requirements : [],
    features: Array.isArray(body.features) ? body.features : [],
    faq: Array.isArray(body.faq) ? body.faq : [],
    economic_study:
      body.economic_study && typeof body.economic_study === 'object' && !Array.isArray(body.economic_study)
        ? body.economic_study
        : {},
  };
  if (str(body.installation_guide, 10000)) payload.installation_guide = str(body.installation_guide, 10000);
  return payload;
}

async function saveProductOptions(productId: string, rawOptions: unknown): Promise<void> {
  const incoming = Array.isArray(rawOptions) ? (rawOptions as Array<Record<string, unknown>>) : [];
  await supabaseAdmin.from('product_options').delete().eq('product_id', productId);
  const rows = incoming
    .map((o) => ({
      product_id: productId,
      name: str(o?.name, 200) ?? 'خيار',
      description: str(o?.description, 500),
      price: num(o?.price) ?? 0,
      option_type: ['checkbox', 'radio', 'addon', 'package', 'license'].includes(String(o?.option_type))
        ? String(o.option_type)
        : 'addon',
      is_required: typeof o?.is_required === 'boolean' ? o.is_required : false,
      is_active: typeof o?.is_active === 'boolean' ? o.is_active : true,
      sort_order: num(o?.sort_order) ?? 0,
    }))
    .filter((r) => r.name);
  if (rows.length > 0) {
    await supabaseAdmin.from('product_options').insert(rows);
  }
}

async function saveProductGallery(productId: string, rawGallery: unknown): Promise<void> {
  const incoming = Array.isArray(rawGallery) ? (rawGallery as unknown[]).map(String).slice(0, 20) : [];
  await supabaseAdmin.from('product_images').delete().eq('product_id', productId);
  if (incoming.length > 0) {
    await supabaseAdmin
      .from('product_images')
      .insert(incoming.map((path, i) => ({ product_id: productId, storage_path: path, sort_order: i })));
  }
}

productSaveRouter.post(
  '/products',
  requireAuth,
  requirePermission('manage_products'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const row = productRowFromBody(body);
    if (!row.name || !row.category_id) {
      res.status(400).json({ error: 'الاسم والتصنيف مطلوبان' });
      return;
    }
    const {


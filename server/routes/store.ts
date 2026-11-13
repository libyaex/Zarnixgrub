/**
 * Phase 3 — Store data endpoints backed by Supabase.
 * Aligned with the production schema (supabase/schema.sql):
 * - Bank accounts live in `payment_accounts` (not bank_accounts).
 * - `orders` has no coupon_id column; coupon usage is tracked by code.
 * - There is no separate `services` catalog table: services are the
 *   installation/customization addons represented by product_options
 *   (option_type 'addon') on published products.
 * Prices are ALWAYS recalculated server-side from the database.
 *
 * ESM NOTE: internal imports carry explicit `.ts` extensions — required
 * by Node ESM on Vercel (ERR_MODULE_NOT_FOUND otherwise).
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth } from '../lib/auth.ts';
import { evaluateCoupon, COUPON_MESSAGES, priceLine, missingRequiredOptions, round2 } from '../lib/pricing.ts';
import { shapeProduct, shapeOrder } from '../lib/shape.ts';

export const storeRouter = Router();

/** GET /api/products — public: published products only. */
storeRouter.get('/products', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, product_options(*), categories(name)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(0, 499);
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل المنتجات حالياً' });
    return;
  }
  res.json((data ?? []).map((p) => shapeProduct(p)));
});

/** GET /api/products/:slug — public: single published product. */
storeRouter.get('/products/:slug', async (req: Request, res: Response) => {
  const { data: bySlug, error: slugError } = await supabaseAdmin
    .from('products')
    .select('*, product_options(*), categories(name)')
    .eq('slug', req.params.slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!slugError && bySlug) {
    res.json(shapeProduct(bySlug));
    return;
  }
  const { data: byId, error: idError } = await supabaseAdmin
    .from('products')
    .select('*, product_options(*), categories(name)')
    .eq('id', req.params.slug)
    .eq('status', 'published')
    .maybeSingle();
  if (idError || !byId) {
    res.status(404).json({ error: 'لم يتم العثور على المنتج' });
    return;
  }
  res.json(shapeProduct(byId));
});

/** GET /api/categories — public: active categories only. */
storeRouter.get('/categories', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل التصنيفات حالياً' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/services — authenticated: the caller's OWN service/installation tasks. */
storeRouter.get('/services', requireAuth, async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('service_tasks')
    .select('*, orders(order_number), products(name)')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الخدمات حالياً' });
    return;
  }
  res.json((data ?? []).map(({ orders, products, ...t }: any) => ({
    ...t,
    order_number: orders?.order_number ?? '',
    product_name: t.product_name ?? products?.name ?? '',
  })));
});

/** GET /api/banks — public: active bank accounts (payment_accounts) for the transfer page. */
storeRouter.get('/banks', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payment_accounts')
    .select('id, bank_name, account_holder, account_number, iban, instructions')
    .eq('is_active', true)
    .order('is_default', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الحسابات البنكية' });
    return;
  }
  res.json(data ?? []);
});

/** Atomically consume one coupon use. Uses the SQL function when present, else compare-and-set. */
async function redeemCoupon(code: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('redeem_coupon', { p_code: code });
  if (!error) return data === true;
  const { data: c } = await supabaseAdmin.from('coupons').select('used_count, max_uses').eq('code', code).maybeSingle();
  if (!c || c.used_count >= c.max_uses) return false;
  const { data: updated } = await supabaseAdmin
    .from('coupons').update({ used_count: c.used_count + 1 })
    .eq('code', code).eq('used_count', c.used_count).select('code');
  return !!updated?.length;
}

const COUPON_COLUMNS = 'code, discount_type, discount_value, minimum_order, max_uses, used_count, starts_at, expires_at, is_active';

/**
 * POST /api/orders — authenticated checkout.
 * The browser sends product ids + selected option ids ONLY; every price is
 * recalculated from the database. Required options are enforced and an
 * invalid coupon is rejected explicitly (never silently ignored).
 */
storeRouter.post('/orders', requireAuth, async (req: Request, res: Response) => {
  type IncomingItem = { product_id: string; option_ids?: unknown[]; selected_options?: Array<{ option_id?: string }>; quantity: number };
  const items: IncomingItem[] = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
  if (items.length === 0) {
    res.status(400).json({ error: 'السلة فارغة' });
    return;
  }

  let subtotal = 0;
  const pricedItems: Array<Record<string, unknown>> = [];

  for (const raw of items) {
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(raw.quantity) || 1)));
    const optionIds = [...new Set(
      (Array.isArray(raw.option_ids) ? raw.option_ids : (raw.selected_options ?? []).map((o) => o?.option_id))
        .filter((v): v is string => typeof v === 'string').slice(0, 30)
    )];

    const { data: product } = await supabaseAdmin
      .from('products').select('id, name, base_price, status')
      .eq('id', String(raw.product_id)).eq('status', 'published').maybeSingle();
    if (!product) {
      res.status(400).json({ error: 'أحد المنتجات في السلة لم يعد متاحاً' });
      return;
    }

    const { data: allOptions, error: optionsError } = await supabaseAdmin
      .from('product_options').select('id, name, price, description, is_required')
      .eq('product_id', product.id).eq('is_active', true);
    if (optionsError) {
      res.status(500).json({ error: 'تعذر التحقق من خيارات المنتج' });
      return;
    }
    const byId = new Map<string, any>((allOptions ?? []).map((o: any) => [o.id as string, o] as [string, any]));
    if (optionIds.some((id) => !byId.has(id))) {
      res.status(400).json({ error: `أحد الخيارات المحددة غير صالح للمنتج "${product.name}"` });
      return;
    }
    if (missingRequiredOptions(allOptions ?? [], optionIds).length) {
      res.status(400).json({ error: `يرجى اختيار الخيارات الإلزامية للمنتج "${product.name}"` });
      return;
    }
    const chosen = optionIds.map((id) => byId.get(id)!);
    const lineTotal = priceLine(Number(product.base_price), chosen.map((o) => Number(o.price)), quantity);
    subtotal = round2(subtotal + lineTotal);
    pricedItems.push({
      product_id: product.id,
      product_name_snapshot: product.name,
      base_price_snapshot: Number(product.base_price),
      selected_options_snapshot: chosen.map((o) => ({ option_id: o.id, name: o.name, price: Number(o.price), description: o.description ?? null })),
      total_price: lineTotal,
      quantity,
    });
  }

  let discountAmount = 0;
  let appliedCoupon = '';
  const couponCode = typeof req.body?.coupon_code === 'string' ? req.body.coupon_code.trim().toUpperCase() : '';
  if (couponCode) {
    const { data: coupon } = await supabaseAdmin.from('coupons').select(COUPON_COLUMNS).eq('code', couponCode).maybeSingle();
    const result = coupon ? evaluateCoupon(coupon as any, subtotal) : null;
    if (!result || !result.valid) {
      res.status(400).json({ error: result ? COUPON_MESSAGES[result.reason!] : 'كود الخصم غير صالح', code: 'coupon_invalid' });
      return;
    }
    if (!(await redeemCoupon(couponCode))) {
      res.status(409).json({ error: COUPON_MESSAGES.exhausted, code: 'coupon_invalid' });
      return;
    }
    discountAmount = result.discount ?? 0;
    appliedCoupon = couponCode;
  }
  const undoCoupon = async () => {
    if (!appliedCoupon) return;
    const { data: c } = await supabaseAdmin.from('coupons').select('used_count').eq('code', appliedCoupon).maybeSingle();
    if (c && c.used_count > 0) await supabaseAdmin.from('coupons').update({ used_count: c.used_count - 1 }).eq('code', appliedCoupon);
  };

  const total = round2(subtotal - discountAmount);
  const orderNumber = `ZNX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: req.user!.id,
      subtotal,
      discount_amount: discountAmount,
      total_amount: total,
      currency: 'LYD',
      payment_status: 'unsubmitted',
      order_status: 'pending',
      coupon_code: appliedCoupon || null,
      customer_notes: typeof req.body?.customer_notes === 'string' ? req.body.customer_notes.slice(0, 500) : null,
    })
    .select()
    .single();
  if (orderError || !order) {
    await undoCoupon();
    res.status(500).json({ error: 'تعذر إنشاء الطلب. حاول مرة أخرى.' });
    return;
  }

  const rows = pricedItems.map((item) => ({ ...item, order_id: order.id }));
  const { data: inserted, error: itemsError } = await supabaseAdmin.from('order_items').insert(rows).select();
  if (itemsError) {
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    await undoCoupon();
    res.status(500).json({ error: 'تعذر حفظ عناصر الطلب' });
    return;
  }

  const shaped = shapeOrder({ ...order, order_items: inserted ?? rows, payment_submissions: [] },
    { full_name: req.user!.full_name, email: req.user!.email });
  // Order fields at the top level (what the UI reads) and under `order` (API consumers).
  res.status(201).json({ ...shaped, order: shaped });
});

/** GET /api/orders — authenticated: only the caller's own orders. */
storeRouter.get('/orders', requireAuth, async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*), payment_submissions(*)')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .range(0, 199);
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الطلبات' });
    return;
  }
  res.json((data ?? []).map((o) => shapeOrder(o)));
});

/**
 * POST /api/coupons/validate { code, cart_subtotal } -> { code, discount_amount }
 * A preview only: the real discount is recomputed server-side at checkout.
 */
storeRouter.post('/coupons/validate', requireAuth, async (req: Request, res: Response) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  const cartSubtotal = Number(req.body?.cart_subtotal);
  if (!code) {
    res.status(400).json({ error: 'يرجى إدخال كود الخصم' });
    return;
  }
  const { data: coupon } = await supabaseAdmin.from('coupons').select(COUPON_COLUMNS).eq('code', code).maybeSingle();
  if (!coupon) {
    res.status(404).json({ error: 'كود الخصم غير صالح' });
    return;
  }
  const result = evaluateCoupon(coupon as any, Number.isFinite(cartSubtotal) && cartSubtotal >= 0 ? cartSubtotal : 0);
  if (!result.valid) {
    const extra = result.reason === 'below_minimum' ? ` (الحد الأدنى ${result.minimum} د.ل)` : '';
    res.status(422).json({ error: COUPON_MESSAGES[result.reason!] + extra, code: 'coupon_invalid' });
    return;
  }
  res.json({ code: coupon.code, discount_amount: result.discount ?? 0 });
});

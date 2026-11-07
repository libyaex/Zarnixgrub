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

export const storeRouter = Router();

/** GET /api/products — public: published products only. */
storeRouter.get('/products', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, product_options(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل المنتجات حالياً' });
    return;
  }
  res.json(data ?? []);
});

/** GET /api/products/:slug — public: single published product. */
storeRouter.get('/products/:slug', async (req: Request, res: Response) => {
  const { data: bySlug, error: slugError } = await supabaseAdmin
    .from('products')
    .select('*, product_options(*)')
    .eq('slug', req.params.slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!slugError && bySlug) {
    res.json(bySlug);
    return;
  }
  const { data: byId, error: idError } = await supabaseAdmin
    .from('products')
    .select('*, product_options(*)')
    .eq('id', req.params.slug)
    .eq('status', 'published')
    .maybeSingle();
  if (idError || !byId) {
    res.status(404).json({ error: 'لم يتم العثور على المنتج' });
    return;
  }
  res.json(byId);
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

/** GET /api/services — public: active addon options across published products. */
storeRouter.get('/services', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('product_options')
    .select('id, product_id, name, description, price, option_type, products!inner(name, slug, status)')
    .eq('is_active', true)
    .eq('products.status', 'published')
    .order('price', { ascending: true });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الخدمات حالياً' });
    return;
  }
  res.json(data ?? []);
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

/**
 * POST /api/orders — authenticated checkout.
 * The client sends product IDs + option IDs ONLY. The server recalculates
 * every price from the database and assigns the order to the verified
 * user. No prices or totals are accepted from the browser.
 */
storeRouter.post('/orders', requireAuth, async (req: Request, res: Response) => {
  type IncomingItem = { product_id: string; option_ids: string[]; quantity: number };
  const items: IncomingItem[] = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    res.status(400).json({ error: 'السلة فارغة' });
    return;
  }

  let subtotal = 0;
  const pricedItems: Array<Record<string, unknown>> = [];

  for (const raw of items) {
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(raw.quantity) || 1)));
    const optionIds = Array.isArray(raw.option_ids)
      ? raw.option_ids.map(String).slice(0, 20)
      : [];

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, base_price, status')
      .eq('id', String(raw.product_id))
      .eq('status', 'published')
      .single();
    if (productError || !product) {
      res.status(400).json({ error: `منتج غير متاح في الطلب: ${raw.product_id}` });
      return;
    }

    let optionsSnapshot: Array<Record<string, unknown>> = [];
    let optionsTotal = 0;
    if (optionIds.length > 0) {
      const { data: options, error: optionsError } = await supabaseAdmin
        .from('product_options')
        .select('id, name, price, description, is_active, is_required')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .in('id', optionIds);
      if (optionsError) {
        res.status(500).json({ error: 'تعذر التحقق من خيارات المنتج' });
        return;
      }
      if (options.length !== optionIds.length) {
        res.status(400).json({ error: 'أحد الخيارات المطلوبة غير صالح لهذا المنتج' });
        return;
      }
      optionsSnapshot = options.map((o) => ({
        option_id: o.id,
        name: o.name,
        price: o.price,
        description: o.description ?? null,
      }));
      optionsTotal = options.reduce((sum, o) => sum + Number(o.price), 0);
    }

    const lineTotal = (Number(product.base_price) + optionsTotal) * quantity;
    subtotal += lineTotal;
    pricedItems.push({
      product_id: product.id,
      product_name_snapshot: product.name,
      base_price_snapshot: Number(product.base_price),
      selected_options_snapshot: optionsSnapshot,
      total_price: lineTotal,
      quantity,
    });
  }

  let discountAmount = 0;
  const couponCode = typeof req.body?.coupon_code === 'string' ? req.body.coupon_code.trim().toUpperCase() : '';
  if (couponCode) {
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('coupons')
      .select('id, discount_type, discount_value, minimum_order, max_uses, used_count, starts_at, expires_at, is_active')
      .eq('code', couponCode)
      .eq('is_active', true)
      .single();
    const nowIso = new Date().toISOString();
    const valid =
      !couponError &&
      coupon &&
      coupon.starts_at <= nowIso &&
      (!coupon.expires_at || coupon.expires_at >= nowIso) &&
      coupon.used_count < coupon.max_uses &&
      subtotal >= Number(coupon.minimum_order);
    if (valid && coupon) {
      discountAmount =
        coupon.discount_type === 'percentage'
          ? (subtotal * Number(coupon.discount_value)) / 100
          : Number(coupon.discount_value);
      discountAmount = Math.min(discountAmount, subtotal);
    }
  }

  const total = subtotal - discountAmount;
  const orderNumber = `ZNX-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;

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
      coupon_code: couponCode || null,
      customer_notes: typeof req.body?.customer_notes === 'string' ? req.body.customer_notes.slice(0, 500) : null,
    })
    .select()
    .single();
  if (orderError || !order) {
    res.status(500).json({ error: 'تعذر إنشاء الطلب. حاول مرة أخرى.' });
    return;
  }

  const itemsWithOrder = pricedItems.map((item) => ({ ...item, order_id: order.id }));
  const { error: itemsError } = await supabaseAdmin
    .from('order_items')
    .insert(itemsWithOrder);
  if (itemsError) {
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    res.status(500).json({ error: 'تعذر حفظ عناصر الطلب' });
    return;
  }

  // Increment coupon usage by code (orders has no coupon_id column).
  if (couponCode) {
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('used_count, max_uses')
      .eq('code', couponCode)
      .single();
    if (coupon) {
      await supabaseAdmin
        .from('coupons')
        .update({ used_count: coupon.used_count + 1 })
        .eq('code', couponCode)
        .lt('used_count', coupon.max_uses);
    }
  }

  res.status(201).json({ order: { ...order, items: itemsWithOrder } });
});

/** GET /api/orders — authenticated: only the caller's own orders. */
storeRouter.get('/orders', requireAuth, async (req: Request, res: Response) => {
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

/** POST /api/coupons/validate — authenticated validation of a coupon code. */
storeRouter.post('/coupons/validate', requireAuth, async (req: Request, res: Response) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!code) {
    res.status(400).json({ error: 'يرجى إدخال كود الخصم' });
    return;
  }
  const { data: coupon, error } = await supabaseAdmin
    .from('coupons')
    .select('code, discount_type, discount_value, minimum_order, expires_at, is_active')
    .eq('code', code)
    .eq('is_active', true)
    .single();
  const nowIso = new Date().toISOString();
  if (error || !coupon || (coupon.expires_at && coupon.expires_at < nowIso)) {
    res.status(404).json({ error: 'كود الخصم غير صالح أو منتهي الصلاحية' });
    return;
  }
  res.json({
    coupon: {
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      minimum_order: Number(coupon.minimum_order),
    },
  });
});

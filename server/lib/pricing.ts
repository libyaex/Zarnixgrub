/** Pure pricing / coupon rules shared by checkout and coupon validation. */
export interface CouponRow {
  discount_type: 'fixed' | 'percentage';
  discount_value: number | string;
  minimum_order: number | string;
  max_uses: number;
  used_count: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export type CouponFailure =
  | 'inactive' | 'not_started' | 'expired' | 'exhausted' | 'below_minimum';

export interface CouponResult {
  valid: boolean;
  discount?: number;
  reason?: CouponFailure;
  minimum?: number;
}

export const COUPON_MESSAGES: Record<CouponFailure, string> = {
  inactive: 'كود الخصم غير صالح',
  not_started: 'كود الخصم لم يبدأ بعد',
  expired: 'انتهت صلاحية كود الخصم',
  exhausted: 'تم استنفاد الحد الأقصى لاستخدام هذا الكود',
  below_minimum: 'قيمة الطلب أقل من الحد الأدنى لاستخدام هذا الكود',
};

/** Money is kept at 2 decimals everywhere. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function evaluateCoupon(
  coupon: CouponRow,
  subtotal: number,
  now: Date = new Date()
): CouponResult {
  if (!coupon.is_active) return { valid: false, reason: 'inactive' };
  if (new Date(coupon.starts_at).getTime() > now.getTime()) return { valid: false, reason: 'not_started' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now.getTime()) {
    return { valid: false, reason: 'expired' };
  }
  if (coupon.used_count >= coupon.max_uses) return { valid: false, reason: 'exhausted' };
  const minimum = Number(coupon.minimum_order);
  if (subtotal < minimum) return { valid: false, reason: 'below_minimum', minimum };

  const value = Number(coupon.discount_value);
  const raw = coupon.discount_type === 'percentage' ? (subtotal * value) / 100 : value;
  return { valid: true, discount: round2(Math.max(0, Math.min(raw, subtotal))) };
}

export function priceLine(basePrice: number, optionPrices: number[], quantity: number): number {
  const q = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
  return round2((Number(basePrice) + optionPrices.reduce((s, p) => s + Number(p), 0)) * q);
}

/** IDs of required options that the customer did not select. */
export function missingRequiredOptions(
  options: ReadonlyArray<{ id: string; is_required: boolean }>,
  selectedIds: readonly string[]
): string[] {
  const chosen = new Set(selectedIds);
  return options.filter((o) => o.is_required && !chosen.has(o.id)).map((o) => o.id);
}

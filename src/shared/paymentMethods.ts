/**
 * Payment methods available in Libya, shared by the API (validation) and the UI
 * (method picker, account cards, instructions).
 *
 * - OnePay and LYPay are the instant-payment services run by the Central Bank
 *   of Libya (launched 2024). OnePay: transfer to an ordinary account number.
 *   LYPay: transfer using the IBAN.
 * - Customers choose the method FIRST; only then do they see that method's
 *   account holder + the identifier it needs.
 *
 * Logos are trademarks of the services/banks: the owner uploads the official
 * logo per account from the dashboard (we ship neutral badges, not copies).
 */
export type PaymentMethodType = 'onepay' | 'lypay' | 'bank_transfer' | 'other';

export interface PaymentMethodMeta {
  type: PaymentMethodType;
  label: string;          // Arabic name shown to customers
  latin: string;          // brand spelling
  tagline: string;        // one line under the name
  identifier: 'account_number' | 'iban' | 'both';
  color: string;          // badge accent (no trademark artwork)
  initial: string;        // badge letter when no logo is uploaded
  steps: string[];        // "how to pay" (customer-facing)
  defaultInstructions: string;
}

export const PAYMENT_METHODS: Record<PaymentMethodType, PaymentMethodMeta> = {
  onepay: {
    type: 'onepay', label: 'ون باي', latin: 'OnePay',
    tagline: 'دفع فوري برقم الحساب', identifier: 'account_number', color: '#f97316', initial: 'O',
    steps: [
      'افتح تطبيق مصرفك واختر خدمة الدفع الفوري «ون باي (OnePay)».',
      'أدخل رقم الحساب الظاهر أمامك وتأكد أن اسم المستفيد يطابق اسم صاحب الحساب.',
      'حوّل المبلغ المطلوب بالضبط ثم التقط لقطة شاشة لإيصال العملية.',
    ],
    defaultInstructions: 'اكتب رقم طلبك في خانة الملاحظات إن وُجدت.',
  },
  lypay: {
    type: 'lypay', label: 'لي باي', latin: 'LYPay',
    tagline: 'دفع فوري بالآيبان (IBAN)', identifier: 'iban', color: '#0ea5e9', initial: 'L',
    steps: [
      'افتح تطبيق مصرفك واختر خدمة الدفع الفوري «لي باي (LYPay)».',
      'أدخل رقم الآيبان (IBAN) الظاهر أمامك وتأكد من اسم المستفيد.',
      'حوّل المبلغ المطلوب بالضبط ثم التقط لقطة شاشة لإيصال العملية.',
    ],
    defaultInstructions: 'انسخ الآيبان بالضغط على زر النسخ لتفادي الخطأ في الأرقام.',
  },
  bank_transfer: {
    type: 'bank_transfer', label: 'تحويل مصرفي', latin: 'Bank transfer',
    tagline: 'حوالة إلى حساب المصرف', identifier: 'both', color: '#10b981', initial: 'B',
    steps: [
      'حوّل المبلغ المطلوب إلى الحساب الظاهر أمامك من تطبيق مصرفك أو من الفرع.',
      'احتفظ بإيصال التحويل ورقم المرجع.',
      'أرفق صورة الإيصال في الخطوة التالية.',
    ],
    defaultInstructions: 'اكتب رقم طلبك في ملاحظات الحوالة إن أمكن.',
  },
  other: {
    type: 'other', label: 'وسيلة أخرى', latin: 'Other',
    tagline: 'حسب التعليمات المعروضة', identifier: 'both', color: '#a78bfa', initial: '•',
    steps: ['اتبع التعليمات الظاهرة أمامك ثم أرفق إثبات التحويل.'],
    defaultInstructions: '',
  },
};

export const PAYMENT_METHOD_TYPES = Object.keys(PAYMENT_METHODS) as PaymentMethodType[];
export const isPaymentMethodType = (v: unknown): v is PaymentMethodType =>
  typeof v === 'string' && v in PAYMENT_METHODS;

export const methodMeta = (type: unknown): PaymentMethodMeta =>
  isPaymentMethodType(type) ? PAYMENT_METHODS[type] : PAYMENT_METHODS.bank_transfer;

// ---------------------------------------------------------------- IBAN (Libya)
export const normalizeIban = (v: string): string => v.replace(/[\s-]+/g, '').toUpperCase();

/** ISO 13616 mod-97 check. */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder;
}

/** Libya IBAN: "LY" + 2 check digits + 21 digits = 25 characters, mod-97 valid. */
export function isValidLibyaIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  return /^LY\d{23}$/.test(iban) && mod97(iban) === 1;
}

/** Groups of four for reading/copying: "LY83 0020 4800 …". */
export const formatIban = (raw: string): string => normalizeIban(raw).replace(/(.{4})/g, '$1 ').trim();

// ------------------------------------------------------------- account payload
export interface PaymentAccountInput {
  method_type?: unknown; bank_name?: unknown; account_holder?: unknown; account_number?: unknown;
  iban?: unknown; instructions?: unknown; logo_url?: unknown; sort_order?: unknown;
  is_active?: unknown; is_default?: unknown;
}

export interface ParsedPaymentAccount {
  ok: boolean;
  error?: string;
  value?: Record<string, unknown>;
}

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const SAFE_URL = /^(https?:\/\/[^\s<>"']+|\/[^\s<>"']*)$/i;

/**
 * Validates an account for its method. `partial=true` (edits) only checks the
 * keys that were sent; creating checks everything the method needs.
 */
export function parsePaymentAccount(input: PaymentAccountInput, partial: boolean): ParsedPaymentAccount {
  const b = input ?? {};
  const has = (k: keyof PaymentAccountInput) => Object.prototype.hasOwnProperty.call(b, k);
  const v: Record<string, unknown> = {};

  const type: PaymentMethodType = has('method_type')
    ? (isPaymentMethodType(b.method_type) ? b.method_type : ('' as PaymentMethodType))
    : 'bank_transfer';
  if (has('method_type') && !type) return { ok: false, error: 'نوع وسيلة الدفع غير صالح' };
  if (has('method_type') || !partial) v.method_type = type || 'bank_transfer';
  const meta = methodMeta(type || 'bank_transfer');

  if (has('account_holder') || !partial) {
    const holder = clip(b.account_holder, 120);
    if (!holder) return { ok: false, error: 'اسم صاحب الحساب مطلوب' };
    v.account_holder = holder;
  }
  if (has('bank_name') || !partial) {
    const bank = clip(b.bank_name, 120) || (type === 'onepay' || type === 'lypay' ? meta.latin : '');
    if (!bank && type !== 'onepay' && type !== 'lypay') return { ok: false, error: 'اسم المصرف مطلوب' };
    v.bank_name = bank;
  }
  if (has('account_number') || !partial) v.account_number = clip(b.account_number, 40).replace(/\s+/g, ' ') || null;
  if (has('iban') || !partial) {
    const raw = clip(b.iban, 60);
    if (raw && !isValidLibyaIban(raw)) return { ok: false, error: 'رقم الآيبان غير صحيح. الصيغة: LY + 23 رقماً (25 خانة) — راجع الأرقام.' };
    v.iban = raw ? normalizeIban(raw) : null;
  }

  // The identifier each method needs (checked on create, or whenever either field is edited).
  if (!partial || has('account_number') || has('iban') || has('method_type')) {
    const acct = has('account_number') || !partial ? (v.account_number as string | null) : undefined;
    const iban = has('iban') || !partial ? (v.iban as string | null) : undefined;
    if (!partial) {
      if (type === 'onepay' && !acct) return { ok: false, error: 'ون باي يعمل برقم الحساب: أدخل رقم الحساب' };
      if (type === 'lypay' && !iban) return { ok: false, error: 'لي باي يعمل بالآيبان: أدخل رقم الآيبان (IBAN)' };
      if ((type === 'bank_transfer' || type === 'other') && !acct && !iban) return { ok: false, error: 'أدخل رقم الحساب أو الآيبان' };
    }
  }

  if (has('instructions') || !partial) v.instructions = clip(b.instructions, 1000) || null;
  if (has('logo_url') || !partial) {
    const logo = clip(b.logo_url, 2000);
    if (logo && !SAFE_URL.test(logo)) return { ok: false, error: 'رابط الشعار غير صالح' };
    v.logo_url = logo || null;
  }
  if (has('sort_order') || !partial) {
    const n = Number(b.sort_order ?? 0);
    v.sort_order = Number.isFinite(n) ? Math.max(0, Math.min(999, Math.round(n))) : 0;
  }
  if (has('is_active')) v.is_active = b.is_active === true;
  else if (!partial) v.is_active = true;
  if (has('is_default')) v.is_default = b.is_default === true;
  else if (!partial) v.is_default = false;
  return { ok: true, value: v };
}

/**
 * Single source of truth for every setting the owner can change from the
 * dashboard. Shared (pure, no imports) by the API (validation + defaults) and
 * the UI (settings form + runtime branding), so they can never drift apart.
 */
export type SettingType = 'string' | 'text' | 'number' | 'boolean' | 'color' | 'url' | 'image' | 'email';
export type SettingGroup = 'brand' | 'hero' | 'contact' | 'social' | 'seo' | 'pwa' | 'store' | 'notifications';

export interface SettingField {
  key: string;
  type: SettingType;
  group: SettingGroup;
  label: string;
  help?: string;
  default: string | number | boolean;
  max?: number; // max length (strings) / max value (numbers)
  min?: number; // min value (numbers)
}

export const GROUP_LABELS: Record<SettingGroup, { title: string; description: string }> = {
  brand: { title: 'الهوية والشعار', description: 'اسم المنصة والشعار والألوان' },
  hero: { title: 'الواجهة الرئيسية', description: 'نصوص الصفحة الرئيسية وشريط الإعلان' },
  contact: { title: 'التواصل', description: 'بيانات الدعم التي تظهر للعملاء' },
  social: { title: 'التواصل الاجتماعي', description: 'روابط حساباتك (تظهر في التذييل وفي بيانات SEO)' },
  seo: { title: 'محركات البحث (SEO)', description: 'العنوان والوصف وصورة المشاركة وفهرسة الموقع' },
  pwa: { title: 'تطبيق الهاتف (PWA)', description: 'اسم التطبيق وألوانه وأيقوناته عند التثبيت' },
  store: { title: 'المتجر والتسليم', description: 'العملة وحدود التحميل ووضع الصيانة والدخول' },
  notifications: { title: 'الإشعارات', description: 'أي الأحداث ترسل إشعارات للإدارة والعملاء' },
};

const f = (
  key: string, type: SettingType, group: SettingGroup, label: string,
  def: string | number | boolean, extra: Partial<SettingField> = {}
): SettingField => ({ key, type, group, label, default: def, ...extra });

export const SETTINGS_SCHEMA: readonly SettingField[] = [
  // ---- brand
  f('store_name', 'string', 'brand', 'اسم المنصة', 'ZARNIX-Group', { max: 80 }),
  f('store_tagline', 'string', 'brand', 'الشعار النصي', 'منصة البرمجيات والأنظمة الرقمية', { max: 120 }),
  f('logo_url', 'image', 'brand', 'الشعار (Logo)', '/logo.png', { help: 'يُفضّل PNG مربع بخلفية شفافة (512×512 فأكثر)' }),
  f('favicon_url', 'image', 'brand', 'أيقونة المتصفح (Favicon)', '/icons/favicon-64.png'),
  f('accent_color', 'color', 'brand', 'اللون الرئيسي', '#10b981'),
  // ---- hero
  f('hero_title', 'string', 'hero', 'عنوان الواجهة الرئيسية', 'منصة المنتجات الرقمية والأنظمة الجاهزة', { max: 140 }),
  f('hero_subtitle', 'text', 'hero', 'وصف الواجهة الرئيسية', 'برمجيات وأنظمة جاهزة بدفع مصرفي بالدينار الليبي وتسليم آمن وإدارة تراخيص.', { max: 400 }),
  f('announcement_enabled', 'boolean', 'hero', 'تفعيل شريط الإعلان العلوي', false),
  f('announcement_text', 'string', 'hero', 'نص شريط الإعلان', '', { max: 200 }),
  f('announcement_link', 'url', 'hero', 'رابط شريط الإعلان (اختياري)', ''),
  // ---- contact
  f('support_email', 'email', 'contact', 'بريد الدعم', 'support@zarnix-group.ly'),
  f('support_phone', 'string', 'contact', 'هاتف الدعم', '0913004448', { max: 40 }),
  f('whatsapp_number', 'string', 'contact', 'واتساب (بصيغة دولية بدون +)', '', { max: 20 }),
  f('telegram_username', 'string', 'contact', 'معرّف تيليجرام', '', { max: 60 }),
  f('address', 'string', 'contact', 'العنوان', 'طرابلس، ليبيا', { max: 200 }),
  f('working_hours', 'string', 'contact', 'ساعات العمل', '', { max: 120 }),
  // ---- social
  f('facebook_url', 'url', 'social', 'فيسبوك', ''),
  f('instagram_url', 'url', 'social', 'إنستغرام', ''),
  f('x_url', 'url', 'social', 'X (تويتر)', ''),
  f('youtube_url', 'url', 'social', 'يوتيوب', ''),
  f('linkedin_url', 'url', 'social', 'لينكدإن', ''),
  f('tiktok_url', 'url', 'social', 'تيك توك', ''),
  // ---- seo
  f('seo_title', 'string', 'seo', 'عنوان الصفحة الرئيسية (Title)', 'ZARNIX-Group | منصة بيع المنتجات الرقمية والبرمجيات', { max: 70, help: 'الأفضل أقل من 60 حرفاً' }),
  f('seo_title_suffix', 'string', 'seo', 'لاحقة عناوين الصفحات', ' | ZARNIX-Group', { max: 40, help: 'تُضاف لعناوين المنتجات والصفحات' }),
  f('seo_description', 'text', 'seo', 'الوصف (Meta Description)', 'منصة ZARNIX-Group لبيع المنتجات الرقمية والبرمجيات والأنظمة الجاهزة مع الدفع المصرفي بالدينار الليبي والتسليم الآمن وإدارة التراخيص.', { max: 320, help: 'الأفضل بين 120 و160 حرفاً' }),
  f('seo_keywords', 'string', 'seo', 'الكلمات المفتاحية', 'برمجيات, أنظمة جاهزة, منتجات رقمية, ليبيا', { max: 300 }),
  f('seo_og_image', 'image', 'seo', 'صورة المشاركة (1200×630)', '/og-default.png', { help: 'تظهر عند مشاركة الرابط في واتساب وفيسبوك وX' }),
  f('seo_twitter_handle', 'string', 'seo', 'حساب X للموقع (@name)', '', { max: 30 }),
  f('seo_allow_indexing', 'boolean', 'seo', 'السماح لمحركات البحث بفهرسة الموقع', true, { help: 'عند الإيقاف يُضاف noindex ويُمنع الزحف' }),
  f('seo_google_verification', 'string', 'seo', 'رمز التحقق من Google Search Console', '', { max: 120 }),
  f('seo_bing_verification', 'string', 'seo', 'رمز التحقق من Bing', '', { max: 120 }),
  f('analytics_ga_id', 'string', 'seo', 'معرّف Google Analytics (G-XXXX)', '', { max: 20 }),
  f('canonical_domain', 'url', 'seo', 'النطاق الرسمي (https://example.com)', '', { help: 'يُستخدم في الروابط القانونية وخريطة الموقع' }),
  // ---- pwa
  f('pwa_name', 'string', 'pwa', 'اسم التطبيق الكامل', 'ZARNIX-Group', { max: 45 }),
  f('pwa_short_name', 'string', 'pwa', 'الاسم المختصر (تحت الأيقونة)', 'ZARNIX', { max: 12 }),
  f('pwa_theme_color', 'color', 'pwa', 'لون شريط التطبيق', '#06090f'),
  f('pwa_background_color', 'color', 'pwa', 'لون شاشة البدء', '#06090f'),
  f('pwa_icon_192', 'image', 'pwa', 'أيقونة 192', '/icons/icon-192.png'),
  f('pwa_icon_512', 'image', 'pwa', 'أيقونة 512', '/icons/icon-512.png'),
  f('pwa_icon_maskable', 'image', 'pwa', 'أيقونة قابلة للقص (Maskable 512)', '/icons/icon-maskable-512.png'),
  // ---- store
  f('currency', 'string', 'store', 'رمز العملة', 'د.ل', { max: 10 }),
  f('default_download_limit', 'number', 'store', 'عدد محاولات التحميل الافتراضي', 3, { min: 1, max: 100 }),
  f('default_download_expiry_days', 'number', 'store', 'مدة صلاحية رخصة التحميل (أيام، 0 = بلا انتهاء)', 0, { min: 0, max: 3650 }),
  f('bank_transfer_note', 'text', 'store', 'ملاحظة تظهر عند الدفع بالتحويل', '', { max: 600 }),
  f('payment_review_eta', 'string', 'store', 'مدة مراجعة الدفع التي تظهر للعميل', 'عادةً خلال ساعات العمل', { max: 120, help: 'مثال: خلال ساعتين في أوقات العمل (9 ص – 5 م)' }),
  f('require_login_to_browse', 'boolean', 'store', 'اشتراط تسجيل الدخول لتصفح المتجر', true, { help: 'عند الإيقاف يصبح المتجر عاماً ويمكن لمحركات البحث فهرسة المنتجات' }),
  f('maintenance_mode', 'boolean', 'store', 'وضع الصيانة', false, { help: 'يعرض صفحة صيانة للعملاء ويبقى الدخول مفتوحاً للإدارة' }),
  f('maintenance_message', 'text', 'store', 'رسالة الصيانة', 'المنصة تحت الصيانة حالياً، سنعود قريباً.', { max: 300 }),
  // ---- notifications
  f('notify_staff_new_order', 'boolean', 'notifications', 'إشعار الإدارة عند طلب جديد', true),
  f('notify_staff_payment_submitted', 'boolean', 'notifications', 'إشعار المراجعين عند وصول إثبات دفع', true),
  f('notify_customer_payment_result', 'boolean', 'notifications', 'إشعار العميل عند اعتماد/رفض الدفع', true),
  f('notify_customer_order_status', 'boolean', 'notifications', 'إشعار العميل عند تغيّر حالة الطلب', true),
  f('notify_customer_service_update', 'boolean', 'notifications', 'إشعار العميل عند تحديث مهمة الخدمة', true),
];

export const SETTING_KEYS: readonly string[] = SETTINGS_SCHEMA.map((s) => s.key);
const BY_KEY = new Map(SETTINGS_SCHEMA.map((s) => [s.key, s]));
export const getField = (key: string): SettingField | undefined => BY_KEY.get(key);

export type SiteConfig = Record<string, string | number | boolean>;

export function defaultSettings(): SiteConfig {
  return Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));
}

/** Stored values over defaults; stored values with the wrong type fall back to the default. */
export function mergeSettings(stored: Record<string, unknown>): SiteConfig {
  const out = defaultSettings();
  for (const field of SETTINGS_SCHEMA) {
    const v = stored[field.key];
    if (v === undefined || v === null) continue;
    const checked = coerce(field, v);
    if (checked.ok) out[field.key] = checked.value as string | number | boolean;
  }
  return out;
}

/** Plain object (not a boolean-discriminated union) so it narrows with strictNullChecks off too. */
interface Coerced { ok: boolean; value?: string | number | boolean; error?: string }

const SAFE_URL = /^(https?:\/\/[^\s<>"']+|\/[^\s<>"']*)$/i;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const COLOR = /^#[0-9a-f]{6}$/i;

export function coerce(field: SettingField, raw: unknown): Coerced {
  const bad = (error: string): Coerced => ({ ok: false, error: `${field.label}: ${error}` });
  switch (field.type) {
    case 'boolean':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : bad('قيمة منطقية مطلوبة');
    case 'number': {
      const n = Number(raw);
      if (raw === '' || raw === null || !Number.isFinite(n)) return bad('رقم مطلوب');
      if (field.min !== undefined && n < field.min) return bad(`الحد الأدنى ${field.min}`);
      if (field.max !== undefined && n > field.max) return bad(`الحد الأقصى ${field.max}`);
      return { ok: true, value: Math.round(n) };
    }
    case 'color':
      return typeof raw === 'string' && COLOR.test(raw.trim()) ? { ok: true, value: raw.trim().toLowerCase() } : bad('لون بصيغة #RRGGBB');
    case 'url':
    case 'image': {
      if (typeof raw !== 'string') return bad('نص مطلوب');
      const v = raw.trim();
      if (v === '') return { ok: true, value: '' };
      if (v.length > 2000) return bad('الرابط طويل جداً');
      if (field.type === 'image' && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v)) return bad('ارفع الصورة كملف بدل تضمينها');
      return SAFE_URL.test(v) ? { ok: true, value: v } : bad('رابط غير صالح (http/https أو مسار يبدأ بـ /)');
    }
    case 'email': {
      if (typeof raw !== 'string') return bad('نص مطلوب');
      const v = raw.trim();
      return v === '' || (EMAIL.test(v) && v.length <= 254) ? { ok: true, value: v } : bad('بريد إلكتروني غير صالح');
    }
    case 'text':
    case 'string': {
      if (typeof raw !== 'string') return bad('نص مطلوب');
      const v = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
      const max = field.max ?? (field.type === 'text' ? 5000 : 200);
      if (v.length > max) return bad(`الحد الأقصى ${max} حرفاً`);
      return { ok: true, value: field.type === 'string' ? v.trim() : v.trim() };
    }
  }
}

export interface SettingsValidation { ok: boolean; values: SiteConfig; errors: string[] }

/** Validate a partial update. Unknown keys are rejected (no arbitrary writes). */
export function validateSettingsUpdate(input: Record<string, unknown>): SettingsValidation {
  const values: SiteConfig = {};
  const errors: string[] = [];
  for (const [key, raw] of Object.entries(input ?? {})) {
    const field = BY_KEY.get(key);
    if (!field) { errors.push(`إعداد غير معروف: ${key}`); continue; }
    const res = coerce(field, raw);
    if (res.ok) values[key] = res.value as string | number | boolean; else errors.push(res.error as string);
  }
  return { ok: errors.length === 0, values, errors };
}

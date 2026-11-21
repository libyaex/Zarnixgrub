/** Notification catalogue shared by the API (rules) and the UI (labels, icons, preferences). */
export type NotificationPriority = 'low' | 'normal' | 'high';
export type NotificationAudience = 'staff' | 'customer';

export interface NotificationTypeMeta {
  label: string;
  audience: NotificationAudience;
  priority: NotificationPriority;
  /** lucide icon name used by the UI */
  icon: string;
  color: string;
  /** Title used when several unread notifications of this type are merged. */
  collapsedTitle: (n: number) => string;
}

const plural = (n: number, one: string, many: string) => (n === 2 ? one : `${n} ${many}`);

export const NOTIFICATION_TYPES = {
  order_new: { label: 'طلب جديد', audience: 'staff', priority: 'normal', icon: 'ShoppingBag', color: '#38bdf8', collapsedTitle: (n) => plural(n, 'طلبان جديدان', 'طلبات جديدة') },
  payment_submitted: { label: 'إثبات دفع بانتظار المراجعة', audience: 'staff', priority: 'high', icon: 'Banknote', color: '#f59e0b', collapsedTitle: (n) => `${n} إثباتات دفع بانتظار المراجعة` },
  coupon_exhausted: { label: 'استنفاد كوبون', audience: 'staff', priority: 'low', icon: 'Tag', color: '#a78bfa', collapsedTitle: (n) => `${n} كوبونات استُنفدت` },
  payment_approved: { label: 'اعتماد الدفع', audience: 'customer', priority: 'high', icon: 'CheckCircle2', color: '#10b981', collapsedTitle: (n) => `${n} دفعات معتمدة` },
  payment_rejected: { label: 'رفض إثبات الدفع', audience: 'customer', priority: 'high', icon: 'XCircle', color: '#f43f5e', collapsedTitle: (n) => `${n} إثباتات دفع مرفوضة` },
  order_status: { label: 'تحديث حالة الطلب', audience: 'customer', priority: 'normal', icon: 'Package', color: '#38bdf8', collapsedTitle: (n) => `${n} تحديثات على طلباتك` },
  service_update: { label: 'تحديث مهمة الخدمة', audience: 'customer', priority: 'normal', icon: 'Wrench', color: '#22d3ee', collapsedTitle: (n) => `${n} تحديثات على خدماتك` },
  download_extended: { label: 'تمديد محاولات التحميل', audience: 'customer', priority: 'normal', icon: 'Download', color: '#10b981', collapsedTitle: (n) => `${n} تمديدات لمحاولات التحميل` },
  role_changed: { label: 'تغيير الصلاحيات', audience: 'staff', priority: 'high', icon: 'ShieldCheck', color: '#a78bfa', collapsedTitle: (n) => `${n} تغييرات في صلاحياتك` },
  broadcast: { label: 'إعلان من الإدارة', audience: 'customer', priority: 'normal', icon: 'Megaphone', color: '#fb7185', collapsedTitle: (n) => `${n} إعلانات جديدة` },
  system: { label: 'إشعار النظام', audience: 'customer', priority: 'low', icon: 'Bell', color: '#94a3b8', collapsedTitle: (n) => `${n} إشعارات` },
} as const satisfies Record<string, NotificationTypeMeta>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;
export const NOTIFICATION_TYPE_KEYS = Object.keys(NOTIFICATION_TYPES) as NotificationType[];

export const isNotificationType = (v: unknown): v is NotificationType =>
  typeof v === 'string' && v in NOTIFICATION_TYPES;

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  group_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  in_app: boolean;
  push: boolean;
  muted_types: NotificationType[];
  /** Local hour (0-23) when push silence starts/ends; null = off. */
  quiet_start: number | null;
  quiet_end: number | null;
  /** Minutes east of UTC for the user's device (Libya = 120). */
  tz_offset_minutes: number;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  in_app: true, push: true, muted_types: [], quiet_start: null, quiet_end: null, tz_offset_minutes: 120,
};

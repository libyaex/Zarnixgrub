/**
 * Business events -> notifications. Each function checks the owner's switches
 * (Settings -> Notifications), builds the Arabic copy and a deep link, and
 * NEVER throws (a notification failure must not break checkout or approval).
 */
import { notifyStaff, notifyUsers } from './notify.ts';
import { loadSiteConfig } from './siteConfig.ts';

const ORDER_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار', processing: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي',
};
const TASK_STATUS_AR: Record<string, string> = {
  not_started: 'لم تبدأ', in_progress: 'قيد التنفيذ', waiting_customer_info: 'بانتظار بياناتك', completed: 'مكتملة', cancelled: 'ملغاة',
};

const money = (n: number | string, cur: unknown) => `${Number(n).toLocaleString('en-US')} ${cur}`;

async function safely(fn: () => Promise<unknown>): Promise<void> {
  try { await fn(); } catch (e) { console.error('[events] failed:', e); }
}

export const orderCreated = (order: { id: string; order_number: string; total_amount: number | string }, customerName: string, byUserId: string) =>
  safely(async () => {
    const cfg = await loadSiteConfig();
    if (!cfg.notify_staff_new_order) return;
    await notifyStaff('manage_orders', {
      type: 'order_new', title: 'طلب جديد',
      body: `${order.order_number} • ${money(order.total_amount, cfg.currency)} • ${customerName}`,
      link: '/admin?tab=orders', groupKey: 'order_new', data: { order_id: order.id },
    }, { skipUserId: byUserId });
  });

export const paymentSubmitted = (order: { id: string; order_number: string; total_amount: number | string }, customerName: string, byUserId: string) =>
  safely(async () => {
    const cfg = await loadSiteConfig();
    if (!cfg.notify_staff_payment_submitted) return;
    await notifyStaff('approve_payments', {
      type: 'payment_submitted', title: 'إثبات دفع بانتظار المراجعة',
      body: `${order.order_number} • ${money(order.total_amount, cfg.currency)} • ${customerName}`,
      link: '/admin?tab=payments', groupKey: 'payment_submitted', data: { order_id: order.id },
    }, { skipUserId: byUserId });
  });

export const paymentApproved = (userId: string, order: { id: string; order_number: string }, hasFiles: boolean) =>
  safely(async () => {
    const cfg = await loadSiteConfig();
    if (!cfg.notify_customer_payment_result) return;
    await notifyUsers([userId], {
      type: 'payment_approved', title: 'تم اعتماد دفعتك ✅',
      body: hasFiles ? `طلبك ${order.order_number} جاهز، يمكنك تحميل ملفاتك الآن.` : `تم اعتماد طلبك ${order.order_number} وجارٍ تجهيزه.`,
      link: hasFiles ? '/portal/downloads' : '/portal/orders', data: { order_id: order.id },
    });
  });

export const paymentRejected = (userId: string, order: { id: string; order_number: string }, reason: string) =>
  safely(async () => {
    const cfg = await loadSiteConfig();
    if (!cfg.notify_customer_payment_result) return;
    await notifyUsers([userId], {
      type: 'payment_rejected', title: 'تعذّر اعتماد إثبات الدفع',
      body: `${order.order_number}: ${reason}. يمكنك إرسال إثبات جديد.`,
      link: `/pay/${order.id}`, data: { order_id: order.id },
    });
  });

export const orderStatusChanged = (userId: string, order: { id: string; order_number: string }, status: string) =>
  safely(async () => {
    const cfg = await loadSiteConfig();
    if (!cfg.notify_customer_order_status) return;
    await notifyUsers([userId], {
      type: 'order_status', title: 'تحديث على طلبك',
      body: `${order.order_number}: ${ORDER_STATUS_AR[status] ?? status}`,
      link: '/portal/orders', groupKey: `order_status:${order.id}`, data: { order_id: order.id, status },
    });
  });

export const serviceUpdated = (userId: string | null, serviceName: string, status: string) =>
  safely(async () => {
    const cfg = await loadSiteConfig();
    if (!userId || !cfg.notify_customer_service_update) return;
    await notifyUsers([userId], {
      type: 'service_update', title: 'تحديث على خدمتك',
      body: `${serviceName}: ${TASK_STATUS_AR[status] ?? status}`, link: '/portal/services', data: { status },
    });
  });

export const downloadExtended = (userId: string, productName: string, extra: number) =>
  safely(() => notifyUsers([userId], {
    type: 'download_extended', title: 'تم تمديد محاولات التحميل',
    body: `أضفنا ${extra} محاولات لتحميل «${productName}».`, link: '/portal/downloads',
  }));

export const couponExhausted = (code: string) =>
  safely(() => notifyStaff('manage_coupons', {
    type: 'coupon_exhausted', title: 'استُنفد كوبون', body: `الكود ${code} وصل للحد الأقصى من الاستخدام.`,
    link: '/admin?tab=coupons', groupKey: 'coupon_exhausted',
  }));

export const roleChanged = (userId: string, roleLabel: string, byUserId: string) =>
  safely(() => notifyUsers([userId], {
    type: 'role_changed', title: 'تم تحديث صلاحياتك', body: `دورك الآن: ${roleLabel}. أعد فتح لوحة التحكم لتحديث القوائم.`,
    link: '/admin',
  }, { skipUserId: byUserId }));

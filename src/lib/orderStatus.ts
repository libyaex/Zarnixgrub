/**
 * One place that decides what the customer is told about an order. Both the
 * "order placed" page and the account page use it, so the wording can never
 * disagree — and it never claims the payment is "under review" before the
 * receipt was actually uploaded (the confusing bug).
 */
export type OrderStage = 'awaiting_proof' | 'verifying' | 'approved' | 'delivered' | 'rejected' | 'cancelled' | 'refunded';
export type StepState = 'done' | 'current' | 'todo' | 'attention';
export type Tone = 'amber' | 'sky' | 'emerald' | 'rose' | 'slate';

export interface OrderLike {
  payment_status: string;
  order_status?: string;
  payment_submission?: { rejection_reason?: string | null } | null;
}

export interface Progress {
  stage: OrderStage;
  tone: Tone;
  /** Short badge text. */
  badge: string;
  headline: string;
  message: string;
  steps: Array<{ key: string; label: string; state: StepState }>;
  /** What the customer should do next (null when nothing is needed from them). */
  action: 'upload_proof' | 'reupload_proof' | 'open_downloads' | null;
  /** True while we (not the customer) are working. */
  waitingOnUs: boolean;
}

const STEP_LABELS = ['تم إنشاء الطلب', 'تحويل المبلغ وإرفاق الإيصال', 'التحقق من الدفع', 'تسليم الملفات والخدمات'];

const mk = (states: StepState[]) => STEP_LABELS.map((label, i) => ({ key: `s${i + 1}`, label, state: states[i] }));

export function describeOrder(order: OrderLike, reviewEta = 'عادةً خلال ساعات العمل'): Progress {
  const pay = order.payment_status;
  const ord = order.order_status;

  if (ord === 'cancelled' || pay === 'refunded') {
    const refunded = pay === 'refunded';
    return {
      stage: refunded ? 'refunded' : 'cancelled', tone: 'slate', badge: refunded ? 'تم الاسترداد' : 'ملغي',
      headline: refunded ? 'تم استرداد قيمة هذا الطلب' : 'تم إلغاء هذا الطلب',
      message: refunded ? 'أُغلق الطلب وأُعيد المبلغ، وأُوقفت روابط التحميل المرتبطة به.' : 'لن تُحصَّل أي مبالغ على هذا الطلب. يمكنك إنشاء طلب جديد في أي وقت.',
      steps: mk(['done', 'todo', 'todo', 'todo']), action: null, waitingOnUs: false,
    };
  }

  if (pay === 'paid') {
    const delivered = ord === 'completed';
    return {
      stage: delivered ? 'delivered' : 'approved', tone: 'emerald', badge: delivered ? 'مكتمل' : 'تم اعتماد الدفع',
      headline: delivered ? 'اكتمل طلبك' : 'تم اعتماد الدفع — ملفاتك جاهزة',
      message: delivered ? 'تم تسليم طلبك. يمكنك العودة لملفاتك في أي وقت من «حسابي».' : 'تأكدنا من وصول المبلغ. حمّل ملفاتك الآن من «حسابي ← التحميلات»، وسنتابع معك أي خدمة تركيب مطلوبة.',
      steps: mk(['done', 'done', 'done', delivered ? 'done' : 'current']), action: 'open_downloads', waitingOnUs: !delivered,
    };
  }

  if (pay === 'submitted' || pay === 'under_review') {
    return {
      stage: 'verifying', tone: 'sky', badge: 'جارٍ التحقق من الدفع',
      headline: 'استلمنا إثبات التحويل — جارٍ التحقق من الدفع',
      message: `يطابق فريقنا إيصالك مع كشف الحساب. ${reviewEta}. ستصلك إشعار فور اعتماد الدفع، ولا حاجة لأي إجراء الآن.`,
      steps: mk(['done', 'done', 'current', 'todo']), action: null, waitingOnUs: true,
    };
  }

  if (pay === 'rejected') {
    const reason = order.payment_submission?.rejection_reason;
    return {
      stage: 'rejected', tone: 'rose', badge: 'يلزم إعادة الإرسال',
      headline: 'تعذّر اعتماد إثبات الدفع',
      message: `${reason ? `السبب: ${reason}. ` : ''}لا تقلق، لم يُلغَ طلبك. أرسل إثباتاً صحيحاً وسنراجعه فوراً.`,
      steps: mk(['done', 'attention', 'todo', 'todo']), action: 'reupload_proof', waitingOnUs: false,
    };
  }

  // 'unsubmitted' (and anything unknown): the customer still has to pay and upload the receipt.
  return {
    stage: 'awaiting_proof', tone: 'amber', badge: 'بانتظار إثبات التحويل',
    headline: 'تم إنشاء طلبك — بقيت خطوة واحدة',
    message: 'لم يبدأ التحقق بعد لأننا لم نستلم إثبات التحويل. حوّل المبلغ ثم أرفق صورة الإيصال ليبدأ فريقنا المراجعة.',
    steps: mk(['done', 'current', 'todo', 'todo']), action: 'upload_proof', waitingOnUs: false,
  };
}

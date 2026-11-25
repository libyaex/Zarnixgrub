import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, ShieldAlert, FileText } from 'lucide-react';
import { Order } from '../types';
import { apiJson, ApiError } from '../lib/api';
import { useSite } from '../context/SiteContext';
import { OrderStatusTracker } from '../components/OrderStatusTracker';
import { PaymentFlow } from '../components/PaymentFlow';
import { describeOrder } from '../lib/orderStatus';

interface Props {
  orderId: string;
  onGoToPortal: () => void;
  onBrowseProducts: () => void;
}

/**
 * /pay/<orderId> — the single page after the cart: what you ordered, where the
 * order stands, and (while payment is still needed) choose-method -> transfer
 * -> upload-receipt. Loaded by id, so refreshing or opening it from a
 * notification keeps working.
 */
export const PaymentPage: React.FC<Props> = ({ orderId, onGoToPortal, onBrowseProducts }) => {
  const site = useSite();
  const currency = String(site.currency || 'د.ل');
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const flowRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (silent = false) => {
    try {
      setOrder(await apiJson<Order>(`/api/orders/${encodeURIComponent(orderId)}`));
      setState('ready');
    } catch (e) {
      if (!silent) setState(e instanceof ApiError && (e.status === 404 || e.status === 400) ? 'missing' : 'error');
    }
  }, [orderId]);

  useEffect(() => { setState('loading'); void load(); }, [load]);

  // While we are verifying, pick up the approval without the customer refreshing.
  const verifying = order && ['submitted', 'under_review'].includes(order.payment_status);
  useEffect(() => {
    if (!verifying) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 30_000);
    return () => window.clearInterval(t);
  }, [verifying, load]);

  if (state === 'loading') return <div className="min-h-[50vh] flex items-center justify-center text-emerald-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (state !== 'ready' || !order) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <p className="text-5xl mb-4">🧾</p>
        <h1 className="text-xl font-bold text-white mb-2">{state === 'missing' ? 'لم نجد هذا الطلب' : 'تعذر تحميل الطلب'}</h1>
        <p className="text-sm text-slate-400 mb-6">{state === 'missing' ? 'قد يكون الرابط خاطئاً أو أن الطلب يخص حساباً آخر.' : 'تحقق من اتصالك وأعد المحاولة.'}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => void load()} className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm cursor-pointer">إعادة المحاولة</button>
          <button onClick={onGoToPortal} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm cursor-pointer">طلباتي</button>
        </div>
      </div>
    );
  }

  const progress = describeOrder(order);
  const needsPayment = progress.stage === 'awaiting_proof' || progress.stage === 'rejected';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-6">
      <button onClick={onGoToPortal} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"><ArrowRight className="w-4 h-4" /> طلباتي</button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">{needsPayment ? 'إتمام الدفع' : 'متابعة طلبك'}</h1>
          <p className="text-xs text-slate-400 mt-1">رقم الطلب <span className="font-mono text-emerald-400">{order.order_number}</span></p>
        </div>
        <div className="text-left">
          <span className="block text-[11px] text-slate-400">المبلغ المطلوب</span>
          <span className="text-2xl font-black text-white tabular-nums">{Number(order.total_amount).toLocaleString('en-US')} <span className="text-xs font-normal text-slate-400">{currency}</span></span>
        </div>
      </div>

      <OrderStatusTracker
        order={order}
        onAction={(action) => (action === 'open_downloads' ? onGoToPortal() : flowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
      />

      {/* What was ordered */}
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-400" /> ملخص الطلب</h2>
        {(order.items ?? []).map((item) => (
          <div key={item.id} className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5">
            <div className="flex justify-between gap-3 text-sm font-bold text-white">
              <span>{item.product_name_snapshot}</span>
              <span className="font-mono tabular-nums shrink-0">{Number(item.total_price).toLocaleString('en-US')} {currency}</span>
            </div>
            {(item.selected_options_snapshot ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {item.selected_options_snapshot.map((o) => (
                  <li key={o.option_id} className="flex justify-between gap-3"><span>· {o.name}</span><span className="font-mono tabular-nums">{Number(o.price).toLocaleString('en-US')} {currency}</span></li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {Number(order.discount_amount) > 0 && (
          <div className="flex justify-between text-xs text-emerald-300"><span>خصم{order.coupon_code ? ` (${order.coupon_code})` : ''}</span><span className="font-mono">-{Number(order.discount_amount).toLocaleString('en-US')} {currency}</span></div>
        )}
      </section>

      {/* Pay: only while a payment is still needed */}
      {needsPayment && (
        <section ref={flowRef} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 scroll-mt-20">
          <PaymentFlow order={order} onSubmitted={(updated) => { setOrder(updated); window.scrollTo({ top: 0, behavior: 'smooth' }); void load(true); }} />
        </section>
      )}

      <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-4 flex gap-3 text-xs text-slate-300 leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
        <p>لا تُفعَّل روابط التنزيل بمجرد رفع الإيصال؛ يُعتمد الدفع بعد مطابقة الحساب المصرفي من الإدارة. لن تُحصَّل أي مبالغ إضافية.</p>
      </div>

      <div className="text-center"><button onClick={onBrowseProducts} className="text-xs text-slate-400 hover:text-emerald-400 cursor-pointer">تصفح المزيد من المشاريع</button></div>
    </div>
  );
};

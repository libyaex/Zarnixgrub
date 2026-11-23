import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, ShieldAlert, FileText } from 'lucide-react';
import { BankTransferModal } from '../components/BankTransferModal';
import { OrderStatusTracker } from '../components/OrderStatusTracker';
import { useSite } from '../context/SiteContext';
import { Order } from '../types';

interface OrderSuccessPageProps {
  order: Order;
  onGoToPortal: () => void;
  onContinueShopping: () => void;
}

export const OrderSuccessPage: React.FC<OrderSuccessPageProps> = ({
  order: initialOrder,
  onGoToPortal,
  onContinueShopping
}) => {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [modalOpen, setModalOpen] = useState(false);

  const site = useSite();
  const currency = String(site.currency || 'د.ل');

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12 space-y-6">

      {/* Placed confirmation (neutral: the payment status is explained by the tracker below) */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">تم إنشاء طلبك بنجاح</h1>
        <p className="text-xs sm:text-sm text-slate-400">شكراً لثقتك في {String(site.store_name)}. احتفظ برقم طلبك للمتابعة.</p>
      </div>

      {/* What is happening with the order and what to do next */}
      <OrderStatusTracker
        order={order}
        onAction={(action) => (action === 'open_downloads' ? onGoToPortal() : setModalOpen(true))}
      />

      {/* Order Info Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-7 space-y-6 shadow-xl">

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 text-xs sm:text-sm">
          <div>
            <span className="text-slate-400 block text-xs">رقم الطلب</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">{order.order_number}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">المبلغ الإجمالي</span>
            <span className="text-xl font-extrabold text-white tabular-nums">
              {order.total_amount.toLocaleString('en-US')} <span className="text-xs font-normal text-slate-400">{currency}</span>
            </span>
          </div>
        </div>

        {/* Ordered items list */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-400 block">العناصر والخدمات المحجوزة:</span>
          <div className="space-y-2">
            {(order.items || []).map((item) => (
              <div key={item.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-white">
                  <span>{item.product_name_snapshot}</span>
                  <span className="font-mono">{item.total_price.toLocaleString('en-US')} {currency}</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-400">
                  {item.selected_options_snapshot.map(opt => (
                    <div key={opt.option_id} className="flex justify-between">
                      <span>· {opt.name}</span>
                      <span className="font-mono">{opt.price.toLocaleString('en-US')} {currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strict Locked Policy Callout (Section 8 & 10) */}
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs sm:text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1 leading-relaxed">
            <strong className="block text-amber-200">تنبيه أمني هام بشأن تسليم الملفات:</strong>
            <p>
              لا تُفتح روابط التنزيل بمجرد رفع الإيصال؛ يُعتمد الدفع بعد مطابقة الحساب المصرفي. يتم اعتماد الدفع بعد مطابقة الحساب المصرفي من قبل المشرف المخول لضمان نزاهة التعاملات وأمن البرمجيات.
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            onClick={onContinueShopping}
            className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            تصفح المزيد من المشاريع
          </button>

          <button
            onClick={onGoToPortal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>الانتقال لمركز التحميل ومتابعة الطلب في حسابي</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Bank Proof Upload Modal */}
      <BankTransferModal
        order={order}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={(updated) => {
          setOrder(updated);
          setModalOpen(false);
        }}
      />

    </div>
  );
};

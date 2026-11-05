import React, { useState } from 'react';
import { CheckCircle2, Clock, Upload, ArrowLeft, ShieldAlert, FileText, Check } from 'lucide-react';
import { BankTransferModal } from '../components/BankTransferModal';
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

  const isSubmitted = order.payment_status === 'submitted' || order.payment_status === 'under_review';
  const isPaid = order.payment_status === 'paid';

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      
      {/* Success Banner */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950/40">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          تم استلام طلبك بنجاح، وهو الآن قيد مراجعة الدفع
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
          شكراً لثقتك في ZARNIX-Group. تم تسجيل طلبك برقم فريد، وسيتم تفعيل صلاحيات التحميل وجدولة الخدمات فور تأكيد وصول الحوالة المصرفية.
        </p>
      </div>

      {/* Order Info Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 text-xs sm:text-sm">
          <div>
            <span className="text-slate-400 block text-xs">رقم الطلب</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">{order.order_number}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">حالة الدفع الحالية</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold ${
              isPaid
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                : isSubmitted
                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                : 'bg-slate-800 text-slate-300'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isPaid
                  ? 'تم تأكيد الدفع (مدفوع)'
                  : isSubmitted
                  ? 'إثبات التحويل قيد المراجعة'
                  : 'بانتظار إرفاق إثبات التحويل'}
              </span>
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">المبلغ الإجمالي</span>
            <span className="text-xl font-extrabold text-white tabular-nums">
              {order.total_amount.toLocaleString('ar-LY')} <span className="text-xs font-normal text-slate-400">دينار ليبي</span>
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
                  <span className="font-mono">{item.total_price.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-400">
                  {item.selected_options_snapshot.map(opt => (
                    <div key={opt.option_id} className="flex justify-between">
                      <span>· {opt.name}</span>
                      <span className="font-mono">{opt.price.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button: Upload proof or Status */}
        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-right">
            <span className="text-xs font-bold text-white block">إثبات التحويل المصرفي</span>
            <p className="text-[11px] text-slate-400">
              {isSubmitted 
                ? 'تم استلام الإيصال ورقم العملية، وجارٍ التحقق من كشف الحساب المصرفي.'
                : 'يرجى إرفاق صورة إيصال التحويل ورقم المرجع للبدء في المراجعة فوراً.'}
            </p>
          </div>

          {!isPaid && (
            <button
              onClick={() => setModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm transition-all shadow-xl shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              <span>{isSubmitted ? 'تحديث أو إعادة رفع الإيصال' : 'إرفاق إثبات الحوالة الآن'}</span>
            </button>
          )}
        </div>

        {/* Strict Locked Policy Callout (Section 8 & 10) */}
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs sm:text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1 leading-relaxed">
            <strong className="block text-amber-200">تنبيه أمني هام بشأن تسليم الملفات:</strong>
            <p>
              لا تفتح روابط التنزيل الرقمية بمجرد رفع الإيصال، ولا تعتبر صورة الإيصال دليلاً نهائياً. يتم اعتماد الدفع بعد مطابقة الحساب المصرفي من قبل المشرف المخول لضمان نزاهة التعاملات وأمن البرمجيات.
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

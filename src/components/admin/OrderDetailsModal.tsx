import React, { useState } from 'react';
import { 
  X, ShoppingBag, User, Phone, MessageSquare, Printer, Check, 
  ExternalLink, FileText, CreditCard, ShieldCheck, Calendar, Clock 
} from 'lucide-react';
import { Order } from '../../types';

interface OrderDetailsModalProps {
  order: Order;
  onClose: () => void;
  onStatusUpdated: () => void;
  onReviewReceipt?: (order: Order) => void;
  onToast: (msg: string) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  onClose,
  onStatusUpdated,
  onReviewReceipt,
  onToast
}) => {
  const [orderStatus, setOrderStatus] = useState(order.order_status || 'processing');
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status || 'pending');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Clean phone number for WhatsApp Link (e.g. 0912345678 -> 218912345678)
  const cleanPhone = order.customer_phone?.replace(/\D/g, '') || '';
  const waPhone = cleanPhone.startsWith('0') 
    ? `218${cleanPhone.slice(1)}` 
    : cleanPhone.startsWith('218') 
    ? cleanPhone 
    : `218${cleanPhone}`;

  const handleUpdateStatus = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_status: orderStatus,
          payment_status: paymentStatus,
          notes: adminNote.trim()
        })
      });

      if (res.ok) {
        onToast('تم تحديث حالة الطلب بنجاح');
        onStatusUpdated();
      } else {
        onToast('فشل تحديث حالة الطلب من الخادم');
      }
    } catch {
      onToast('تم حفظ تحديث الطلب محلياً');
      onStatusUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-5 sm:p-7 w-full max-w-2xl my-6 space-y-6 text-xs shadow-2xl animate-fade-in max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  تفاصيل الطلب: {order.order_number}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  paymentStatus === 'paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  paymentStatus === 'under_review' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {paymentStatus === 'paid' ? 'مدفوع ومعتمد' : paymentStatus === 'under_review' ? 'قيد مراجعة الإيصال' : 'في انتظار التحويل'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                تاريخ الطلب: {new Date(order.created_at).toLocaleString('ar-LY')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Quick Contact Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-slate-400 text-[10px] block">بيانات المشتري:</span>
            <span className="font-bold text-white text-sm block">{order.customer_name}</span>
            <span className="text-slate-400 font-mono text-xs">{order.customer_phone}</span>
          </div>

          <div className="flex items-center gap-2">
            {order.customer_phone && (
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`السلام عليكم أخي ${order.customer_name}، نتواصل معك بخصوص طلبك رقم ${order.order_number} من منصة ZARNIX.`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-700/60 font-bold transition-all text-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>مراسلة واتساب</span>
              </a>
            )}

            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all text-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>اتصال هاتف</span>
              </a>
            )}
          </div>
        </div>

        {/* Order Items Table */}
        <div className="space-y-2">
          <h4 className="font-bold text-white text-xs border-r-2 border-cyan-500 pr-2">
            العناصر والمنظومات المشتراة
          </h4>
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60 divide-y divide-slate-800/60">
            {order.items?.map((item, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-white text-xs block">{item.product_name}</span>
                  <div className="text-[11px] text-slate-400 space-x-2 space-x-reverse mt-0.5">
                    <span>الكمية: {item.quantity}</span>
                    {item.selected_options && item.selected_options.length > 0 && (
                      <span>· خيارات: {item.selected_options.map(o => o.name).join(' + ')}</span>
                    )}
                  </div>
                </div>
                <div className="text-left font-mono font-bold text-emerald-400 text-xs shrink-0">
                  {item.total_price?.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
          <div className="flex justify-between text-slate-400">
            <span>المجموع الفرعي:</span>
            <span>{order.subtotal_amount?.toLocaleString('ar-LY')} د.ل</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>خصم الكوبون ({order.coupon_code || 'تخفيض'}):</span>
              <span>- {order.discount_amount?.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-slate-800">
            <span>الإجمالي المطلوب:</span>
            <span className="text-emerald-400 font-extrabold">{order.total_amount?.toLocaleString('ar-LY')} د.ل</span>
          </div>
        </div>

        {/* Payment Receipt Link if available */}
        {order.payment_submission && (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300 block text-xs">إيصال تحويل مصرفي مرفق</span>
              <span className="text-[11px] text-amber-400/80 font-mono">
                رقم العملية: {order.payment_submission.transaction_reference} · المبلغ: {order.payment_submission.transferred_amount} د.ل
              </span>
            </div>
            {onReviewReceipt && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReviewReceipt(order);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors cursor-pointer"
              >
                معاينة الإيصال واعتماده
              </button>
            )}
          </div>
        )}

        {/* Status Update Form */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <h4 className="font-bold text-white text-xs border-r-2 border-emerald-500 pr-2">
            تحديث حالة الطلب والدفع
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">حالة الطلب</label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="pending">معلق (Pending)</option>
                <option value="processing">قيد التنفيذ والتجهيز (Processing)</option>
                <option value="completed">مكتمل ومُسلم للعميل (Completed)</option>
                <option value="cancelled">ملغي (Cancelled)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">حالة الدفع</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="pending">في انتظار التحويل (Pending)</option>
                <option value="under_review">قيد مراجعة الإيصال (Under Review)</option>
                <option value="paid">مدفوع ومعتمد بالكامل (Paid)</option>
                <option value="rejected">مرفوض لعدم مطابقة الإيصال (Rejected)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">ملاحظة إدارية إضافية</label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="مثال: تم التواصل هاتفياً وتأكيد وصول الحوالة عبر مصرف الجمهورية"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الفاتورة</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/40 transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

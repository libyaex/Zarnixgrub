import React from 'react';
import { X, User, Phone, Mail, ShoppingBag, Download, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Order, DownloadEntitlement } from '../../types';

interface CustomerDetailsModalProps {
  customer: any;
  orders: Order[];
  entitlements: DownloadEntitlement[];
  onClose: () => void;
  onViewOrder: (order: Order) => void;
  onToast: (msg: string) => void;
}

export const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({
  customer,
  orders,
  entitlements,
  onClose,
  onViewOrder,
  onToast
}) => {
  const customerOrders = orders.filter(
    o => o.user_id === customer.id || o.customer_email === customer.email || o.customer_phone === customer.phone
  );

  const customerEntitlements = entitlements.filter(
    e => e.user_id === customer.id || customerOrders.some(o => o.id === e.order_id)
  );

  const cleanPhone = customer.phone?.replace(/\D/g, '') || '';
  const waPhone = cleanPhone.startsWith('0') 
    ? `218${cleanPhone.slice(1)}` 
    : cleanPhone.startsWith('218') 
    ? cleanPhone 
    : `218${cleanPhone}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-5 sm:p-7 w-full max-w-2xl my-6 space-y-6 text-xs shadow-2xl animate-fade-in max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-black text-lg border border-emerald-500/40 shrink-0">
              {customer.full_name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {customer.full_name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  عميل موثق
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {customer.email}
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

        {/* Customer Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[11px] text-slate-400 block mb-1">إجمالي الإنفاق</span>
            <span className="font-mono font-black text-emerald-400 text-sm sm:text-base">
              {(customer.total_spent_lyd || 0).toLocaleString('ar-LY')} د.ل
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[11px] text-slate-400 block mb-1">عدد الطلبات</span>
            <span className="font-mono font-black text-white text-sm sm:text-base">
              {customerOrders.length || customer.total_orders_count || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[11px] text-slate-400 block mb-1">التراخيص النشطة</span>
            <span className="font-mono font-black text-cyan-400 text-sm sm:text-base">
              {customerEntitlements.length || customer.active_entitlements_count || 0}
            </span>
          </div>
        </div>

        {/* Quick Contact Bar */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-slate-400 text-[10px] block">رقم الهاتف:</span>
            <span className="font-mono text-white font-bold">{customer.phone || 'غير مسجل'}</span>
          </div>

          <div className="flex items-center gap-2">
            {customer.phone && (
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`السلام عليكم أخي ${customer.full_name}، نتواصل معك من فريق منصة ZARNIX.`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-700/60 font-bold transition-all text-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </a>
            )}

            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all text-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>اتصال</span>
              </a>
            )}

            <button
              onClick={() => {
                navigator.clipboard.writeText(customer.email || '');
                onToast('تم نسخ البريد الإلكتروني');
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="نسخ البريد"
            >
              <Mail className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Customer Orders History */}
        <div className="space-y-2">
          <h4 className="font-bold text-white text-xs border-r-2 border-emerald-500 pr-2">
            سجل طلبات الشراء ({customerOrders.length})
          </h4>
          {customerOrders.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/80 text-center text-slate-400">
              لا توجد طلبات سابقة مسجلة لهذا العميل.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 divide-y divide-slate-800/60">
              {customerOrders.map(o => (
                <div key={o.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono font-bold text-white block">{o.order_number}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(o.created_at).toLocaleDateString('ar-LY')} · {o.items?.length || 1} منتجات
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-400 text-xs">
                      {o.total_amount?.toLocaleString('ar-LY')} د.ل
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        onViewOrder(o);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      معاينة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Active Entitlements */}
        <div className="space-y-2">
          <h4 className="font-bold text-white text-xs border-r-2 border-cyan-500 pr-2">
            التراخيص وحزم التحميل المفعلة ({customerEntitlements.length})
          </h4>
          {customerEntitlements.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center text-slate-400">
              لا توجد ملفات تحميل نشطة حالياً.
            </div>
          ) : (
            <div className="space-y-1.5">
              {customerEntitlements.map(ent => (
                <div key={ent.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block text-xs">{ent.product_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{ent.file_name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">
                    {ent.used_downloads} / {ent.allowed_downloads} تنزيلات
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

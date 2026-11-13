import React, { useState, useEffect } from 'react';
import { ArrowRight, Building2, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { PaymentAccount, Order, CartItem } from '../types';
import { apiFetch, apiJson, errorMessage } from '../lib/api';

interface CheckoutPageProps {
  directItem?: CartItem | null;
  onOrderCreated: (order: Order) => void;
  onBackToCart: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  directItem,
  onOrderCreated,
  onBackToCart
}) => {
  const { items: cartItems, subtotal: cartSubtotal, discountAmount: cartDiscount, couponCode, clearCart } = useCart();
  const { user } = useAuth();

  // If direct checkout was initiated, use that single item; otherwise cart items
  const activeItems = directItem ? [directItem] : cartItems;
  const activeSubtotal = directItem ? directItem.total_price : cartSubtotal;
  const activeDiscount = directItem ? 0 : cartDiscount;
  const activeTotal = Math.max(0, activeSubtotal - activeDiscount);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<PaymentAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');

  // Customer info
  const [customerName, setCustomerName] = useState(user?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '0912345678');
  const [customerNotes, setCustomerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/banks')
      .then(res => (res.ok ? res.json() : []))
      .then((data: PaymentAccount[]) => {
        const list = Array.isArray(data) ? data : [];
        setBankAccounts(list);
        if (list.length > 0) {
          const def = list.find(a => a.is_default) || list[0];
          setSelectedBankId(def.id);
        }
      })
      .catch(() => setBankAccounts([]));
  }, []);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMessage('يرجى إدخال اسمك ورقم الهاتف للتواصل ومطابقة الحوالة');
      return;
    }

    if (activeItems.length === 0) {
      setErrorMessage('لا توجد عناصر لإتمام الطلب');
      return;
    }

    setSubmitting(true);
    try {
      // The server re-prices everything from the database; we only send ids.
      const orderData = await apiJson<Order>('/api/orders', {
        method: 'POST',
        body: {
          items: activeItems.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            option_ids: item.selected_options.map(o => o.option_id)
          })),
          coupon_code: directItem ? null : couponCode,
          customer_notes: customerNotes
        }
      });

      if (!directItem) clearCart();
      onOrderCreated(orderData);
    } catch (err: any) {
      setErrorMessage(errorMessage(err, 'حدث خطأ أثناء إنشاء الطلب'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Back button */}
      <div>
        <button
          onClick={onBackToCart}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة ومراجعة السلة</span>
        </button>
      </div>

      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-extrabold text-white">إتمام الطلب والتحويل المصرفي</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          سجل بيانات الاتصال واختر الحساب المصرفي لتحويل القيمة بالدينار الليبي
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Customer & Bank Account selection */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Customer info card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
              بيانات المشتري والتواصل
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  الاسم الكامل / اسم المنشأة *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="الاسم الثلاثي أو اسم المنشأة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  رقم الهاتف للتواصل ومطابقة الحوالة *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0912345678"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-300 block mb-1">
                ملاحظات أو متطلبات خاصة بالطلب (اختياري)
              </label>
              <textarea
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="أي تعليمات إضافية ترغب في توضيحها للمهندسين..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Bank selection card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm sm:text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>اختر الحساب المصرفي للتحويل إليه</span>
              <span className="text-xs text-emerald-400 font-semibold">الدفع بالدينار الليبي (LYD)</span>
            </h3>

            {bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {bankAccounts.map((account) => {
                  const isSelected = selectedBankId === account.id;
                  return (
                    <div
                      key={account.id}
                      onClick={() => setSelectedBankId(account.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                        isSelected
                          ? 'bg-emerald-950/30 border-emerald-500 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="flex-1 space-y-1 text-xs sm:text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{account.bank_name}</span>
                          {account.is_default && (
                            <span className="text-[10px] sm:text-xs text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/50">
                              الحساب الافتراضي
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400">صاحب الحساب: <strong className="text-slate-200">{account.account_holder}</strong></p>
                        <p className="font-mono text-emerald-300 font-semibold">رقم الحساب: {account.account_number}</p>
                        {account.instructions && (
                          <p className="text-[11px] sm:text-xs text-slate-500 italic pt-1">{account.instructions}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs space-y-1.5">
                <p className="font-bold">تنبيه الحسابات المصرفية:</p>
                <p className="text-slate-300">لم يتم إدراج حسابات مصرفية بعد في لوحة التحكم. يمكنك كمسؤول إضافة حساباتك المصرفية الرسمية عبر الرابط <strong>/admin</strong> وسيتم تفعيلها فوراً لجميع العملاء.</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Order summary & Place Order CTA */}
        <div className="lg:col-span-5 space-y-4 sticky top-24">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-xl">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              ملخص عناصر الطلب
            </h3>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {activeItems.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span className="truncate max-w-[220px]">{item.product.name}</span>
                    <span className="font-mono tabular-nums text-slate-200 whitespace-nowrap">
                      {item.total_price.toLocaleString('ar-LY')} د.ل
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                    {item.selected_options.map((opt) => (
                      <div key={opt.option_id} className="flex justify-between">
                        <span>· {opt.name}</span>
                        <span className="font-mono">{opt.price.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>المجموع الفرعي:</span>
                <span className="font-mono tabular-nums">{activeSubtotal.toLocaleString('ar-LY')} د.ل</span>
              </div>

              {activeDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono tabular-nums">- {activeDiscount.toLocaleString('ar-LY')} د.ل</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-sm sm:text-base font-bold text-white">المبلغ النهائي المستحق:</span>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                  {activeTotal.toLocaleString('ar-LY')} <span className="text-xs font-normal text-slate-300">د.ل</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all shadow-xl shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'جارٍ تأكيد الطلب...' : 'تأكيد الطلب والانتقال لإرفاق الإيصال'}
            </button>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                لن يتم خصم أو احتساب أي مبالغ حتى تقوم بإرسال إثبات التحويل واعتماده من قبل الإدارة.
              </span>
            </div>

          </div>
        </div>

      </form>

    </div>
  );
};

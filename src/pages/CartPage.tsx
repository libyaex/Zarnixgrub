import React, { useState } from 'react';
import { Trash2, ArrowLeft, ShoppingBag, Tag, ShieldCheck, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Product } from '../types';

interface CartPageProps {
  onCheckout: () => void;
  onBrowseProducts: () => void;
  onViewProduct: (product: Product) => void;
}

export const CartPage: React.FC<CartPageProps> = ({ onCheckout, onBrowseProducts, onViewProduct }) => {
  const { items, removeFromCart, clearCart, subtotal, discountAmount, couponCode, total, applyCoupon, removeCoupon } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ message: string; isError?: boolean } | null>(null);
  const [applying, setApplying] = useState(false);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setApplying(true);
    setCouponFeedback(null);
    const res = await applyCoupon(couponInput.trim());
    setApplying(false);
    setCouponFeedback({ message: res.message, isError: !res.success });
    if (res.success) {
      setCouponInput('');
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">سلة المشتريات فارغة حالياً</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          لم تقم بإضافة أي برمجيات أو خدمات بعد. استكشف كتالوج المشاريع الجاهزة واختر ما يناسبك.
        </p>
        <button
          onClick={onBrowseProducts}
          className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-950/50"
        >
          تصفح المنتجات والمشاريع
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">سلة المشتريات</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            مراجعة المنتجات الرقمية والخدمات المحددة قبل الانتقال للتحويل المصرفي
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
        >
          تفريغ السلة بالكامل
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Cart Items List */}
        <div className="lg:col-span-8 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm"
            >
              {/* Product header line */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={item.product.main_image}
                    alt={item.product.name}
                    className="w-16 h-12 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                  />
                  <div>
                    <h3
                      onClick={() => onViewProduct(item.product)}
                      className="text-sm sm:text-base font-bold text-white hover:text-emerald-400 cursor-pointer transition-colors"
                    >
                      {item.product.name}
                    </h3>
                    <span className="text-[11px] sm:text-xs text-slate-400">
                      التصنيف: {item.product.category_name || 'برمجيات'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="حذف من السلة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Selected Options Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  الخيارات والخدمات المشمولة لهذا المنتج:
                </span>
                <div className="space-y-1.5">
                  {item.selected_options.map((opt) => (
                    <div key={opt.option_id} className="flex items-center justify-between text-xs text-slate-300">
                      <span className="truncate max-w-[340px]">· {opt.name}</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {opt.price.toLocaleString('ar-LY')} د.ل
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Line item total */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">إجمالي هذا العنصر:</span>
                <div className="text-base font-bold text-white tabular-nums">
                  {item.total_price.toLocaleString('ar-LY')} <span className="text-xs font-normal text-slate-400">دينار ليبي</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary & Coupon Card */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Summary Box */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-xl">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              ملخص الحساب
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>مجموع المنتجات والخدمات:</span>
                <span className="font-mono tabular-nums text-white">
                  {subtotal.toLocaleString('ar-LY')} د.ل
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span>خصم الكوبون ({couponCode}):</span>
                    <button
                      onClick={removeCoupon}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      (إلغاء)
                    </button>
                  </div>
                  <span className="font-mono tabular-nums">
                    - {discountAmount.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-white">الإجمالي المستحق:</span>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                  {total.toLocaleString('ar-LY')} <span className="text-xs font-normal text-slate-300">دينار ليبي</span>
                </div>
              </div>
            </div>

            {/* Coupon input */}
            <form onSubmit={handleApplyCoupon} className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                هل لديك كود خصم؟
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="رمز الكوبون (مثلاً ZARNIX10)"
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white uppercase focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={applying}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {applying ? 'تحقق...' : 'تطبيق'}
                </button>
              </div>

              {couponFeedback && (
                <p className={`text-[11px] ${couponFeedback.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {couponFeedback.message}
                </p>
              )}
            </form>

            {/* Checkout Button */}
            <button
              onClick={onCheckout}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm transition-all shadow-xl shadow-emerald-950/50 cursor-pointer"
            >
              <span>متابعة إتمام الطلب والتحويل المصرفي</span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="pt-2 text-[11px] sm:text-xs text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>دفع مصرفي مباشر مع تأكيد إداري وحماية كاملة.</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Order, CartItem } from '../types';
import { apiJson, errorMessage } from '../lib/api';

interface CheckoutPageProps {
  directItem: CartItem | null;
  onOrderCreated: (order: Order) => void;
  onBackToCart: () => void;
}

/**
 * "Checkout" is no longer a form. The cart already holds everything the order
 * needs (items, options, coupon) and the account holds name/phone, so this step
 * just creates the order and hands over to the single payment page (/pay/<id>)
 * where the customer chooses the payment service and uploads the receipt.
 * Previously the customer typed name + phone and picked an account here, then
 * typed the same things again on the payment step.
 */
export const CheckoutPage: React.FC<CheckoutPageProps> = ({ directItem, onOrderCreated, onBackToCart }) => {
  const { items, couponCode, clearCart } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1); // one request per attempt (React dev double-effects must not create two orders)

  const activeItems = directItem ? [directItem] : items;

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    if (activeItems.length === 0) { onBackToCart(); return; }
    setError(null);
    apiJson<Order>('/api/orders', {
      method: 'POST',
      body: {
        items: activeItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          option_ids: item.selected_options.map((o) => o.option_id),
        })),
        coupon_code: directItem ? null : couponCode,
      },
    })
      .then((order) => {
        if (!directItem) clearCart(); // a refresh must not create a second order
        onOrderCreated(order);
      })
      .catch((err) => setError(errorMessage(err, 'حدث خطأ أثناء إنشاء الطلب')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (error) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center space-y-5">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h1 className="text-lg font-bold text-white">تعذر إنشاء الطلب</h1>
        <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{error}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onBackToCart} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm cursor-pointer"><ArrowRight className="w-4 h-4" /> مراجعة السلة</button>
          <button onClick={() => setAttempt((n) => n + 1)} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm cursor-pointer">إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center gap-3 text-center px-6" role="status">
      <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
      <p className="text-base font-bold text-white">جارٍ إنشاء طلبك…</p>
      <p className="text-xs text-slate-400">سننقلك الآن لصفحة الدفع.</p>
    </div>
  );
};

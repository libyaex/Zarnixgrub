import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, SelectedOptionSnapshot, CartItem } from '../types';
import { apiFetch } from '../lib/api';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, selectedOptions: SelectedOptionSnapshot[]) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  total: number;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  directCheckoutItem: CartItem | null;
  setDirectCheckoutItem: (item: CartItem | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('nizar_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [directCheckoutItem, setDirectCheckoutItem] = useState<CartItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('nizar_cart', JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  }, [items]);

  const addToCart = (product: Product, selectedOptions: SelectedOptionSnapshot[]) => {
    // Calculate total price based on selected options or base price
    let optionsTotal = 0;
    if (selectedOptions.length > 0) {
      optionsTotal = selectedOptions.reduce((sum, opt) => sum + opt.price, 0);
    } else {
      optionsTotal = product.base_price;
    }

    const newItem: CartItem = {
      id: `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      product,
      selected_options: selectedOptions,
      base_price: product.base_price,
      options_total: optionsTotal,
      total_price: optionsTotal,
      quantity: 1
    };

    setItems(prev => [newItem, ...prev]);
  };

  const removeFromCart = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
    setCouponCode(null);
    setDiscountAmount(0);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.total_price * item.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!code) return { success: false, message: 'يرجى إدخال رمز الكوبون' };
    try {
      const res = await apiFetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cart_subtotal: subtotal })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'الكوبون غير صالح' };
      }
      setCouponCode(data.code);
      setDiscountAmount(data.discount_amount);
      return { 
        success: true, 
        message: `تم تفعيل الكوبون بنجاح وخصم ${data.discount_amount} دينار ليبي!` 
      };
    } catch {
      return { success: false, message: 'تعذر التحقق من الكوبون' };
    }
  };

  const removeCoupon = () => {
    setCouponCode(null);
    setDiscountAmount(0);
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      clearCart,
      itemCount,
      subtotal,
      discountAmount,
      couponCode,
      total,
      applyCoupon,
      removeCoupon,
      directCheckoutItem,
      setDirectCheckoutItem
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

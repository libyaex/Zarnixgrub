import React from 'react';
import { Home, Package, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onNavigate }) => {
  const { itemCount } = useCart();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b13]/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-2 pb-safe">
      <div className="flex items-center justify-around max-w-md mx-auto">
        
        {/* Home */}
        <button
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer min-w-[56px] ${
            currentView === 'home' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px]">الرئيسية</span>
        </button>

        {/* Products */}
        <button
          onClick={() => onNavigate('products')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer min-w-[56px] ${
            currentView === 'products' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[11px]">المنتجات</span>
        </button>

        {/* Cart */}
        <button
          onClick={() => onNavigate('cart')}
          className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer min-w-[56px] ${
            currentView === 'cart' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -left-2 min-w-[17px] h-[17px] px-1 bg-emerald-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center tabular-nums">
                {itemCount}
              </span>
            )}
          </div>
          <span className="text-[11px]">السلة</span>
        </button>

        {/* Portal / Downloads */}
        <button
          onClick={() => onNavigate('portal')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer min-w-[56px] ${
            currentView === 'portal' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[11px]">حسابي</span>
        </button>

      </div>
    </div>
  );
};

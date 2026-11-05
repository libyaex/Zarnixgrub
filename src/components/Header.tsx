import React, { useState } from 'react';
import { ShoppingBag, User, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

interface HeaderProps {
  currentView: string;
  setCurrentView: (view: string, data?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: string, data?: any) => {
    setCurrentView(view, data);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#06090f]/95 backdrop-blur-md border-b border-slate-800/90 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand Wordmark with Emerald theme */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button 
            onClick={() => handleNavClick('home')} 
            className="text-right group flex items-center gap-2 sm:gap-2.5 cursor-pointer min-w-0"
          >
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-blue-500 to-emerald-400 shadow-lg shadow-cyan-950/50 shrink-0 overflow-hidden flex items-center justify-center">
              <img
                src="/logo.png"
                alt="شعار ZARNIX-Group"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-lg font-black tracking-tight text-white group-hover:text-cyan-400 transition-colors truncate">
                ZARNIX-Group
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 truncate hidden xs:block">
                منصة البرمجيات والأنظمة الرقمية
              </span>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
          <button 
            onClick={() => handleNavClick('home')}
            className={`cursor-pointer transition-colors whitespace-nowrap ${currentView === 'home' ? 'text-emerald-400 font-bold' : 'hover:text-white'}`}
          >
            الرئيسية
          </button>
          <button 
            onClick={() => handleNavClick('products')}
            className={`cursor-pointer transition-colors whitespace-nowrap ${currentView === 'products' ? 'text-emerald-400 font-bold' : 'hover:text-white'}`}
          >
            جميع المنتجات
          </button>
          <button 
            onClick={() => handleNavClick('products', { filter: 'categories' })}
            className="cursor-pointer hover:text-white transition-colors whitespace-nowrap"
          >
            التصنيفات
          </button>
          <button 
            onClick={() => handleNavClick('products', { filter: 'featured' })}
            className="cursor-pointer hover:text-white transition-colors whitespace-nowrap"
          >
            المنتجات المميزة
          </button>
          <button 
            onClick={() => handleNavClick('policies')}
            className="cursor-pointer hover:text-white transition-colors whitespace-nowrap"
          >
            الشروط والتراخيص
          </button>
        </nav>

        {/* Actions & Controls: Clean Customer Controls Only */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Customer Portal (Tablet & Desktop) */}
          <button
            onClick={() => handleNavClick('portal')}
            className={`hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-200 bg-slate-900 border border-slate-700/80 hover:border-slate-600 transition-colors cursor-pointer ${
              currentView === 'portal' ? 'border-emerald-500 text-emerald-400' : ''
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>{user?.full_name?.split(' ')[0] || 'حسابي'}</span>
          </button>

          {/* Shopping Cart Button */}
          <button
            onClick={() => handleNavClick('cart')}
            className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-white hover:border-emerald-500/50 transition-colors cursor-pointer shrink-0"
            aria-label="سلة المشتريات"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-slate-950 text-[10px] sm:text-[11px] font-black rounded-full flex items-center justify-center tabular-nums shadow-sm">
                {itemCount}
              </span>
            )}
          </button>

          {/* Logout (Desktop) */}
          <button
            onClick={() => logout()}
            className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-rose-400 hover:border-rose-900 transition-colors cursor-pointer shrink-0"
            title="تسجيل الخروج والعودة لصفحة Google"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-emerald-500/50 cursor-pointer flex items-center justify-center shrink-0 transition-colors"
            aria-label="القائمة الرئيسية"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>

      </div>

      {/* Mobile Menu Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#090d16] border-b border-slate-800 px-4 py-5 space-y-4 shadow-2xl animate-fade-in max-h-[85vh] overflow-y-auto">
          
          {/* User info banner inside drawer */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <span className="block text-white font-bold text-xs truncate">{user?.full_name}</span>
                <span className="text-slate-400 font-mono text-[11px] truncate block">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/60 text-rose-400 border border-rose-800/50 text-xs font-semibold shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1.5 text-xs sm:text-sm font-semibold">
            <button
              onClick={() => handleNavClick('home')}
              className={`w-full text-right p-3 rounded-xl transition-colors cursor-pointer ${currentView === 'home' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 font-bold' : 'text-slate-200 hover:bg-slate-900'}`}
            >
              الرئيسية
            </button>
            <button
              onClick={() => handleNavClick('products')}
              className={`w-full text-right p-3 rounded-xl transition-colors cursor-pointer ${currentView === 'products' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 font-bold' : 'text-slate-200 hover:bg-slate-900'}`}
            >
              جميع المنتجات والمشاريع
            </button>
            <button
              onClick={() => handleNavClick('products', { filter: 'featured' })}
              className="w-full text-right p-3 rounded-xl text-slate-300 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              المنتجات والأنظمة المميزة
            </button>
            <button
              onClick={() => handleNavClick('portal')}
              className={`w-full text-right p-3 rounded-xl transition-colors cursor-pointer ${currentView === 'portal' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 font-bold' : 'text-slate-200 hover:bg-slate-900'}`}
            >
              حسابي ومركز التحميل الآمن
            </button>
            <button
              onClick={() => handleNavClick('cart')}
              className={`w-full text-right p-3 rounded-xl transition-colors cursor-pointer flex items-center justify-between ${currentView === 'cart' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 font-bold' : 'text-slate-200 hover:bg-slate-900'}`}
            >
              <span>سلة المشتريات</span>
              {itemCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleNavClick('policies')}
              className="w-full text-right p-3 rounded-xl text-slate-300 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              الشروط والتراخيص الرسمية
            </button>
          </div>

        </div>
      )}
    </header>
  );
};

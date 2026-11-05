import React from 'react';
import { ShieldCheck, Mail, Phone, ExternalLink } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string, data?: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#050811] border-t border-slate-800 text-slate-400 text-xs mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Brand & mission */}
          {/* Brand & mission */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-blue-500 to-emerald-400 shadow-md shadow-blue-950/60 shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="شعار ZARNIX-Group"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="text-base font-extrabold text-white tracking-tight">ZARNIX-Group</span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              منصة ZARNIX-Group لبيع المنتجات الرقمية والبرمجيات والأنظمة الجاهزة للاستثمار التجاري، مع الدفع المصرفي بالدينار الليبي والتسليم الآمن.
            </p>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>العملة المعتمدة حصراً: الدينار الليبي (LYD)</span>
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">روابط المتجر</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-emerald-400 transition-colors">
                  الرئيسية
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('products')} className="hover:text-emerald-400 transition-colors">
                  جميع المنتجات والمشاريع
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('products', { filter: 'featured' })} className="hover:text-emerald-400 transition-colors">
                  الأنظمة المميزة
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('cart')} className="hover:text-emerald-400 transition-colors">
                  سلة المشتريات
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Policies */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">الشروط والسياسات</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button onClick={() => onNavigate('policies', { tab: 'terms' })} className="hover:text-emerald-400 transition-colors">
                  شروط الاستخدام والملكية الفكرية
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('policies', { tab: 'digital_goods' })} className="hover:text-emerald-400 transition-colors">
                  سياسة تسليم المنتجات الرقمية
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('policies', { tab: 'refunds' })} className="hover:text-emerald-400 transition-colors">
                  سياسة الاسترجاع والضمان
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('policies', { tab: 'licensing' })} className="hover:text-emerald-400 transition-colors">
                  تراخيص البرمجيات التجارية
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('policies', { tab: 'privacy' })} className="hover:text-emerald-400 transition-colors">
                  سياسة الخصوصية
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">التواصل والعناوين الرسمية</h4>
            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-start gap-2 text-slate-300">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">📍</span>
                <div className="space-y-1">
                  <span className="block font-medium">طرابلس / شارع عمر المختار</span>
                  <span className="block font-medium">طرابلس / برج طرابلس</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href="tel:0913004448" className="font-mono text-emerald-300 hover:underline" dir="ltr">
                  091-3004448
                </a>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href="https://ZARNIX-Group.ly" target="_blank" rel="noopener noreferrer" className="font-mono text-slate-300 hover:text-emerald-400">
                  ZARNIX-Group.ly
                </a>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-slate-300">support@zarnix-group.ly</span>
              </div>
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            جميع الحقوق محفوظة © {new Date().getFullYear()} ZARNIX-Group — منصة المنتجات الرقمية والبرمجيات
          </div>
          <div className="flex items-center gap-4">
            <span>طرابلس، ليبيا</span>
            <span>·</span>
            <span>بوابة مصرفية يدوية آمنة (LYD)</span>
            <span>·</span>
            <span>ZARNIX-Group.ly</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

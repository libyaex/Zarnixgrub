import React from 'react';
import { ShieldCheck, Mail, Phone, ExternalLink, MessageCircle } from 'lucide-react';
import { useSite } from '../context/SiteContext';

interface FooterProps {
  onNavigate: (view: string, data?: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const site = useSite();
  const host = String(site.canonical_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const socials = [
    ['فيسبوك', site.facebook_url], ['إنستغرام', site.instagram_url], ['X', site.x_url],
    ['يوتيوب', site.youtube_url], ['لينكدإن', site.linkedin_url], ['تيك توك', site.tiktok_url],
  ].filter(([, url]) => url) as [string, string][];
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
                  src={String(site.logo_url)}
                  alt={`شعار ${site.store_name}`}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="text-base font-extrabold text-white tracking-tight">{String(site.store_name)}</span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              {String(site.seo_description)}
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
                  <span className="block font-medium">{String(site.address)}</span>
                  {site.working_hours && <span className="block text-slate-500">{String(site.working_hours)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href={`tel:${String(site.support_phone).replace(/[^\d+]/g, '')}`} className="font-mono text-emerald-300 hover:underline" dir="ltr">
                  {String(site.support_phone)}
                </a>
              </div>
              {site.whatsapp_number && (
                <div className="flex items-center gap-2 text-slate-300">
                  <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href={`https://wa.me/${String(site.whatsapp_number).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">واتساب</a>
                </div>
              )}
              {host && (
                <div className="flex items-center gap-2 text-slate-300">
                  <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href={String(site.canonical_domain)} target="_blank" rel="noopener noreferrer" className="font-mono text-slate-300 hover:text-emerald-400">{host}</a>
                </div>
              )}
              {site.support_email && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href={`mailto:${String(site.support_email)}`} className="font-mono text-slate-300 hover:text-emerald-400">{String(site.support_email)}</a>
                </div>
              )}
              {socials.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  {socials.map(([label, url]) => (
                    <a key={label} href={url} target="_blank" rel="noopener noreferrer me" className="text-slate-400 hover:text-emerald-400">{label}</a>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            جميع الحقوق محفوظة © {new Date().getFullYear()} {String(site.store_name)} — {String(site.store_tagline)}
          </div>
          <div className="flex items-center gap-4">
            <span>{String(site.address)}</span>
            <span>·</span>
            <span>بوابة مصرفية يدوية آمنة ({String(site.currency)})</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

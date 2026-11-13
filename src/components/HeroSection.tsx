import React from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, Download, Wrench, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onExplore: () => void;
  onBrowseAll: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExplore, onBrowseAll }) => {
  return (
    <section className="relative pt-6 sm:pt-12 pb-14 sm:pb-20 overflow-hidden">
      {/* Background ambient lighting in rich Emerald & Gold */}
      <div className="absolute top-0 right-1/4 -z-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-10 -z-10 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Split grid: Headline & CTA left, Preview Hero image right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-right">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-3.5 py-1.5 rounded-xl shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>منصة موثوقة لبيع البرمجيات والأنظمة الجاهزة للاستثمار</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.25] tracking-tight">
              حلول رقمية جاهزة لتحويل أفكارك إلى مشاريع حقيقية
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              اكتشف مجموعة من التطبيقات والأنظمة والبوتات والبرمجيات الرقمية، واختر الحل المناسب لمشروعك مع خيارات مرنة للشراء والتركيب والتخصيص.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <button
                onClick={onExplore}
                className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-emerald-500/20 cursor-pointer active:scale-98"
              >
                <span>اكتشف المنتجات</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                onClick={onBrowseAll}
                className="flex items-center justify-center px-7 py-3.5 rounded-2xl bg-slate-900 border border-slate-700/90 text-slate-200 font-bold text-sm sm:text-base hover:bg-slate-800 hover:text-white transition-all cursor-pointer active:scale-98"
              >
                تصفح جميع المشاريع
              </button>
            </div>

            {/* Credibility bullet points */}
            <div className="pt-3 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تحويل مصرفي ليبي معتمد (LYD)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>كود مصدري كامل قابل للتخصيص</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تسليم آمن عبر بوابة خاصة</span>
              </div>
            </div>
          </div>

          {/* Right Visual Frame */}
          <div className="lg:col-span-5 relative w-full">
            <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl shadow-black/80 group">
              <img
                src="/src/assets/images/nizar_hero_marketplace_1793738527373.jpg"
                alt="لوحة برمجيات وأنظمة ZARNIX-Group"
                className="w-full h-auto object-cover transform group-hover:scale-102 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06090f] via-transparent to-transparent opacity-60" />
              
              <div className="absolute bottom-4 right-4 left-4 p-3.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800/90 flex items-center justify-between text-xs sm:text-sm">
                <div>
                  <p className="font-bold text-white">الكود المصدري + دليل التشغيل</p>
                  <p className="text-slate-400 text-xs">مشاريع برمجية جاهزة للتشغيل الفوري</p>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-950/90 text-emerald-400 font-mono text-xs font-bold border border-emerald-800/60">
                  تسليم فوري
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 4-Item Feature Strip */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/30 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mb-1.5">دفع مصرفي مباشر (LYD)</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              تحويل مصرفي ليبي واضح إلى حسابات المتجر مع مراجعة إدارية وتأكيد فوري للطلب.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/30 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mb-1.5">تسليم آمن للملفات</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              بوابة تنزيل مشفرة بروابط أحادية الاستخدام تحمي الملكية الفكرية وتمنع التسريب.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/30 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mb-1.5">تركيب وتخصيص ودعم</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              باقات مرنة تتيح طلب تثبيت النظام على خادمك وتعديل الهوية ودعم فني متخصص.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/30 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mb-1.5">جدوى اقتصادية واضحة</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              دراسة تقديرية لفرص الاستثمار وتكاليف التشغيل ونقطة التعادل لكل منتج.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};

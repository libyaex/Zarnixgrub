import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Layers, Sparkles, Building2, ShieldCheck, Zap } from 'lucide-react';
import { HeroSection } from '../components/HeroSection';
import { ProductCard } from '../components/ProductCard';
import { Product, Category } from '../types';

interface HomePageProps {
  onNavigate: (view: string, data?: any) => void;
  onViewProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onViewProduct, onQuickAdd }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(res => res.json()).catch(() => []),
      fetch('/api/categories').then(res => res.json()).catch(() => [])
    ])
      .then(([prods, cats]) => {
        const localProdsRaw = localStorage.getItem('zarnix_custom_products');
        const localProds: Product[] = localProdsRaw ? JSON.parse(localProdsRaw) : [];
        const serverList = Array.isArray(prods) ? prods : [];
        const combined = [...localProds];
        serverList.forEach(sp => {
          if (!combined.some(cp => cp.id === sp.id)) {
            combined.push(sp);
          }
        });
        setProducts(combined);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const featuredProducts = products.filter(p => p.is_featured);
  const latestProducts = products.slice(0, 4);

  const faqItems = [
    {
      q: 'كيف يتم تسليم الملفات الرقمية بعد الشراء؟',
      a: 'بعد إتمام الطلب وتحويل المبلغ لحساب المتجر المصرفي وإرفاق إثبات التحويل، يقوم فريق المراجعة بتأكيد وصول الدفعة. فور التأكيد، تفتح لك بوابة التنزيل الآمنة مباشرة داخل مركز التحميل في حسابك بروابط مشفرة وأحادية الاستخدام.'
    },
    {
      q: 'هل العملة الوحيدة للدفع هي الدينار الليبي (LYD)؟',
      a: 'نعم، عملة المتجر الوحيدة والمعتمدة في جميع الأسعار والحسابات هي الدينار الليبي، ويتم الدفع عبر تحويل مصرفي مباشر إلى حساباتنا الرسمية في المصارف الليبية (مثل مصرف الأمان، مصرف الجمهورية، والمصرف التجاري الوطني).'
    },
    {
      q: 'هل يمكنني طلب خدمة التركيب أو التخصيص دون الكود المصدري؟',
      a: 'ملفات المشروع والكود المصدري هي المكون الأساسي للترخيص، بينما خدمات التركيب على خادمك أو التخصيص هي خدمات تقنية اختيارية إضافية ينفذها مهندسونا بعد شراء ملفات النظام.'
    },
    {
      q: 'ماذا لو واجهتني مشكلة أثناء تثبيت النظام وتشغيله؟',
      a: 'تتضمن كل حزمة دليلاً مفصلاً خطوة بخطوة للتشغيل. كما يمكنك طلب باقة الدعم الفني أو التركيب وسيتولى فريقنا الفني إعداد كل شيء نيابة عنك والتأكد من عمل النظام بكفاءة تامة.'
    }
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      
      {/* 1. Hero Section */}
      <HeroSection
        onExplore={() => onNavigate('products')}
        onBrowseAll={() => onNavigate('products')}
      />

      {/* 2. Categories Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <div className="flex items-end justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs sm:text-sm font-bold text-emerald-400 block mb-1">الكتالوج المتخصص</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">تصنيفات الحلول البرمجية</h2>
          </div>
          <button
            onClick={() => onNavigate('products')}
            className="text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
          >
            <span>عرض الكل</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onNavigate('products', { category: cat.id })}
              className="group p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/50 hover:bg-slate-900 transition-all cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                  <Layers className="w-5 h-5" />
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {cat.description || 'حلول وأنظمة تقنية جاهزة للتنفيذ'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
          <div className="flex items-end justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-400 mb-1">
                <Sparkles className="w-4 h-4" />
                <span>مشاريع جاهزة للاستثمار المباشر</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">المنتجات والأنظمة المميزة</h2>
            </div>
            <button
              onClick={() => onNavigate('products', { filter: 'featured' })}
              className="text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span>جميع المميزة</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onViewDetails={onViewProduct}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. Bank Transfer Callout Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40 p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2.5 text-right max-w-xl">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
              دفع مصرفي محلي آمن
            </span>
            <h3 className="text-xl sm:text-3xl font-extrabold text-white">
              نظام تحويل مصرفي مباشر بالدينار الليبي
            </h3>
            <p className="text-xs sm:text-base text-slate-300 leading-relaxed">
              لا حاجة لبطاقات دولية أو بوابات خارجية. حوّل قيمة طلبك مباشرة إلى حساباتنا في مصرف الأمان أو مصرف الجمهورية وارفع إيصالك للمراجعة والتأكيد الفوري.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full md:w-auto">
            <div className="text-right sm:text-left bg-slate-950/90 p-4 rounded-2xl border border-slate-800 text-xs w-full sm:w-auto">
              <span className="text-slate-400 block text-xs">العملة الرسمية</span>
              <span className="text-base sm:text-lg font-bold text-white">دينار ليبي (LYD)</span>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-xl shadow-emerald-500/20 cursor-pointer text-center"
            >
              تصفح المنتجات الآن
            </button>
          </div>
        </div>
      </section>

      {/* 5. Latest Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <div className="flex items-end justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs sm:text-sm font-bold text-emerald-400 block mb-1">جديد المنصة</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">أحدث المشاريع والأنظمة المضافة</h2>
          </div>
          <button
            onClick={() => onNavigate('products')}
            className="text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
          >
            <span>عرض جميع المشاريع</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {latestProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {latestProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onViewDetails={onViewProduct}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-3">
            <p className="text-base text-slate-300 font-bold">لا توجد منتجات منشورة حالياً في المتجر</p>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              سيتم إتاحة المنتجات والأنظمة الرقمية للشراء والتنزيل المباشر فور نشرها من قبل إدارة المنصة.
            </p>
          </div>
        )}
      </section>

      {/* 6. Why ZARNIX-Group? */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-wider">
            المعايير الهندسية
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
            لماذا تختار ZARNIX-Group لمشروعك البرمجي؟
          </h2>
          <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
            نقدم حلولاً رقمية مكتملة البناء والتجربة تم اختبارها في بيئات إنتاجية حقيقية لضمان استثمار آمن ومربح.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">منتجات تقنية متخصصة ومصقولة</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              من نقاط البيع والمطاعم إلى بوتات التداول وتطبيقات الويب التقدمية، بنيت على أحدث التقنيات البرمجية.
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">تفاصيل كاملة قبل اتخاذ القرار</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              نوفر لكل منتج دراسة جدوى اقتصادية، متطلبات التشغيل، ودليل التثبيت لتتأكد من ملاءمته لمشروعك.
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">تسليم آمن ودعم وتنفيذ حقيقي</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              تنزيل محمي عبر خوادمنا المشفرة، مع إمكانية تكليف مهندسينا بتنصيب النظام وتخصيص التقارير ومتابعة الدعم.
            </p>
          </div>
        </div>
      </section>

      {/* 7. FAQ Accordion */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-wider">
            مركز المعرفة
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">الأسئلة الشائعة</h2>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-right p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-850"
                >
                  <span className="text-sm sm:text-base font-bold text-white">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3.5">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};

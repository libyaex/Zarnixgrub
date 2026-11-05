import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Cpu, Terminal, HelpCircle, Layers, FileCode, Check } from 'lucide-react';
import { PricingCalculator } from '../components/PricingCalculator';
import { FeasibilityStudySection } from '../components/FeasibilityStudySection';
import { ProductCard } from '../components/ProductCard';
import { Product, SelectedOptionSnapshot } from '../types';

interface ProductDetailsPageProps {
  product: Product;
  allProducts: Product[];
  onBack: () => void;
  onAddToCart: (product: Product, options: SelectedOptionSnapshot[]) => void;
  onDirectBuy: (product: Product, options: SelectedOptionSnapshot[]) => void;
  onViewProduct: (product: Product) => void;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({
  product,
  allProducts,
  onBack,
  onAddToCart,
  onDirectBuy,
  onViewProduct
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'installation' | 'economic'>('overview');
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>(product.main_image || '/logo.png');

  const allImages = [product.main_image, ...(product.gallery_images || [])].filter(Boolean);

  const relatedProducts = allProducts
    .filter(p => p.id !== product.id && (p.category_id === product.category_id || p.product_type === product.product_type))
    .slice(0, 3);

  const handleAdd = (options: SelectedOptionSnapshot[]) => {
    onAddToCart(product, options);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  const handleBuy = (options: SelectedOptionSnapshot[]) => {
    onDirectBuy(product, options);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لجميع المنتجات والمشاريع</span>
        </button>
      </div>

      {/* Added to cart toast */}
      {addedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>تمت إضافة المنتج بالخيارات المحددة إلى سلة مشترياتك بنجاح!</span>
          </div>
          <span className="font-semibold underline cursor-pointer">عرض السلة</span>
        </div>
      )}

      {/* Main PDP Grid: Left Gallery/Content, Right Sticky Purchase Configurator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* Left Column: Product Info, Media, Details & Accordions */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Header & Badges */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-400 font-medium">
              <span className="bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/40 text-emerald-300 font-semibold">{product.category_name || 'برمجيات'}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">الترخيص: تجاري دائم</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-emerald-400 font-semibold">متاح للتسليم الفوري</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight">
              {product.name}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {product.short_description}
            </p>
          </div>

          {/* Main Visual Image Showcase */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl aspect-[16/10]">
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover transition-all duration-300"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 right-4 left-4 p-3 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-300">الكود المصدري + ملفات التثبيت مشمولة</span>
                <span className="font-mono text-emerald-400 font-bold">100% كود أصلي</span>
              </div>
            </div>

            {/* Gallery Thumbnails Strip */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentImage(img)}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      currentImage === img 
                        ? 'border-emerald-500 scale-105 shadow-md shadow-emerald-950/50' 
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              شرح النظام ومميزاته
            </button>
            <button
              onClick={() => setActiveTab('technical')}
              className={`pb-2.5 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'technical'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              المتطلبات التقنية
            </button>
            <button
              onClick={() => setActiveTab('installation')}
              className={`pb-2.5 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'installation'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              طريقة التثبيت والتشغيل
            </button>
            <button
              onClick={() => setActiveTab('economic')}
              className={`pb-2.5 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'economic'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              دراسة الجدوى الاقتصادية
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 text-xs sm:text-sm text-slate-300">
              
              {/* ما هو هذا المنتج؟ */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>ما هو هذا المنتج؟</span>
                </h3>
                <p className="leading-relaxed text-slate-300">
                  {product.full_description}
                </p>
              </div>

              {/* ما المشكلة التي يحلها؟ وكيف يعمل؟ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <h4 className="text-sm font-bold text-white">ما المشكلة التي يحلها؟</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يعالج التكاليف العالية للاشتراكات الشهرية المتكررة في المنصات الأجنبية، ويوفر حلاً محلياً مخصصاً يملكه المشتري بالكامل، مع الاستقرار التشغيلي وتجاوز قيود الاتصال والعملات الأجنبية.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <h4 className="text-sm font-bold text-white">كيف يعمل النظام؟</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يعتمد النظام على بنية برمجية تفاعلية سريعة تتصل بقواعد البيانات المحلية أو السحابية، مع واجهات سهلة الاستخدام ولوحة تحكم مركزية لإدارة كل الوظائف التشغيلية والتقارير.
                  </p>
                </div>
              </div>

              {/* Features List */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h3 className="text-base font-bold text-white">المميزات والوظائف الفعلية</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {product.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-white">الجمهور المستهدف والمستفيدون:</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {product.economic_study?.potential_buyers || 'الشركات، أصحاب المشاريع، المطورون، والمستثمرون الراغبون في إطلاق منصات رقمية جاهزة بسرعة وبأقل تكلفة تشغيلية.'}
                </p>
              </div>

            </div>
          )}

          {/* Tab 2: Technical Requirements */}
          {activeTab === 'technical' && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>المتطلبات التقنية وبيئة التشغيل</span>
              </h3>
              <p className="text-xs text-slate-400">
                تم اعتماد هذه المتطلبات لضمان عمل النظام بأعلى كفاءة واستقرار:
              </p>

              <div className="space-y-3 pt-2">
                {product.technical_requirements.map((req, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400">{req.label}:</span>
                    <span className="font-mono text-white text-right">{req.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Installation Guide */}
          {activeTab === 'installation' && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>دليل التثبيت والتشغيل الأولي</span>
              </h3>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {product.installation_guide || 'تتضمن حزمة التنزيل دليلاً تفصيلياً مع أوامر التشغيل وتهيئة قواعد البيانات.'}
              </div>
              <p className="text-xs text-slate-400">
                ملاحظة: إذا كنت لا ترغب في إعداد الخادم بنفسك، يمكنك ببساطة اختيار خدمة "التركيب والإعداد على خادم العميل" من قائمة الباقات المجاورة.
              </p>
            </div>
          )}

          {/* Tab 4: Economic Feasibility Study */}
          {activeTab === 'economic' && (
            <FeasibilityStudySection study={product.economic_study} />
          )}

          {/* FAQ specific to product */}
          {product.faq && product.faq.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>الأسئلة الشائعة حول هذا المنتج</span>
              </h3>
              <div className="space-y-3 text-xs">
                {product.faq.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <p className="font-bold text-white">{item.question}</p>
                    <p className="text-slate-400 leading-relaxed">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Sticky Flexible Pricing Calculator & Purchase Module (Section 5) */}
        <div id="pricing-section" className="lg:col-span-5 lg:sticky lg:top-24 scroll-mt-20">
          <PricingCalculator
            product={product}
            onAddToCart={handleAdd}
            onDirectBuy={handleBuy}
          />
        </div>

      </div>

      {/* Mobile Floating Action Button (Only visible on small screens to easily jump to pricing) */}
      <div className="lg:hidden fixed bottom-18 left-4 right-4 z-30">
        <button
          onClick={() => {
            const el = document.getElementById('pricing-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 flex items-center justify-between border border-emerald-400/30 cursor-pointer"
        >
          <span>تخصيص الخيارات والشراء الآن</span>
          <span className="font-mono text-emerald-100 tabular-nums">{product.base_price.toLocaleString('ar-LY')} د.ل</span>
        </button>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="pt-12 border-t border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">منتجات ومشاريع مشابهة قد تهمك</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedProducts.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onViewDetails={onViewProduct}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

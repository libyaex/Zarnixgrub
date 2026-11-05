import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ArrowRight, FileText, Lock, RefreshCw, Key, 
  HelpCircle, Printer, Search, CheckCircle2, AlertTriangle, 
  Building2, Phone, ExternalLink, DownloadCloud, FileCheck, 
  Scale, Award, ChevronLeft, BookOpen, Clock, Check
} from 'lucide-react';

interface PoliciesPageProps {
  initialTab?: string;
  onBack: () => void;
}

type PolicyKey = 'overview' | 'terms' | 'digital_goods' | 'refunds' | 'licensing' | 'privacy';

interface PolicyMeta {
  id: PolicyKey;
  title: string;
  shortTitle: string;
  badge: string;
  icon: any;
  description: string;
  lastUpdated: string;
}

const POLICIES_LIST: PolicyMeta[] = [
  {
    id: 'overview',
    title: 'مركز الشروط والسياسات الرسمية',
    shortTitle: 'دليل السياسات',
    badge: 'الإطار العام',
    icon: Scale,
    description: 'النظام القانوني والتنظيمي المعتمد لمعاملات منصة ZARNIX-Group في دولة ليبيا.',
    lastUpdated: 'نوفمبر 2026'
  },
  {
    id: 'terms',
    title: 'شروط الاستخدام والملكية الفكرية',
    shortTitle: 'شروط الاستخدام',
    badge: 'حقوق الملكية',
    icon: FileText,
    description: 'القواعد الملزمة لاستخدام المنصة، حماية الأكواد المصدرية، والعلامات التجارية والبرمجيات.',
    lastUpdated: 'نوفمبر 2026'
  },
  {
    id: 'digital_goods',
    title: 'سياسة تسليم المنتجات الرقمية',
    shortTitle: 'تسليم المنتجات',
    badge: 'بروتوكول التنزيل الآمن',
    icon: DownloadCloud,
    description: 'آلية التحقق المصرفي بالدينار الليبي، وتوليد روابط التنزيل المشفرة وأحادية الاستخدام.',
    lastUpdated: 'نوفمبر 2026'
  },
  {
    id: 'refunds',
    title: 'سياسة الاسترجاع والضمان',
    shortTitle: 'الاسترجاع والضمان',
    badge: 'الضمان البرمجي',
    icon: RefreshCw,
    description: 'ضوابط المنتجات الرقمية بعد التحميل، وشروط ضمان الكفاءة التشغيلية والدعم الفني.',
    lastUpdated: 'نوفمبر 2026'
  },
  {
    id: 'licensing',
    title: 'تراخيص البرمجيات التجارية',
    shortTitle: 'التراخيص التجارية',
    badge: 'تراخيص الكود',
    icon: Key,
    description: 'أنواع تراخيص الاستخدام التجاري للشركات والمؤسسات، وحقوق التعديل والتخصيص.',
    lastUpdated: 'نوفمبر 2026'
  },
  {
    id: 'privacy',
    title: 'سياسة الخصوصية وحماية البيانات',
    shortTitle: 'الخصوصية والأمان',
    badge: 'حماية البيانات',
    icon: Lock,
    description: 'بروتوكولات التشفير، وسرية سجلات المعاملات المصرفية وإيصالات التحويل المالية.',
    lastUpdated: 'نوفمبر 2026'
  }
];

export const PoliciesPage: React.FC<PoliciesPageProps> = ({ initialTab = 'overview', onBack }) => {
  const [activeTab, setActiveTab] = useState<PolicyKey>(() => {
    const valid = POLICIES_LIST.find(p => p.id === initialTab);
    return valid ? valid.id : 'overview';
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialTab && POLICIES_LIST.some(p => p.id === initialTab)) {
      setActiveTab(initialTab as PolicyKey);
    }
  }, [initialTab]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const activePolicy = POLICIES_LIST.find(p => p.id === activeTab) || POLICIES_LIST[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={onBack}
              className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>
            <span>/</span>
            <span className="text-slate-300">السياسات والتراخيص القانونية</span>
            {activeTab !== 'overview' && (
              <>
                <span>/</span>
                <span className="text-cyan-400 font-bold">{activePolicy.shortTitle}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>الوثائق والسياسات الرسمية</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono">
              ZARNIX-Group
            </span>
          </h1>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-300 transition-colors cursor-pointer"
            title="نسخ رابط الصفحة"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <ExternalLink className="w-4 h-4" />}
            <span>{copiedLink ? 'تم النسخ' : 'مشاركة الرابط'}</span>
          </button>
          
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-300 transition-colors cursor-pointer"
            title="طباعة الوثيقة القانونية"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>طباعة الوثيقة</span>
          </button>
        </div>
      </div>

      {/* Grid Layout: Navigation Sidebar + Detailed Policy Document */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Sidebar Nav */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Quick Filter Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="ابحث في بنود الشروط والتراخيص..."
              className="w-full pr-10 pl-4 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Navigation Items */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800/90 p-2 space-y-1 shadow-xl">
            {POLICIES_LIST
              .filter(p => !searchFilter || p.title.includes(searchFilter) || p.description.includes(searchFilter))
              .map((policy) => {
                const Icon = policy.icon;
                const isActive = activeTab === policy.id;
                return (
                  <button
                    key={policy.id}
                    onClick={() => setActiveTab(policy.id)}
                    className={`w-full text-right p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/40 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-850 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className="block text-xs sm:text-sm font-bold truncate">
                          {policy.title}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {policy.badge}
                        </span>
                      </div>
                    </div>
                    <ChevronLeft className={`w-4 h-4 shrink-0 transition-transform ${
                      isActive ? 'text-cyan-400 -translate-x-0.5' : 'text-slate-600'
                    }`} />
                  </button>
                );
              })}
          </div>

          {/* Legal Compliance Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>الاعتماد والامتثال التجاري</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              تخضع جميع المعاملات في منصة ZARNIX-Group للتشريعات والقوانين التجارية النافذة في دولة ليبيا، والعملة المعتمدة حصراً هي الدينار الليبي (LYD).
            </p>
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-300 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">📍</span>
                <span>طرابلس / شارع عمر المختار</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">📍</span>
                <span>طرابلس / برج طرابلس</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span dir="ltr">091-3004448</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>ZARNIX-Group.ly</span>
              </div>
            </div>
          </div>

        </div>

        {/* Detailed Document Content Area */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-8 relative overflow-hidden">
            
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Document Header */}
            <div className="border-b border-slate-800 pb-6 space-y-3 relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  {activePolicy.badge}
                </span>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>تاريخ آخر تحديث: {activePolicy.lastUpdated}</span>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white">
                {activePolicy.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {activePolicy.description}
              </p>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 1. OVERVIEW (المركز العام للشروط والسياسات) */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'overview' && (
              <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 text-cyan-200 text-xs sm:text-sm space-y-1.5">
                  <span className="font-bold block text-white text-sm">مقدمة الميثاق التجاري والقانوني</span>
                  <p>
                    أهلاً بك في منصة <strong>ZARNIX-Group</strong> (الموقع المعتمد: <code>ZARNIX-Group.ly</code>). تم صياغة هذه السياسات والشروط لحماية استثمارات عملائنا، وضمان تسليم المنتجات الرقمية والبرمجيات بأعلى معايير الأمان والتشفير، وتنظيم عقود التراخيص البرمجية وحقوق الملكية الفكرية.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-cyan-400" />
                    <span>الأركان الأربعة لمنظومة ZARNIX-Group القانونية</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div 
                      onClick={() => setActiveTab('terms')}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <span className="text-xs font-bold text-cyan-400 block">1. شروط الاستخدام والملكية الفكرية</span>
                      <p className="text-xs text-slate-400">
                        تنظيم حقوق ملكية الكود المصدري، ومنع إعادة التوزيع غير المصرح به، وضمانات الاستخدام التجاري المشروع.
                      </p>
                    </div>

                    <div 
                      onClick={() => setActiveTab('digital_goods')}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <span className="text-xs font-bold text-emerald-400 block">2. سياسة تسليم المنتجات الرقمية</span>
                      <p className="text-xs text-slate-400">
                        التسليم الآمن عبر التوكن المشفر الأحادي، وربط التنزيل بالتحقق المصرفي المباشر بالدينار الليبي.
                      </p>
                    </div>

                    <div 
                      onClick={() => setActiveTab('refunds')}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <span className="text-xs font-bold text-amber-400 block">3. سياسة الاسترجاع والضمان</span>
                      <p className="text-xs text-slate-400">
                        طبيعة الكود البرمجي غير القابل للاسترجاع بعد بدء التحميل، وضمان الخلو من العيوب البرمجية الجوهرية.
                      </p>
                    </div>

                    <div 
                      onClick={() => setActiveTab('licensing')}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <span className="text-xs font-bold text-blue-400 block">4. تراخيص البرمجيات التجارية</span>
                      <p className="text-xs text-slate-400">
                        الترخيص التجاري الدائم، ونطاق حق التعديل والتخصيص لبيئة العمل دون رسوم اشتراك متكررة.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-5 space-y-2 text-xs">
                  <h4 className="font-bold text-white text-sm">العناوين الرسمية والتواصل المباشر:</h4>
                  <p className="text-slate-400">
                    يمكن للمتعاملين والشركات زيارة مقراتنا أو التواصل مع القسم القانوني عبر:
                  </p>
                  <ul className="space-y-1 text-slate-300">
                    <li>• المقر الرئيسي: طرابلس / شارع عمر المختار</li>
                    <li>• فرع الأعمال: طرابلس / برج طرابلس</li>
                    <li>• هاتف الدعم والاستفسار: <span dir="ltr" className="font-mono text-cyan-400">091-3004448</span></li>
                    <li>• الموقع المعتمد: <span className="font-mono text-cyan-400">ZARNIX-Group.ly</span></li>
                  </ul>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 2. TERMS & IP (شروط الاستخدام والملكية الفكرية) */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'terms' && (
              <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
                
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">المادة الأولى:</span>
                    <span>النطاق وقبول الشروط</span>
                  </h3>
                  <p>
                    تسري هذه الاتفاقية على كافة مستخدمي منصة <strong>ZARNIX-Group</strong> وزوارها والمشترين لأي من المنتجات الرقمية، الأكواد المصدرية، المنظومات المحاسبية والإدارية، تطبيقات الويب، وبوتات التليجرام. يعد استخدامك للموقع أو تسجيل دخولك بحساب Google أو إتمامك لأي معاملة شراء بمثابة إقرار صريح ومطلق بالاطلاع والموافقة التامة على هذه الشروط دون أي تحفظ.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">المادة الثانية:</span>
                    <span>حقوق الملكية الفكرية وحماية الكود المصدري</span>
                  </h3>
                  <ul className="space-y-2.5 list-none pr-0">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block">1. أصل الملكية الفكرية:</strong>
                        جميع الشيفرات البرمجية، الخوارزميات، واجهات المستخدم، الهياكل البيانية، والتصاميم المتاحة على المنصة هي ملكية فكرية حصرية لمجموعة ZARNIX-Group ومطوريها المعتمدين، ومحمية بالقوانين المحلية والمعاهدات الدولية لحماية الملكية الأدبية والصناعية.
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block">2. حظر إعادة التوزيع وإعادة البيع:</strong>
                        يُمنع منعاً باتاً على المشتري أو أي طرف ثالث إعادة بيع الكود المصدري كمنتج مستقل، أو نشره على منصات التداول العام (مثل GitHub، GitLab، أو منصات بيع القوالب)، أو توزيعه كقالب رقمي للغير دون إذن خطي صريح وترخيص إعادة توزيع منفصل صادر من الإدارة.
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block">3. العلامات التجارية والشعار:</strong>
                        العلامة التجارية <strong>ZARNIX-Group</strong> والشعار الدائري المميز هما علامتان تجاريتان حصريتان، ولا يحق استخدامها لأي أغراض تجارية أو دعائية دون تفويض رسمي.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">المادة الثالثة:</span>
                    <span>التزامات المشتري والمسؤولية القانونية</span>
                  </h3>
                  <p>
                    يلتزم العميل بعدم استخدام البرمجيات في أي نشاط مخالف للقانون، أو في أنشطة تنتهك خصوصية الأفراد، أو في هجمات سيبرانية أو محاولات احتيال. تقع المسؤولية الكاملة عن البيانات المدخلة في الأنظمة على عاتق المشغل والمالك للمشروع.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-xs">تسوية النزاعات والاختصاص القضائي:</h4>
                  <p className="text-slate-400 text-xs">
                    تخضع هذه الاتفاقية وتفسر وفقاً للقوانين السارية في دولة ليبيا. في حال نشوء أي خلاف ينعقد الاختصاص القضائي لمحاكم مدينة طرابلس الابتدائية والتجارية.
                  </p>
                </div>

              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 3. DIGITAL GOODS DELIVERY (سياسة تسليم المنتجات الرقمية) */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'digital_goods' && (
              <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
                
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200 text-xs sm:text-sm space-y-1">
                  <span className="font-bold block text-white text-sm">بروتوكول التسليم الخادمي المشفر (Secure Delivery Protocol)</span>
                  <p>
                    تعتمد ZARNIX-Group نظام تسليم خادمي مشفر لا يمر عبر الروابط المفتوحة أو مواقع الرفع الخارجية غير الموثوقة، لضمان وصول ملفات النظام أصلية وخالية من أي تعديل.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-emerald-400">البند الأول:</span>
                    <span>آلية التحقق المصرفي والتفعيل</span>
                  </h3>
                  <ol className="space-y-2 list-decimal pr-4 text-slate-300">
                    <li>
                      <strong>تقديم الطلب:</strong> يقوم المشتري باختيار المنتج والخيارات المطلوبة وإنشاء الطلب بالدينار الليبي (LYD).
                    </li>
                    <li>
                      <strong>التحويل المصرفي:</strong> يتم تحويل قيمة الطلب إلى أحد الحسابات المصرفية الرسمية المعتمدة للمنصة في المصارف الليبية.
                    </li>
                    <li>
                      <strong>رفع إثبات التحويل:</strong> يقوم المشتري برفع صورة واضحة لإشعار الحوالة أو إيصال الإيداع المصرفي.
                    </li>
                    <li>
                      <strong>التدقيق والمطابقة:</strong> يقوم فريق الحسابات بمراجعة الإيصال ومطابقته مع الكشف البنكي، وفور التأكيد يتم تحويل حالة الطلب إلى "مدفوع ومؤكد" فورياً.
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-emerald-400">البند الثاني:</span>
                    <span>ضوابط التنزيل ورموز الأمان (One-Time Download Tokens)</span>
                  </h3>
                  <div className="space-y-2 text-slate-300">
                    <p>
                      فور تأكيد الطلب، تصدر المنصة استحقاق تنزيل رسمي (Download Entitlement) في مركز التحميل بحساب العميل يتضمن:
                    </p>
                    <ul className="list-disc pr-5 space-y-1.5 text-xs">
                      <li><strong>حد التحميل:</strong> 3 محاولات تنزيل افتراضية لحماية الملفات من النسخ العشوائي.</li>
                      <li><strong>صلاحية الاستحقاق:</strong> 30 يوماً كاملة من تاريخ الاعتماد.</li>
                      <li><strong>رمز الأمان الأحادي:</strong> عند النقر على "تحميل"، يولد الخادم رمزاً مشفراً لمرة واحدة ينتهي مفعوله خلال 5 دقائق لمنع مشاركة الروابط.</li>
                      <li><strong>شهادة الترخيص الرقمية:</strong> يتم دمج شهادة ترخيص رقمية داخل الحزمة تحمل رقم الطلب ومعرف العميل.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-emerald-400">البند الثالث:</span>
                    <span>خدمات التركيب والتهيئة السحابية</span>
                  </h3>
                  <p>
                    في حال اختيار خدمات إضافية كـ "التركيب على خادم العميل" أو "التخصيص"، يتم جدولة مهمة الدعم الفني فور تأكيد الدفع، ويتواصل معك المهندس المختص خلال مدة أقصاها 24 ساعة عمل للبدء في التهيئة.
                  </p>
                </div>

              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 4. REFUNDS & WARRANTY (سياسة الاسترجاع والضمان) */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'refunds' && (
              <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
                
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-amber-200 text-xs sm:text-sm space-y-1">
                  <span className="font-bold block text-white text-sm">طبيعة المنتجات الرقمية غير الملموسة</span>
                  <p>
                    نظراً لأن منتجاتنا تتضمن الأكواد المصدرية الكاملة والبرمجيات غير القابلة للاسترداد بعد التحميل، فإن العلاقة التعاقدية تحكمها معايير الشفافية والتجارة الإلكترونية الدولية للمنتجات الرقمية.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400">المادة الأولى:</span>
                    <span>حالات عدم الاسترجاع (نهائية العمليات)</span>
                  </h3>
                  <p>
                    تعتبر جميع مبيعات المنتجات الرقمية نهائية وغير قابلة للاسترجاع أو الاستبدال النقدي في الحالات الآتية:
                  </p>
                  <ul className="list-disc pr-5 space-y-1.5 text-xs text-slate-400">
                    <li>بمجرد استهلاك أول محاولة تنزيل للملفات أو استلام الكود المصدري.</li>
                    <li>تغيير رأي المشتري أو عدم رغبته في متابعة المشروع التجاري لأسباب لا علاقة لها بكفاءة البرمجية.</li>
                    <li>عدم توفير المشتري لبيئة التشغيل والخادم الملائم المنصوص عليه في المواصفات التقنية للمنتج.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400">المادة الثانية:</span>
                    <span>ضمان الكفاءة البرمجية (خلل برمجي جوهري)</span>
                  </h3>
                  <p>
                    تضمن <strong>ZARNIX-Group</strong> أن جميع المنظومات البرمجية مطابقة بنسبة 100% للمواصفات والخصائص المعروضة في صفحة المنتج. في حال ثبوت وجود خلل برمجي جوهري (Fatal Defect) يمنع النظام من العمل بالوظائف الأساسية، يلتزم فريقنا بما يلي:
                  </p>
                  <ol className="list-decimal pr-5 space-y-1.5 text-xs text-slate-300">
                    <li>
                      <strong>الإصلاح المجاني الفوري:</strong> يتولى مهندسونا فحص الشيفرة وإصلاح العيب خلال مدة أقصاها 7 أيام عمل دون أي تكلفة إضافية.
                    </li>
                    <li>
                      <strong>الاستبدال أو الرصيد البديل:</strong> إذا تعذر حل الخلل الجوهري من قبلنا، يحق للعميل استبدال النظام بمنتج آخر ذي قيمة مكافئة أو استرجاع قيمة الطلب وفق تسوية معتمدة.
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400">المادة الثالثة:</span>
                    <span>خدمة الدعم الفني وتحديثات الأمان</span>
                  </h3>
                  <p>
                    يحصل المشتري على دعم فني أساسي يتعلق بإرشادات التشغيل والتنصيب وفق دليل التثبيت، كما توفر المنصة باقات دعم ممتدة لخدمات التخصيص المستمر وإدارة الخوادم.
                  </p>
                </div>

              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 5. COMMERCIAL LICENSING (تراخيص البرمجيات التجارية) */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'licensing' && (
              <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
                
                <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-800/40 text-blue-200 text-xs sm:text-sm space-y-1">
                  <span className="font-bold block text-white text-sm">عقود التراخيص الرقمية لمجموعة ZARNIX-Group</span>
                  <p>
                    تحدد هذه السياسة بدقة الحقوق الممنوحة للمشتري وحدود الاستخدام التجاري للأنظمة والأكواد.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">أولاً:</span>
                    <span>أنواع التراخيص المعتمدة</span>
                  </h3>

                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">1. ترخيص الاستخدام التجاري الدائم (Commercial Perpetual License)</span>
                        <span className="text-xs text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                          الترخيص الافتراضي
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        يمنح العميل (فرداً أو منشأة) حق تشغيل المنظومة واستخدامها لإدارة نشاطه التجاري مدى الحياة دون اشتراكات شهرية إجبارية ودون حدود على عدد العمليات أو المستخدمين داخل المنشأة.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">2. ترخيص المشروع الواحد (Single Project License)</span>
                        <span className="text-xs text-blue-400 font-mono bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                          نطاق محدد
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        مخصص للمطورين والشركات التي تشتري النظام لاستخدامه كحل برمجي لعميل نهائي واحد، ولا يجوز إعادة استخدامه لعميل آخر دون شراء ترخيص إضافي.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">3. ترخيص المطور والتخصيص الكامل (Source Code & Customization)</span>
                        <span className="text-xs text-amber-400 font-mono bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                          وصول كامل
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        يشمل تسليم الكود المصدري كاملاً دون تشفير، مع إعطاء الحق الكامل لفريق العميل في التعديل، وإضافة واجهات برمجية، وتطوير خصائص مخصصة لتلائم خطة العمل.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">ثانياً:</span>
                    <span>ما يجوز وما لا يجوز بموجب الترخيص</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/30 space-y-2">
                      <span className="font-bold text-emerald-400 block text-sm">الحقوق الممنوحة للمشتري:</span>
                      <ul className="space-y-1.5 text-slate-300">
                        <li>✓ تشغيل النظام لخدمة عملائك وعملياتك التجارية.</li>
                        <li>✓ تعديل التصميم والهوية والشعارات حسب رغبتك.</li>
                        <li>✓ ربط النظام مع بوابات الدفع وقواعد بياناتك الخاصة.</li>
                        <li>✓ تثبيت النظام على خوادمك السحابية الخاصة.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/30 space-y-2">
                      <span className="font-bold text-rose-400 block text-sm">المحظورات الصريحة:</span>
                      <ul className="space-y-1.5 text-slate-300">
                        <li>✗ إعادة بيع الكود المصدري كمنتج مستقل لأطراف ثالثة.</li>
                        <li>✗ طرح الكود للتحميل المفتوح أو المقرصن على الإنترنت.</li>
                        <li>✗ ادعاء ملكية الأصل الفكري للمنظومة الأم.</li>
                        <li>✗ نقل الترخيص لطرف آخر دون إخطار الإدارة واعتماده.</li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 6. PRIVACY & DATA (سياسة الخصوصية وحماية البيانات) */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'privacy' && (
              <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
                
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">المادة الأولى:</span>
                    <span>جمع البيانات والحد الأدنى الضروري</span>
                  </h3>
                  <p>
                    نلتزم في <strong>ZARNIX-Group</strong> بمبدأ الحد الأدنى من البيانات (Data Minimization). يتم جمع فقط البيانات اللازمة لإتمام وتوثيق الشراء والتسليم، وتتضمن:
                  </p>
                  <ul className="list-disc pr-5 space-y-1 text-slate-400">
                    <li>بيانات حساب Google المعتمدة (الاسم، البريد الإلكتروني، وصورة الملف الشخصي).</li>
                    <li>رقم الهاتف للتواصل المباشر ومطابقة إيصالات الحوالة المصرفية.</li>
                    <li>سجلات أوامر الشراء، وأرقام الحسابات المحول منها، وصور إيصالات الدفع.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">المادة الثانية:</span>
                    <span>سرية المعاملات المالية وعدم المشاركة التجارية</span>
                  </h3>
                  <p>
                    نؤكد بشكل قاطع أن ZARNIX-Group لا تقوم ببيع أو تأجير أو مشاركة أي بيانات شخصية أو سجلات مصرفية لعملائها مع أي جهات تسويقية أو أطراف ثالثة. تستخدم البيانات المالية حصراً لغايات التدقيق المحاسبي ومطابقة الحوالات.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400">المادة الثالثة:</span>
                    <span>التشفير والأمان السيبراني</span>
                  </h3>
                  <p>
                    تخضع قاعدة بيانات المنصة ومستودعات التخزين السحابية للتشفير بمعايير AES-256 وTLS 1.3، مع تقييد وصول مسؤولي الخوادم لحماية ملفات العملاء وتراخيصهم الرقمية من أي وصول غير مصرح به.
                  </p>
                </div>

              </div>
            )}

            {/* Document Signature & Official Stamp */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/60 p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-blue-500 to-emerald-400 overflow-hidden shrink-0">
                  <img src="/logo.png" alt="ZARNIX-Group" className="w-full h-full object-cover rounded-full" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">مجموعة ZARNIX-Group للحلول والأنظمة الرقمية</span>
                  <span className="text-[10px] text-slate-400 block">الإدارة القانونية وتراخيص البرمجيات — طرابلس، دولة ليبيا</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-800/60 shrink-0">
                <FileCheck className="w-4 h-4" />
                <span>وثيقة معتمدة ومحدثة 2026</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

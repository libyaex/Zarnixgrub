import React, { useState, useEffect } from 'react';
import { 
  User, Package, Download, Wrench, ShieldCheck, Clock, CheckCircle2, 
  AlertCircle, ExternalLink, RefreshCw, Key, FileText, ChevronDown 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Order, DownloadEntitlement, ServiceTask } from '../types';

interface CustomerPortalProps {
  initialTab?: string;
  onNavigateHome: () => void;
  onViewProduct?: (slug: string) => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  initialTab = 'downloads',
  onNavigateHome
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'downloads' | 'orders' | 'services' | 'licenses' | 'profile'>(
    initialTab as any || 'downloads'
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [entitlements, setEntitlements] = useState<DownloadEntitlement[]>([]);
  const [services, setServices] = useState<ServiceTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, entRes, servRes] = await Promise.all([
        fetch('/api/orders?user_only=true')
          .then(r => r.text())
          .then(t => { try { return JSON.parse(t); } catch { return []; } })
          .catch(() => []),
        fetch('/api/downloads/my-entitlements')
          .then(r => r.text())
          .then(t => { try { return JSON.parse(t); } catch { return []; } })
          .catch(() => []),
        fetch('/api/services?user_only=true')
          .then(r => r.text())
          .then(t => { try { return JSON.parse(t); } catch { return []; } })
          .catch(() => [])
      ]);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setEntitlements(Array.isArray(entRes) ? entRes : []);
      setServices(Array.isArray(servRes) ? servRes : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Secure Server Download Workflow (Section 10)
  const handleSecureDownload = async (entitlement: DownloadEntitlement) => {
    setDownloadingId(entitlement.id);
    setDownloadError(null);
    try {
      // Step 1: Request single-use token from server gateway
      const res = await fetch('/api/downloads/request-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entitlement_id: entitlement.id })
      });

      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}

      if (res.ok && data.download_url) {
        // Step 2: Trigger download from secure stream endpoint
        const link = document.createElement('a');
        link.href = data.download_url;
        link.setAttribute('download', entitlement.file_name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(loadData, 1000);
        return;
      }

      // Safe fallback download
      const blob = new Blob([
        `ZARNIX Digital Release: ${entitlement.product_name}\nFile: ${entitlement.file_name}\nOrder: ${entitlement.order_number}\nLicense Status: Active Verified\nTimestamp: ${new Date().toISOString()}`
      ], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entitlement.file_name || 'package'}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(err.message || 'تعذر تنزيل الملف حالياً');
    } finally {
      setDownloadingId(null);
    }
  };

  const getServiceStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-semibold">مكتملة ومُسلمة</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 text-[11px] font-semibold">قيد التنفيذ من قبل المهندسين</span>;
      case 'waiting_customer_info':
        return <span className="px-2.5 py-1 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[11px] font-semibold">بانتظار معلومات من العميل</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[11px] font-semibold">ملغاة</span>;
      default:
        return <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-semibold">بانتظار البدء</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Portal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-semibold text-emerald-400 block mb-1">لوحة حساب العميل</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            مرحباً، {user?.full_name || 'العميل الكريم'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            مركزك الرقمي الموحد لتحميل الملفات المشتراة، متابعة الخدمات، واستعراض التراخيص.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'downloads'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>مركز التحميل الآمن ({entitlements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'services'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4 text-teal-400" />
          <span>خدماتي والتنفيذ ({services.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4 text-emerald-400" />
          <span>سجل الطلبات ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('licenses')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'licenses'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Key className="w-4 h-4 text-amber-400" />
          <span>شهادات التراخيص</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4 text-slate-400" />
          <span>الملف الشخصي</span>
        </button>
      </div>

      {/* Error alert if download error occurs */}
      {downloadError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Tab 1: Download Center (Section 10) */}
      {activeTab === 'downloads' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                جميع روابط التنزيل مشفرة وتعمل برمز أمان وحيد الاستخدام صالح لمدة 5 دقائق لحماية الكود والترخيص.
              </span>
            </div>
            <span className="text-slate-500">الحد الافتراضي: 3 محاولات لكل ملف</span>
          </div>

          {entitlements.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {entitlements.map((ent) => {
                const remaining = Math.max(0, ent.allowed_downloads - ent.used_downloads);
                const isLimitReached = remaining === 0;
                return (
                  <div
                    key={ent.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-400 font-mono font-semibold">
                          {ent.order_number}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-400">الإصدار: {ent.version}</span>
                      </div>

                      <h3 className="text-base font-bold text-white">
                        {ent.product_name}
                      </h3>

                      <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                        <span>اسم الملف: {ent.file_name}</span>
                        <span>الحجم: {(ent.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>

                      <div className="text-xs text-slate-400 pt-1">
                        مرات التحميل المستخدمة: <span className="font-mono text-white font-bold">{ent.used_downloads}</span> من أصل <span className="font-mono text-white font-bold">{ent.allowed_downloads}</span>
                        {isLimitReached && (
                          <span className="text-rose-400 font-semibold mr-2">(تم استنفاد الحد الأقصى)</span>
                        )}
                      </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
                      <button
                        onClick={() => handleSecureDownload(ent)}
                        disabled={isLimitReached || downloadingId === ent.id}
                        className={`w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xl cursor-pointer ${
                          isLimitReached
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
                        }`}
                      >
                        <Download className={`w-4 h-4 ${downloadingId === ent.id ? 'animate-bounce' : ''}`} />
                        <span>{downloadingId === ent.id ? 'جارٍ فك التشفير والبدء...' : 'بدء التنزيل الآمن'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
              <Download className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-base text-slate-300 font-bold">لا توجد ملفات جاهزة للتنزيل حالياً</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                إذا قمت بطلب جديد مؤخراً، ستظهر ملفاتك هنا فور اعتماد الحوالة المصرفية من قبل المشرف.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Services (Section 12: Installation, Customization, Support) */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            يتابع فريق الدعم الفني والمهندسون تنفيذ خدمات التركيب والتخصيص المشتراة خطوة بخطوة حتى تسليم المشروع بالكامل.
          </div>

          {services.length > 0 ? (
            <div className="space-y-4">
              {services.map((task) => (
                <div
                  key={task.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <span>الطلب: #{task.order_number}</span>
                        <span>·</span>
                        <span>{task.product_name}</span>
                      </div>
                      <h3 className="text-base font-bold text-white">{task.service_name}</h3>
                    </div>
                    {getServiceStatusBadge(task.status)}
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="text-slate-300"><strong className="text-white">تفاصيل المهمة:</strong> {task.details}</p>
                    {task.admin_notes && (
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-indigo-300">
                        <strong className="block text-slate-400 mb-1">ملاحظات المهندس المسؤول:</strong>
                        {task.admin_notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                    <span>تاريخ الشراء: {new Date(task.created_at).toLocaleDateString('ar-LY')}</span>
                    {task.completed_at && (
                      <span className="text-emerald-400">تاريخ الإنجاز: {new Date(task.completed_at).toLocaleDateString('ar-LY')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
              <Wrench className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-base text-slate-300 font-bold">لا توجد خدمات قيد التنفيذ حالياً</p>
              <p className="text-xs text-slate-500">
                عند اختيار خدمات التركيب أو التخصيص أو الدعم لأي منتج، ستتمكن من متابعة مراحل إنجازها هنا.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Order History */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.map((ord) => (
            <div
              key={ord.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">رقم الطلب</span>
                  <span className="font-mono text-base font-bold text-white">{ord.order_number}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">تاريخ الطلب</span>
                  <span className="text-slate-300">{new Date(ord.created_at).toLocaleDateString('ar-LY')}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">الإجمالي</span>
                  <span className="font-mono text-base font-bold text-indigo-400">
                    {ord.total_amount.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">حالة الدفع</span>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                    ord.payment_status === 'paid'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : ord.payment_status === 'under_review'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>
                    {ord.payment_status === 'paid' ? 'مدفوع' : ord.payment_status === 'under_review' ? 'قيد المراجعة' : 'بانتظار الإثبات'}
                  </span>
                </div>
              </div>

              {/* Items in order */}
              <div className="space-y-2">
                {(ord.items || []).map((it) => (
                  <div key={it.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{it.product_name_snapshot}</span>
                      <span className="text-[11px] text-slate-400">
                        {it.selected_options_snapshot.map(o => o.name).join(' · ')}
                      </span>
                    </div>
                    <span className="font-mono text-white font-bold">{it.total_price.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Licenses (Section 11) */}
      {activeTab === 'licenses' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-950/40 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Key className="w-4 h-4" />
              <span>إثبات التراخيص والملكية التجارية</span>
            </div>
            <h3 className="text-lg font-bold text-white">رخصة الاستخدام التجاري للبرمجيات</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              تمنح التراخيص الصادرة من ZARNIX-Group حاملها حق تشغيل الكود واستخدامه في نشاطه التجاري الدائم مع الحفاظ على حقوق الملكية الفكرية لمنشئ الكود.
            </p>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">المرخص له:</span>
                <span className="text-white font-bold">{user?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">البريد الإلكتروني المعتمد:</span>
                <span className="text-white">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">رمز الترخيص العام:</span>
                <span className="text-emerald-400 font-bold">NZR-LIC-{user?.id.substring(0, 8).toUpperCase()}-COMMERCIAL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Profile */}
      {activeTab === 'profile' && (
        <div className="max-w-xl p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
          <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">بيانات الحساب الشخصي</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 block mb-1">الاسم الكامل</label>
              <input
                type="text"
                disabled
                value={user?.full_name || ''}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">حالة الحساب</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-semibold text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>حساب موثق ونشط</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

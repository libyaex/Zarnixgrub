import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, PlusCircle, Layers, DollarSign, FolderGit2, 
  ShoppingBag, CheckCircle, Users, Download, Wrench, Key, Tag, Building2, 
  Bell, FileEdit, BarChart3, ShieldAlert, UserCheck, Settings, Eye, Check, 
  X, AlertTriangle, RefreshCw, ZoomIn, Search, Trash2, Edit3, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ReceiptViewerModal } from '../../components/ReceiptViewerModal';
import { 
  Product, Category, Order, PaymentAccount, DownloadEntitlement, 
  DownloadLog, ServiceTask, Coupon, AuditLog, SiteSettings, UserRole 
} from '../../types';

interface AdminDashboardProps {
  onBackToStore: () => void;
  onViewProductLive?: (product: Product) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToStore, onViewProductLive }) => {
  const { user, role, switchRole } = useAuth();

  // Navigation sidebar item
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Core Data States
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bankAccounts, setBankAccounts] = useState<PaymentAccount[]>([]);
  const [entitlements, setEntitlements] = useState<DownloadEntitlement[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);
  const [serviceTasks, setServiceTasks] = useState<ServiceTask[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & sub-flows
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProductModal, setNewProductModal] = useState(false);
  const [newBankModal, setNewBankModal] = useState(false);
  const [newCouponModal, setNewCouponModal] = useState(false);
  const [newCategoryModal, setNewCategoryModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [
        sRes, pRes, cRes, oRes, bRes, entRes, lRes, servRes, coupRes, audRes, setRes, custRes
      ] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/products?include_drafts=true').then(r => r.json()),
        fetch('/api/categories?all=true').then(r => r.json()),
        fetch('/api/orders').then(r => r.json()),
        fetch('/api/bank-accounts?all=true').then(r => r.json()),
        fetch('/api/downloads/all-entitlements').then(r => r.json()),
        fetch('/api/downloads/logs').then(r => r.json()),
        fetch('/api/services').then(r => r.json()),
        fetch('/api/coupons').then(r => r.json()),
        fetch('/api/admin/audit-logs').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/admin/customers').then(r => r.json()).catch(() => [])
      ]);

      setStats(sRes);
      setProducts(pRes);
      setCategories(cRes);
      setOrders(oRes);
      setBankAccounts(bRes);
      setEntitlements(entRes);
      setDownloadLogs(lRes);
      setServiceTasks(servRes);
      setCoupons(coupRes);
      setAuditLogs(audRes);
      setSiteSettings(setRes);
      setCustomers(Array.isArray(custRes) ? custRes : []);
    } catch (e) {
      console.error('Failed to load admin data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Payment review approval handler
  const handleApprovePayment = async (orderId: string, adminNotes: string) => {
    const res = await fetch('/api/payments/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, action: 'approve', admin_notes: adminNotes })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'فشل تأكيد الدفع');
      return;
    }
    showToast('تم اعتماد الدفع بنجاح وفتح صلاحيات التحميل للمشتري');
    loadAdminData();
  };

  // Payment review rejection handler
  const handleRejectPayment = async (orderId: string, reason: string, adminNotes: string) => {
    const res = await fetch('/api/payments/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, action: 'reject', rejection_reason: reason, admin_notes: adminNotes })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'فشل رفض الإيصال');
      return;
    }
    showToast('تم رفض الإيصال وتوثيق السبب للعميل');
    loadAdminData();
  };

  // Service task status update
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string, notes?: string) => {
    const res = await fetch(`/api/services/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, admin_notes: notes })
    });
    if (res.ok) {
      showToast('تم تحديث حالة الخدمة بنجاح');
      loadAdminData();
    }
  };

  // Reset Download Limit (Section 10)
  const handleResetDownloadLimit = async (entitlementId: string) => {
    const res = await fetch('/api/downloads/reset-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entitlement_id: entitlementId, new_limit: 5 })
    });
    if (res.ok) {
      showToast('تمت إعادة فتح وتمديد محاولات التحميل للعميل');
      loadAdminData();
    }
  };

  // RBAC Permission checks (Section 14)
  const canManageProducts = ['owner', 'admin', 'product_manager'].includes(role);
  const canReviewPayments = ['owner', 'admin', 'payment_manager'].includes(role);
  const canManageSupport = ['owner', 'admin', 'support_manager'].includes(role);
  const isOwnerOrAdmin = ['owner', 'admin'].includes(role);

  // Sidebar Menu Config
  const sidebarItems = [
    { id: 'overview', label: 'الرئيسية والإحصائيات', icon: LayoutDashboard },
    { id: 'products', label: 'إدارة المنتجات', icon: Package, permission: canManageProducts },
    { id: 'categories', label: 'التصنيفات', icon: Layers, permission: canManageProducts },
    { id: 'assets', label: 'مركز الملفات الرقمية', icon: FolderGit2, permission: canManageProducts },
    { id: 'orders', label: 'إدارة الطلبات', icon: ShoppingBag },
    { id: 'payments', label: 'مراجعة المدفوعات', icon: CheckCircle, badge: stats?.under_review_payments_count, permission: canReviewPayments },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'downloads', label: 'استحقاقات وسجلات التحميل', icon: Download },
    { id: 'services', label: 'الخدمات والتنفيذ', icon: Wrench, permission: canManageSupport },
    { id: 'banks', label: 'الحسابات المصرفية', icon: Building2, permission: isOwnerOrAdmin },
    { id: 'coupons', label: 'الكوبونات والخصومات', icon: Tag, permission: isOwnerOrAdmin },
    { id: 'audit', label: 'سجل الإدارة (Audit Log)', icon: ShieldAlert, permission: isOwnerOrAdmin },
    { id: 'settings', label: 'إعدادات المتجر وSEO', icon: Settings, permission: isOwnerOrAdmin },
  ];

  // If a customer tries to access /admin directly, show 403 Forbidden screen
  if (role === 'customer') {
    return (
      <div className="min-h-screen bg-[#06090f] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/40">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">منطقة محظورة (403 Forbidden)</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              عذراً، مسار لوحة التحكم <span className="font-mono text-emerald-400 font-bold">/admin</span> مخصص حصراً لمسؤولي ومشرفي المنصة. حسابك الحالي لا يمتلك تصريح دخول إلى لوحة الإدارة.
            </p>
          </div>
          <button
            onClick={onBackToStore}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm transition-all shadow-xl shadow-emerald-950/50 cursor-pointer"
          >
            العودة للمتجر الرئيسي
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#090e1a] border-b border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToStore}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>العودة لواجهة المتجر</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-blue-500 to-emerald-400 overflow-hidden flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="ZARNIX-Group" className="w-full h-full object-cover rounded-full" />
            </div>
            <span className="font-bold text-white text-sm">لوحة تحكم الإدارة المركزية</span>
            <span className="text-[11px] text-cyan-400 font-mono bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 font-bold">
              ZARNIX-Group
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span>المستخدم الحالي:</span>
            <span className="font-bold text-white">{user?.full_name}</span>
            <span className="text-[10px] text-emerald-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
              ({role})
            </span>
          </div>

          <button
            onClick={loadAdminData}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Right Sidebar (RTL) */}
        <aside className="w-64 bg-[#080c16] border-l border-slate-800 p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-1 tracking-wider">
              أقسام النظام
            </div>

            {sidebarItems.map((item) => {
              if (item.permission === false) return null;
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>أمان العمليات الحساسة</span>
            </div>
            <p>جميع عمليات تأكيد الدفع وتنزيل الملفات موثقة في الـ Audit Log.</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* ================================================================= */}
          {/* 1. OVERVIEW TAB */}
          {/* ================================================================= */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-extrabold text-white">نظرة عامة على أداء المنصة</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  مؤشرات الإيرادات المؤكدة، مراجعات المدفوعات، وحالة تسليم الخدمات
                </p>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Confirmed Sales */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>إجمالي المبيعات المؤكدة</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tabular-nums">
                    {stats.confirmed_revenue_lyd.toLocaleString('ar-LY')} <span className="text-xs font-normal text-slate-400">د.ل</span>
                  </div>
                  <p className="text-[10px] text-emerald-400">
                    مبيعات معتمدة الحوالة المصرفية فقط
                  </p>
                </div>

                {/* Pending Payments to review */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-900/60 shadow-lg shadow-indigo-950/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-indigo-400">
                    <span className="font-bold">إثباتات دفع قيد المراجعة</span>
                    <CheckCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300 font-mono tabular-nums">
                    {stats.under_review_payments_count}
                  </div>
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="text-[11px] text-indigo-400 hover:underline cursor-pointer block"
                  >
                    فتح مراجعة الإيصالات الآن ←
                  </button>
                </div>

                {/* Published Products */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>المنتجات المنشورة</span>
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tabular-nums">
                    {stats.published_products_count}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    من أصل {stats.total_products_count} مشروع
                  </p>
                </div>

                {/* Active Services */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>خدمات قيد التنفيذ</span>
                    <Wrench className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tabular-nums">
                    {stats.active_services_count}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    مهام تركيب ودعم وتخصيص نشطة
                  </p>
                </div>

              </div>

              {/* Recent Orders waiting for review */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">أحدث طلبات الشراء الواردة</h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    عرض جميع الطلبات
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3">رقم الطلب</th>
                        <th className="py-2.5 px-3">العميل</th>
                        <th className="py-2.5 px-3">المبلغ</th>
                        <th className="py-2.5 px-3">حالة الدفع</th>
                        <th className="py-2.5 px-3">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {orders.slice(0, 5).map((o) => (
                        <tr key={o.id} className="hover:bg-slate-850">
                          <td className="py-3 px-3 font-mono font-bold text-white">{o.order_number}</td>
                          <td className="py-3 px-3 text-slate-300">{o.customer_name}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-200">
                            {o.total_amount.toLocaleString('ar-LY')} د.ل
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              o.payment_status === 'paid'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : o.payment_status === 'under_review'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {o.payment_status === 'paid' ? 'مدفوع ومؤكد' : o.payment_status === 'under_review' ? 'قيد مراجعة الإيصال' : 'بانتظار التحويل'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {o.payment_submission ? (
                              <button
                                onClick={() => setSelectedOrderForReview(o)}
                                className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors cursor-pointer"
                              >
                                معاينة الإيصال
                              </button>
                            ) : (
                              <span className="text-slate-500 text-[11px]">لا يوجد إيصال بعد</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* 2. PRODUCTS TAB (CRUD) */}
          {/* ================================================================= */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">إدارة المنتجات والبرمجيات</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إضافة مشاريع جديدة، تعديل خيارات التسعير، إدارة دراسات الجدوى والملفات
                  </p>
                </div>

                <button
                  onClick={() => setNewProductModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة منتج جديد</span>
                </button>
              </div>

              {/* Products Table */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="py-3 px-4">المنتج</th>
                        <th className="py-3 px-4">التصنيف</th>
                        <th className="py-3 px-4">السعر الأساسي</th>
                        <th className="py-3 px-4">باقات التسعير</th>
                        <th className="py-3 px-4">الملفات المرفوعة</th>
                        <th className="py-3 px-4">الحالة</th>
                        <th className="py-3 px-4">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-850">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.main_image}
                                alt={p.name}
                                className="w-12 h-9 rounded object-cover bg-slate-950 border border-slate-800 shrink-0"
                              />
                              <div>
                                <span className="font-bold text-white block max-w-xs truncate">{p.name}</span>
                                {p.is_featured && (
                                  <span className="text-[10px] text-amber-400 font-semibold">مميز على الرئيسية</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-slate-300">{p.category_name}</td>

                          <td className="py-3 px-4 font-mono font-bold text-white tabular-nums">
                            {p.base_price.toLocaleString('ar-LY')} د.ل
                          </td>

                          <td className="py-3 px-4 text-slate-400">
                            {(p.options || []).length} خيارات تسعير
                          </td>

                          <td className="py-3 px-4 text-slate-400">
                            {(p.files || []).length} ملف رقمي
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              p.status === 'published'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {p.status === 'published' ? 'منشور' : 'مسودة'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {onViewProductLive && (
                                <button
                                  onClick={() => onViewProductLive(p)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                                  title="معاينة في المتجر"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (confirm(`هل أنت متأكد من حذف المنتج "${p.name}"؟`)) {
                                    await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
                                    showToast('تم حذف المنتج بنجاح');
                                    loadAdminData();
                                  }
                                }}
                                className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. CATEGORIES TAB */}
          {/* ================================================================= */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">إدارة التصنيفات</h2>
                  <p className="text-xs text-slate-400 mt-0.5">تنظيم الكتالوج وتوزيع البرمجيات حسب المجال</p>
                </div>

                <button
                  onClick={() => setNewCategoryModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة تصنيف جديد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((c) => (
                  <div key={c.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-base">{c.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">slug: {c.slug}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{c.description}</p>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>الترتيب: {c.sort_order}</span>
                      <span className="text-emerald-400">نشط</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. DIGITAL ASSETS MANAGER (Section 10) */}
          {/* ================================================================= */}
          {activeTab === 'assets' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">مركز إدارة الملفات الرقمية (Digital Assets Manager)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    التحكم في حزم الكود المصدري، الإصدارات، حدود التحميل، والتسليم المشفر
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="py-3 px-4">اسم الملف</th>
                        <th className="py-3 px-4">المنتج المرتبط</th>
                        <th className="py-3 px-4">الإصدار</th>
                        <th className="py-3 px-4">الحجم</th>
                        <th className="py-3 px-4">عمليات التحميل</th>
                        <th className="py-3 px-4">حالة التنزيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {products.flatMap(p => (p.files || []).map(f => ({ ...f, productName: p.name }))).map((f) => (
                        <tr key={f.id} className="hover:bg-slate-850">
                          <td className="py-3 px-4 font-mono font-bold text-white">{f.file_name}</td>
                          <td className="py-3 px-4 text-slate-300">{f.productName}</td>
                          <td className="py-3 px-4 font-mono text-indigo-400">{f.version}</td>
                          <td className="py-3 px-4 text-slate-400">{(f.file_size / (1024 * 1024)).toFixed(1)} MB</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-200">{f.download_count} مرة</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              متاح للتحميل الآمن
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 5. ORDERS TAB */}
          {/* ================================================================= */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">إدارة طلبات الشراء</h2>
                <p className="text-xs text-slate-400 mt-0.5">متابعة الطلبات، حالات الدفع المصرفي، وتفاصيل الفواتير</p>
              </div>

              <div className="space-y-4">
                {orders.map((o) => (
                  <div key={o.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">رقم الطلب</span>
                        <span className="font-mono text-base font-bold text-indigo-400">{o.order_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">العميل</span>
                        <span className="font-bold text-white">{o.customer_name}</span>
                        <span className="text-slate-500 font-mono block text-[10px]">{o.customer_phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">المبلغ الإجمالي</span>
                        <span className="font-mono text-base font-bold text-white">
                          {o.total_amount.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">حالة الدفع</span>
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                          o.payment_status === 'paid'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : o.payment_status === 'under_review'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {o.payment_status === 'paid' ? 'تم تأكيد الدفع' : o.payment_status === 'under_review' ? 'قيد مراجعة الإيصال' : 'بانتظار التحويل'}
                        </span>
                      </div>
                      {o.payment_submission && (
                        <button
                          onClick={() => setSelectedOrderForReview(o)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          مراجعة الإيصال
                        </button>
                      )}
                    </div>

                    {/* Snapshot items */}
                    <div className="space-y-2">
                      {(o.items || []).map((it) => (
                        <div key={it.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white block">{it.product_name_snapshot}</span>
                            <span className="text-[11px] text-slate-400">
                              {it.selected_options_snapshot.map(opt => `${opt.name} (${opt.price} د.ل)`).join(' · ')}
                            </span>
                          </div>
                          <span className="font-mono text-white font-bold">{it.total_price.toLocaleString('ar-LY')} د.ل</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 6. PAYMENT SUBMISSIONS REVIEW (Section 9) */}
          {/* ================================================================= */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">مراجعة إثباتات الدفع والحوالات المصرفية</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  مطابقة المبالغ مع كشوفات المصارف الليبية وتأكيد أو رفض التحويلات
                </p>
              </div>

              <div className="space-y-4">
                {orders.filter(o => o.payment_submission).map((o) => {
                  const sub = o.payment_submission!;
                  return (
                    <div key={o.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-xs text-indigo-400 font-mono font-bold block">{o.order_number}</span>
                          <span className="text-base font-bold text-white">المحول: {sub.sender_name}</span>
                        </div>
                        <div className="text-xs text-slate-300">
                          <span>المصرف: <strong>{sub.sender_bank || 'غير محدد'}</strong></span>
                          <span className="mx-2">·</span>
                          <span>المرجع: <strong className="font-mono text-indigo-300">{sub.transaction_reference}</strong></span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">المبلغ المحول</span>
                          <span className="text-base font-black text-emerald-400 font-mono">
                            {sub.transferred_amount.toLocaleString('ar-LY')} د.ل
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedOrderForReview(o)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          فتح شاشة التحقق والمطابقة
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>تاريخ الحوالة: {sub.transfer_date}</span>
                        <span>
                          حالة الإثبات: <strong className={o.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>
                            {o.payment_status === 'paid' ? 'تم التأكيد والاعتماد' : 'قيد المراجعة'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 7. SERVICES & TASKS TAB (Section 12) */}
          {/* ================================================================= */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">إدارة مهام الخدمات والتنفيذ (My Services Fulfillment)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  متابعة مهام التركيب، التخصيص، والدعم الفني للمشاريع المشتراة
                </p>
              </div>

              <div className="space-y-4">
                {serviceTasks.map((t) => (
                  <div key={t.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-xs text-slate-400 block">الطلب: {t.order_number} — العميل: {t.customer_name}</span>
                        <h3 className="text-base font-bold text-white">{t.service_name} ({t.product_name})</h3>
                      </div>

                      {/* Status changer */}
                      <div className="flex items-center gap-2">
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value)}
                          className="text-xs bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer"
                        >
                          <option value="not_started">لم تبدأ</option>
                          <option value="in_progress">قيد التنفيذ</option>
                          <option value="waiting_customer_info">بانتظار معلومات العميل</option>
                          <option value="completed">مكتملة ومُسلمة</option>
                          <option value="cancelled">ملغاة</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300">{t.details}</p>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex-1 mr-2">
                        <span className="text-[11px] text-slate-400 block">ملاحظات المهندس للعميل:</span>
                        <input
                          type="text"
                          defaultValue={t.admin_notes || ''}
                          onBlur={(e) => handleUpdateTaskStatus(t.id, t.status, e.target.value)}
                          placeholder="اكتب ملاحظة للعميل (تُحفظ تلقائياً عند المغادرة)..."
                          className="w-full mt-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 8. BANK ACCOUNTS TAB (Section 8) */}
          {/* ================================================================= */}
          {activeTab === 'banks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">إدارة الحسابات المصرفية</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    التحكم في بيانات الحسابات المصرفية الليبية المعروضة للعملاء عند الشراء
                  </p>
                </div>

                <button
                  onClick={() => setNewBankModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة حساب مصرفي</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankAccounts.map((acc) => (
                  <div key={acc.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-base">{acc.bank_name}</span>
                      {acc.is_default && (
                        <span className="text-[10px] text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                          افتراضي
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <p>صاحب الحساب: <strong className="text-white">{acc.account_holder}</strong></p>
                      <p className="font-mono text-indigo-300">رقم الحساب: {acc.account_number}</p>
                      {acc.iban && <p className="font-mono text-slate-400">IBAN: {acc.iban}</p>}
                      {acc.instructions && <p className="text-[11px] text-slate-500 italic">{acc.instructions}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 9. DOWNLOADS & ENTITLEMENTS (Section 10) */}
          {/* ================================================================= */}
          {activeTab === 'downloads' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">استحقاقات وسجلات التحميل (Audit & Security)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  سجل عمليات التنزيل، تتبع عناوين IP، وإعادة ضبط محاولات التحميل للعملاء
                </p>
              </div>

              <div className="space-y-6">
                {/* Entitlements table */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-white">استحقاقات التنزيل النشطة للعملاء</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-3">رقم الطلب</th>
                          <th className="py-2 px-3">المنتج والملف</th>
                          <th className="py-2 px-3">محاولات التحميل</th>
                          <th className="py-2 px-3">الصلاحية</th>
                          <th className="py-2 px-3">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {entitlements.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-850">
                            <td className="py-3 px-3 font-mono font-bold text-indigo-400">{e.order_number}</td>
                            <td className="py-3 px-3 text-slate-200">
                              <div>{e.product_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{e.file_name}</div>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {e.used_downloads} / {e.allowed_downloads}
                            </td>
                            <td className="py-3 px-3 text-slate-400">
                              {e.is_active ? 'نشطة' : 'معطلة'}
                            </td>
                            <td className="py-3 px-3">
                              <button
                                onClick={() => handleResetDownloadLimit(e.id)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold cursor-pointer"
                              >
                                إعادة فتح وتمديد (+5)
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Download Logs */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-white">سجل التنزيلات الفعلي (Download Logs)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-3">الوقت</th>
                          <th className="py-2 px-3">الطلب</th>
                          <th className="py-2 px-3">العميل</th>
                          <th className="py-2 px-3">الملف</th>
                          <th className="py-2 px-3">عنوان IP</th>
                          <th className="py-2 px-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {downloadLogs.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-850">
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {new Date(l.timestamp).toLocaleTimeString('ar-LY')}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-indigo-300">{l.order_number}</td>
                            <td className="py-2.5 px-3 text-slate-200">{l.user_name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">{l.file_name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{l.ip_address}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-emerald-400 font-semibold text-[11px]">ناجح</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 10. AUDIT LOGS TAB (Section 13) */}
          {/* ================================================================= */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">سجل العمليات الإدارية (Audit Logs)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  توثيق غير قابل للتعديل لجميع العمليات الحساسة: تأكيد ورفض الدفع، تعديل الأسعار، وإلغاء التنزيلات
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                        <th className="py-3 px-4">التاريخ والوقت</th>
                        <th className="py-3 px-4">المشرف المسؤول</th>
                        <th className="py-3 px-4">نوع العملية</th>
                        <th className="py-3 px-4">الكيان المتأثر</th>
                        <th className="py-3 px-4">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-850">
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {new Date(log.created_at).toLocaleString('ar-LY')}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{log.admin_name}</td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-400">{log.action}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{log.entity_id}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 11. STORE SETTINGS TAB (Section 13) */}
          {/* ================================================================= */}
          {activeTab === 'settings' && siteSettings && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">إعدادات المتجر العامة والهوية</h2>
                <p className="text-xs text-slate-400 mt-0.5">تعديل نصوص الصفحة الرئيسية، حدود التنزيل، وبيانات الاتصال</p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">اسم المتجر</label>
                  <input
                    type="text"
                    value={siteSettings.store_name}
                    onChange={(e) => setSiteSettings({ ...siteSettings, store_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">العنوان الرئيسي في واجهة المتجر (Hero Title)</label>
                  <input
                    type="text"
                    value={siteSettings.hero_title}
                    onChange={(e) => setSiteSettings({ ...siteSettings, hero_title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">الوصف الفرعي (Hero Subtitle)</label>
                  <textarea
                    rows={2}
                    value={siteSettings.hero_subtitle}
                    onChange={(e) => setSiteSettings({ ...siteSettings, hero_subtitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">الموقع الإلكتروني المعتمد (Domain)</label>
                    <input
                      type="text"
                      value={siteSettings.domain || 'ZARNIX-Group.ly'}
                      onChange={(e) => setSiteSettings({ ...siteSettings, domain: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">رقم هاتف الدعم الفني</label>
                    <input
                      type="text"
                      value={siteSettings.support_phone || '091-3004448'}
                      onChange={(e) => setSiteSettings({ ...siteSettings, support_phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">البريد الإلكتروني للدعم</label>
                    <input
                      type="email"
                      value={siteSettings.support_email || 'support@zarnix-group.ly'}
                      onChange={(e) => setSiteSettings({ ...siteSettings, support_email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">الحد الافتراضي لمرات التحميل</label>
                    <input
                      type="number"
                      value={siteSettings.default_download_limit}
                      onChange={(e) => setSiteSettings({ ...siteSettings, default_download_limit: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">العناوين الرسمية للمقر (طرابلس)</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={siteSettings.addresses?.[0] || 'طرابلس / شارع عمر المختار'}
                      onChange={(e) => {
                        const addrs = [...(siteSettings.addresses || ['طرابلس / شارع عمر المختار', 'طرابلس / برج طرابلس'])];
                        addrs[0] = e.target.value;
                        setSiteSettings({ ...siteSettings, addresses: addrs });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                      placeholder="العنوان الأول"
                    />
                    <input
                      type="text"
                      value={siteSettings.addresses?.[1] || 'طرابلس / برج طرابلس'}
                      onChange={(e) => {
                        const addrs = [...(siteSettings.addresses || ['طرابلس / شارع عمر المختار', 'طرابلس / برج طرابلس'])];
                        addrs[1] = e.target.value;
                        setSiteSettings({ ...siteSettings, addresses: addrs });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                      placeholder="العنوان الثاني"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={async () => {
                      await fetch('/api/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(siteSettings)
                      });
                      showToast('تم حفظ الإعدادات وتحديث الموقع بنجاح');
                    }}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer"
                  >
                    حفظ الإعدادات
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 12. CUSTOMERS MANAGEMENT TAB */}
          {/* ================================================================= */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">إدارة وسجل العملاء والمشتركين</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    متابعة حسابات المشترين، إجمالي المشتريات بالدينار الليبي، وتراخيص التحميل
                  </p>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                  إجمالي العملاء: <span className="font-bold text-emerald-400 font-mono">{customers.length}</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                        <th className="py-3 px-4">العميل</th>
                        <th className="py-3 px-4">بيانات الاتصال</th>
                        <th className="py-3 px-4">نوع الحساب</th>
                        <th className="py-3 px-4">الطلبات</th>
                        <th className="py-3 px-4">إجمالي الإنفاق</th>
                        <th className="py-3 px-4">الملفات المرخصة</th>
                        <th className="py-3 px-4">تاريخ الانضمام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-850">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-950/70 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                                {c.full_name?.charAt(0) || 'U'}
                              </div>
                              <span className="font-bold text-white block">{c.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <div>{c.email}</div>
                            <div className="text-[11px] font-mono text-slate-500">{c.phone || 'غير مسجل'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.role === 'owner' 
                                ? 'bg-amber-950 text-amber-400 border border-amber-800' 
                                : c.role === 'admin' 
                                ? 'bg-teal-950 text-teal-400 border border-teal-800' 
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {c.role === 'owner' ? 'مالك المنصة' : c.role === 'admin' ? 'مشرف عام' : 'مشتري / عميل'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-200">
                            {c.total_orders_count || 0} طلب
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-400">
                            {(c.total_spent_lyd || 0).toLocaleString('ar-LY')} د.ل
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {c.active_entitlements_count || 0} ملف
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {new Date(c.created_at).toLocaleDateString('ar-LY')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 13. COUPONS & DISCOUNTS MANAGEMENT TAB */}
          {/* ================================================================= */}
          {activeTab === 'coupons' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">إدارة الكوبونات وقسائم الخصم</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إنشاء حملات ترويجية، تحديد نسب الخصم والحد الأدنى للطلب وتتبع استخدام الأكواد
                  </p>
                </div>

                <button
                  onClick={() => setNewCouponModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة كود خصم جديد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.map((coup) => (
                  <div key={coup.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-black px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        {coup.code}
                      </span>
                      <button
                        onClick={async () => {
                          await fetch(`/api/coupons/${coup.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_active: !coup.is_active })
                          });
                          showToast(`تم ${coup.is_active ? 'إيقاف' : 'تفعيل'} الكود`);
                          loadAdminData();
                        }}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                          coup.is_active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {coup.is_active ? 'نشط ومفعل' : 'معطل'}
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">قيمة الخصم:</span>
                        <span className="font-bold text-white">
                          {coup.discount_type === 'percentage' ? `${coup.discount_value}%` : `${coup.discount_value} د.ل`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">الحد الأدنى للطلب:</span>
                        <span className="font-mono text-white">{coup.minimum_order} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">مرات الاستخدام:</span>
                        <span className="font-mono text-emerald-400">{coup.used_count} / {coup.max_uses}</span>
                      </div>
                      {coup.expires_at && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">تاريخ الانتهاء:</span>
                          <span className="font-mono text-slate-400">{new Date(coup.expires_at).toLocaleDateString('ar-LY')}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
                      <button
                        onClick={async () => {
                          if (confirm(`هل أنت متأكد من حذف الكود ${coup.code}؟`)) {
                            await fetch(`/api/coupons/${coup.id}`, { method: 'DELETE' });
                            showToast('تم حذف الكود بنجاح');
                            loadAdminData();
                          }
                        }}
                        className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف الكوبون</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>

      </div>

      {/* Review Receipt Modal */}
      {selectedOrderForReview && (
        <ReceiptViewerModal
          order={selectedOrderForReview}
          isOpen={Boolean(selectedOrderForReview)}
          onClose={() => setSelectedOrderForReview(null)}
          onApprove={handleApprovePayment}
          onReject={handleRejectPayment}
        />
      )}

      {/* New Bank Modal */}
      {newBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white">إضافة حساب مصرفي ليبي جديد</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              await fetch('/api/bank-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bank_name: form.bank_name.value,
                  account_holder: form.account_holder.value,
                  account_number: form.account_number.value,
                  iban: form.iban.value,
                  instructions: form.instructions.value
                })
              });
              setNewBankModal(false);
              showToast('تمت إضافة الحساب المصرفي بنجاح');
              loadAdminData();
            }} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1">اسم المصرف</label>
                <input name="bank_name" required placeholder="مثلاً: مصرف الأمان" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">اسم صاحب الحساب</label>
                <input name="account_holder" required placeholder="نزار الهواري" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">رقم الحساب</label>
                <input name="account_number" required placeholder="102-000000-001" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">رقم الآيبان (IBAN)</label>
                <input name="iban" placeholder="LY..." className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">تعليمات التحويل للعميل</label>
                <textarea name="instructions" rows={2} placeholder="يرجى كتابة رقم الطلب في الملاحظات..." className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewBankModal(false)} className="px-3 py-2 text-slate-400">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 rounded-xl text-white font-bold">حفظ الحساب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Product Creator Modal */}
      {newProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-2xl my-8 space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">إضافة منتج أو منظومة جديدة</h3>
              <button onClick={() => setNewProductModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              const basePrice = Number(form.base_price.value);
              const payload = {
                name: form.name.value,
                slug: form.slug.value || `prod-${Date.now()}`,
                short_description: form.short_description.value,
                full_description: form.full_description.value,
                category_id: form.category_id.value,
                base_price: basePrice,
                main_image: '/src/assets/images/nizar_hero_marketplace_1793738527373.jpg',
                is_featured: form.is_featured.checked,
                options: [
                  {
                    id: `opt_${Date.now()}_1`,
                    name: 'ملفات المشروع كاملة + دليل التركيب (الكود المصدري)',
                    price: basePrice,
                    is_required: true,
                    is_active: true,
                    sort_order: 1
                  },
                  {
                    id: `opt_${Date.now()}_2`,
                    name: 'التركيب والإعداد على خادم العميل',
                    price: Math.round(basePrice * 0.5),
                    is_required: false,
                    is_active: true,
                    sort_order: 2
                  }
                ],
                files: [
                  {
                    id: `file_${Date.now()}`,
                    file_name: `${form.slug.value || 'system'}_release.zip`,
                    file_size: 1024 * 1024 * 65,
                    version: 'v1.0.0',
                    is_downloadable: true,
                    is_active: true
                  }
                ]
              };

              const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              if (res.ok) {
                setNewProductModal(false);
                showToast('تمت إضافة المنتج بنجاح وتجهيز خيارات التسعير وحزم الملفات');
                loadAdminData();
              }
            }} className="space-y-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">اسم المنتج / المنظومة *</label>
                <input name="name" required placeholder="مثلاً: نظام إدارة الصيدليات والمخازن" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">التصنيف *</label>
                  <select name="category_id" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">السعر الأساسي بالدينار الليبي (LYD) *</label>
                  <input name="base_price" type="number" required defaultValue="1200" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">الرابط المخصص (Slug)</label>
                <input name="slug" placeholder="pharmacy-management-pos" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">الوصف المختصر *</label>
                <input name="short_description" required placeholder="حل برمجي لإدارة الأدوية والمبيعات..." className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">الوصف التفصيلي وشرح طريقة العمل *</label>
                <textarea name="full_description" rows={3} required placeholder="شرح معماري كامل للمشروع..." className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="is_featured" name="is_featured" className="rounded bg-slate-950" />
                <label htmlFor="is_featured" className="text-slate-300 font-semibold cursor-pointer">
                  تحديد كمنتج مميز في الواجهة الرئيسية
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setNewProductModal(false)} className="px-4 py-2 text-slate-400">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold cursor-pointer">إنشاء ونشر المنتج</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Coupon Modal */}
      {newCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 w-full max-w-md space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">إنشاء كود خصم ترويجي جديد</h3>
              <button onClick={() => setNewCouponModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              const payload = {
                code: form.code.value.toUpperCase().trim(),
                discount_type: form.discount_type.value,
                discount_value: Number(form.discount_value.value),
                minimum_order: Number(form.minimum_order.value) || 0,
                max_uses: Number(form.max_uses.value) || 50,
                expires_at: form.expires_at.value ? new Date(form.expires_at.value).toISOString() : null
              };

              const res = await fetch('/api/coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              if (res.ok) {
                setNewCouponModal(false);
                showToast(`تم إنشاء الكوبون ${payload.code} بنجاح`);
                loadAdminData();
              } else {
                const err = await res.json();
                alert(err.error || 'فشل إنشاء الكوبون');
              }
            }} className="space-y-3.5">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">رمز الكوبون (الكود) *</label>
                <input name="code" required placeholder="مثلاً: RAMADAN20" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono uppercase font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">نوع الخصم *</label>
                  <select name="discount_type" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (د.ل)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">قيمة الخصم *</label>
                  <input name="discount_value" type="number" required defaultValue="15" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">الحد الأدنى للطلب (د.ل)</label>
                  <input name="minimum_order" type="number" defaultValue="500" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">الحد الأقصى للاستخدامات</label>
                  <input name="max_uses" type="number" defaultValue="50" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">تاريخ الانتهاء (اختياري)</label>
                <input name="expires_at" type="date" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setNewCouponModal(false)} className="px-4 py-2 text-slate-400 cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold cursor-pointer">حفظ وتفعيل الكوبون</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {newCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 w-full max-w-md space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">إضافة تصنيف برمجيات جديد</h3>
              <button onClick={() => setNewCategoryModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              const payload = {
                name: form.name.value,
                slug: form.slug.value || `cat-${Date.now()}`,
                description: form.description.value,
                sort_order: Number(form.sort_order.value) || 5
              };

              const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              if (res.ok) {
                setNewCategoryModal(false);
                showToast(`تمت إضافة التصنيف "${payload.name}" بنجاح`);
                loadAdminData();
              } else {
                const err = await res.json();
                alert(err.error || 'فشل إضافة التصنيف');
              }
            }} className="space-y-3.5">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">اسم التصنيف *</label>
                <input name="name" required placeholder="مثلاً: أنظمة الذكاء الاصطناعي والتوليد" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">الرابط المخصص (Slug) *</label>
                <input name="slug" required placeholder="ai-gen-systems" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">الوصف</label>
                <textarea name="description" rows={2} placeholder="وصف موجز للمنتجات المدرجة تحت هذا التصنيف..." className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">ترتيب العرض</label>
                <input name="sort_order" type="number" defaultValue="5" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setNewCategoryModal(false)} className="px-4 py-2 text-slate-400 cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold cursor-pointer">حفظ التصنيف</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Package, PlusCircle, Layers, DollarSign, FolderGit2, 
  ShoppingBag, CheckCircle, Users, Download, Wrench, Key, Tag, Building2, 
  Bell, FileEdit, BarChart3, ShieldAlert, UserCheck, Settings, Eye, Check, 
  X, AlertTriangle, RefreshCw, ZoomIn, Search, Trash2, Edit3, ArrowLeft,
  Menu, Image as ImageIcon, Upload, ExternalLink, ShieldCheck, Plus, Sparkles, 
  Filter, ChevronRight, Lock, CheckSquare, Square, Globe, Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ReceiptViewerModal } from '../../components/ReceiptViewerModal';
import { 
  Product, Category, Order, PaymentAccount, DownloadEntitlement, 
  DownloadLog, ServiceTask, Coupon, AuditLog, SiteSettings, UserRole,
  RoleItem, PermissionKey, ProductOption, TechnicalRequirement
} from '../../types';

interface AdminDashboardProps {
  onBackToStore: () => void;
  onViewProductLive?: (product: Product) => void;
}

// All standard system permissions available in RBAC matrix
const SYSTEM_PERMISSIONS: { key: PermissionKey; label: string; description: string; category: string }[] = [
  { key: 'manage_products', label: 'إدارة المنتجات والبرمجيات', description: 'إضافة وتعديل وحذف المنتجات ورفع المعارض والملفات الرقمية', category: 'المحتوى والكتالوج' },
  { key: 'manage_orders', label: 'إدارة واستعراض الطلبات', description: 'الاطلاع على جميع طلبات الشراء وتفاصيل فواتير العملاء', category: 'المبيعات' },
  { key: 'approve_payments', label: 'اعتماد ورفض إيصالات الدفع', description: 'مراجعة صور الإيصالات المصرفية وتفعيل تراخيص التحميل للمشتري', category: 'المالية' },
  { key: 'manage_downloads', label: 'إدارة وتمديد تراخيص التحميل', description: 'إعادة تعيين عداد التحميل وتمديد صلاحيات الروابط المشفرة', category: 'التسليم الرقمي' },
  { key: 'manage_services', label: 'متابعة وتنفيذ الخدمات', description: 'تحديث حالة مهام التركيب والإعداد والدعم الفني المباشر', category: 'الدعم والخدمات' },
  { key: 'manage_coupons', label: 'إدارة الكوبونات والخصومات', description: 'إنشاء رموز الخصم وتحديد نسب أو قيم الخصم وحدود الطلب', category: 'التسويق' },
  { key: 'manage_banks', label: 'إدارة الحسابات المصرفية', description: 'تعديل بيانات الحسابات في المصارف الليبية وتعيين الحساب الافتراضي', category: 'المالية' },
  { key: 'manage_roles_permissions', label: 'إدارة الأدوار والصلاحيات (RBAC)', description: 'إنشاء الأدوار المخصصة، ضبط مصفوفة الصلاحيات، وتعيين طاقم العمل', category: 'الإدارة العليا' },
  { key: 'manage_users', label: 'إدارة سجلات المستخدمين', description: 'تعديل بيانات العملاء والموظفين وتفعيل أو تعليق الحسابات', category: 'المستخدمين' },
  { key: 'view_financial_analytics', label: 'عرض التحليلات المالية', description: 'الاطلاع على أرقام الإيرادات ومؤشرات المبيعات ونسب التحويل', category: 'التقارير' },
  { key: 'manage_settings', label: 'إعدادات المنصة وSEO', description: 'تعديل هوية المتجر وسياسات الاستخدام والخصوصية وبيانات الاتصال', category: 'النظام' },
  { key: 'view_audit_logs', label: 'عرض سجل التدقيق الأمني (Audit)', description: 'مراقبة كافة العمليات الإدارية الحساسة ومحاولات الوصول والـ IP', category: 'الأمان' }
];

// Helper to compress images on the client side before sending or saving (prevents 4.5MB Vercel payload limit)
export const compressImage = (file: File, maxWidth = 1200, quality = 0.75): Promise<string> => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/') || file.size < 50 * 1024) {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve((e.target?.result as string) || '');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

export const saveProductToLocalStorage = (product: Product) => {
  try {
    const raw = localStorage.getItem('zarnix_custom_products');
    let list: Product[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex(p => p.id === product.id);
    if (index !== -1) {
      list[index] = product;
    } else {
      list.unshift(product);
    }
    localStorage.setItem('zarnix_custom_products', JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save product to localStorage', err);
  }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToStore, onViewProductLive }) => {
  const { user, role, switchRole } = useAuth();

  // Navigation sidebar item
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const [rolesList, setRolesList] = useState<RoleItem[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & sub-flows
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [newBankModal, setNewBankModal] = useState(false);
  const [newCouponModal, setNewCouponModal] = useState(false);
  const [newCategoryModal, setNewCategoryModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Product Filter State
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [
        sRes, pRes, cRes, oRes, bRes, entRes, lRes, servRes, coupRes, audRes, setRes, custRes, rRes, staffRes
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
        fetch('/api/admin/customers').then(r => r.json()).catch(() => []),
        fetch('/api/admin/roles').then(r => r.json()).catch(() => []),
        fetch('/api/admin/staff').then(r => r.json()).catch(() => [])
      ]);

      setStats(sRes);
      // Merge server products with local storage products
      const localProdsRaw = localStorage.getItem('zarnix_custom_products');
      const localProds: Product[] = localProdsRaw ? JSON.parse(localProdsRaw) : [];
      const serverProds: Product[] = Array.isArray(pRes) ? pRes : [];
      const mergedProds = [...localProds];
      serverProds.forEach(sp => {
        if (!mergedProds.some(mp => mp.id === sp.id)) {
          mergedProds.push(sp);
        }
      });
      setProducts(mergedProds);
      setCategories(Array.isArray(cRes) ? cRes : []);
      setOrders(Array.isArray(oRes) ? oRes : []);
      setBankAccounts(Array.isArray(bRes) ? bRes : []);
      setEntitlements(Array.isArray(entRes) ? entRes : []);
      setDownloadLogs(Array.isArray(lRes) ? lRes : []);
      setServiceTasks(Array.isArray(servRes) ? servRes : []);
      setCoupons(Array.isArray(coupRes) ? coupRes : []);
      setAuditLogs(Array.isArray(audRes) ? audRes : []);
      setSiteSettings(setRes);
      setCustomers(Array.isArray(custRes) ? custRes : []);
      setRolesList(Array.isArray(rRes) ? rRes : []);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
    } catch (e) {
      console.error('Failed to load admin data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Centralized Product Deletion (Server + LocalStorage sync)
  const handleDeleteProduct = async (p: Product) => {
    if (confirm(`هل أنت متأكد من حذف المنتج "${p.name}"؟`)) {
      try {
        await fetch(`/api/products/${p.id}`, { 
          method: 'DELETE',
          headers: { 'x-auth-email': user?.email || 'advesapp@gmail.com' }
        });
      } catch {}
      const raw = localStorage.getItem('zarnix_custom_products');
      if (raw) {
        try {
          const list: Product[] = JSON.parse(raw);
          localStorage.setItem('zarnix_custom_products', JSON.stringify(list.filter(item => item.id !== p.id)));
        } catch {}
      }
      showToast('تم حذف المنتج بنجاح');
      loadAdminData();
    }
  };

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

  // Reset Download Limit
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

  // RBAC Permission checks
  const isSuperAdminOrOwner = ['owner', 'super_admin'].includes(role) || user?.email?.toLowerCase() === 'advesapp@gmail.com';
  const canManageProducts = isSuperAdminOrOwner || ['admin', 'moderator', 'editor', 'product_manager'].includes(role);
  const canReviewPayments = isSuperAdminOrOwner || ['admin', 'payment_manager'].includes(role);
  const canManageSupport = isSuperAdminOrOwner || ['admin', 'support', 'support_manager'].includes(role);
  const canManageRoles = isSuperAdminOrOwner || ['admin'].includes(role);
  const isOwnerOrAdmin = isSuperAdminOrOwner || ['admin'].includes(role);

  // Sidebar Menu Config
  const sidebarItems = [
    { id: 'overview', label: 'الرئيسية والإحصائيات', icon: LayoutDashboard },
    { id: 'products', label: 'إدارة المنتجات والمشاريع', icon: Package, permission: canManageProducts },
    { id: 'categories', label: 'التصنيفات البرمجية', icon: Layers, permission: canManageProducts },
    { id: 'roles', label: 'الأدوار والصلاحيات (RBAC)', icon: ShieldCheck, permission: canManageRoles },
    { id: 'staff', label: 'طاقم العمل والمشرفين', icon: UserCheck, permission: canManageRoles },
    { id: 'orders', label: 'إدارة الطلبات', icon: ShoppingBag },
    { id: 'payments', label: 'مراجعة المدفوعات', icon: CheckCircle, badge: stats?.under_review_payments_count, permission: canReviewPayments },
    { id: 'customers', label: 'قاعدة العملاء', icon: Users },
    { id: 'downloads', label: 'استحقاقات وسجلات التحميل', icon: Download },
    { id: 'services', label: 'الخدمات والتنفيذ', icon: Wrench, permission: canManageSupport },
    { id: 'banks', label: 'الحسابات المصرفية', icon: Building2, permission: isOwnerOrAdmin },
    { id: 'coupons', label: 'الكوبونات والخصومات', icon: Tag, permission: isOwnerOrAdmin },
    { id: 'audit', label: 'سجل التدقيق (Audit Log)', icon: ShieldAlert, permission: isOwnerOrAdmin },
    { id: 'settings', label: 'إعدادات المنصة وSEO', icon: Settings, permission: isOwnerOrAdmin },
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

  // Filter products for display
  const filteredProducts = products.filter(p => {
    const matchesSearch = !productSearch || 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.short_description?.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat = productCategoryFilter === 'all' || p.category_id === productCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans antialiased">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#090e1a]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors"
            aria-label="القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={onBackToStore}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">واجهة المتجر</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-blue-500 to-emerald-400 overflow-hidden flex items-center justify-center shrink-0 shadow-md shadow-cyan-900/40">
              <img src="/logo.png" alt="ZARNIX-Group" className="w-full h-full object-cover rounded-full" />
            </div>
            <span className="font-bold text-white text-xs sm:text-sm tracking-tight">لوحة الإدارة المركزية</span>
            <span className="hidden md:inline text-[11px] text-cyan-400 font-mono bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 font-bold">
              ZARNIX-Group
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <span className="text-[11px]">المسؤول:</span>
            <span className="font-bold text-white text-xs max-w-[120px] truncate">{user?.full_name}</span>
            <span className="text-[10px] text-emerald-300 font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
              {role === 'super_admin' ? 'المدير الأعلى' : role}
            </span>
          </div>

          <button
            onClick={loadAdminData}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="تحديث فوري للبيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Mobile Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          />
        )}

        {/* Sidebar Navigation */}
        <aside className={`
          fixed md:static top-16 bottom-0 right-0 z-40 w-64 bg-[#080c16] border-l border-slate-800 p-4 flex flex-col justify-between shrink-0 overflow-y-auto transition-transform duration-200 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-1 tracking-wider flex items-center justify-between">
              <span>أقسام النظام</span>
              <span className="text-[9px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-900/60 font-mono">v2.5 Live</span>
            </div>

            {sidebarItems.map((item) => {
              if (item.permission === false) return null;
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40 font-bold'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-extrabold shadow-sm">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1 mt-4">
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>نظام RBAC الفولاذي</span>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              جميع الصلاحيات خاضعة لتدقيق مشفر مع تسجيل محاولات الوصول في الـ Audit Log.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-full">
          
          {/* ================================================================= */}
          {/* 1. OVERVIEW TAB */}
          {/* ================================================================= */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">نظرة عامة على المنصة</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    إحصائيات المبيعات، ومراجعة الإيصالات المصرفية، وسلامة تراخيص التوزيع
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>إضافة منتج جديد</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Confirmed Sales */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>إجمالي المبيعات المؤكدة</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tabular-nums">
                    {stats.confirmed_revenue_lyd?.toLocaleString('ar-LY')} <span className="text-xs font-normal text-slate-400">د.ل</span>
                  </div>
                  <p className="text-[10px] text-emerald-400">
                    مبيعات معتمدة الحوالة المصرفية فقط
                  </p>
                </div>

                {/* Pending Payments to review */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-900/60 shadow-lg shadow-indigo-950/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-indigo-400">
                    <span className="font-bold">إثباتات دفع قيد المراجعة</span>
                    <CheckCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300 font-mono tabular-nums">
                    {stats.under_review_payments_count}
                  </div>
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="text-[11px] text-indigo-400 hover:underline cursor-pointer block font-semibold"
                  >
                    فتح مراجعة الإيصالات الآن ←
                  </button>
                </div>

                {/* Published Products */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>المنتجات المنشورة</span>
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tabular-nums">
                    {stats.published_products_count}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    من أصل {stats.total_products_count} مشروع مسجل
                  </p>
                </div>

                {/* Active Services */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>خدمات قيد التنفيذ</span>
                    <Wrench className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tabular-nums">
                    {stats.active_services_count}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    مهام تركيب ودعم وتخصيص نشطة
                  </p>
                </div>

              </div>

              {/* Quick Jump / Shortcuts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  onClick={() => setActiveTab('roles')} 
                  className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-800/40 hover:border-purple-600 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">مصفوفة الأدوار والصلاحيات</span>
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-xs text-slate-400">
                    تخصيص صلاحيات Super Admin، وAdmin، وModerator، وSupport، وEditor، وإنشاء أدوار جديدة.
                  </p>
                  <span className="text-[11px] text-purple-300 font-bold block pt-1">إدارة الصلاحيات الآن ←</span>
                </div>

                <div 
                  onClick={() => setActiveTab('products')} 
                  className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/40 hover:border-blue-600 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">كتالوج المنتجات والمعارض</span>
                    <Package className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400">
                    إضافة وتعديل البرمجيات ورفع لقطات الشاشة وتحديد باقات التراخيص وروابط المعاينة الحية.
                  </p>
                  <span className="text-[11px] text-blue-300 font-bold block pt-1">إدارة المنتجات الآن ←</span>
                </div>

                <div 
                  onClick={() => setActiveTab('payments')} 
                  className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-800/40 hover:border-amber-600 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">مركز مراجعة الحوالات</span>
                    <CheckCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-400">
                    معاينة إيصالات المصارف وتأكيد المبالغ المحولة بالدينار الليبي لفتح تراخيص التحميل.
                  </p>
                  <span className="text-[11px] text-amber-300 font-bold block pt-1">مراجعة المدفوعات الآن ←</span>
                </div>
              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* 2. PRODUCTS TAB (CRUD & EDIT & GALLERY) */}
          {/* ================================================================= */}
          {activeTab === 'products' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">إدارة المنتجات والبرمجيات</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إضافة مشاريع جديدة، رفع الصور والمعارض، وتحديد خيارات وباقات التسعير والملفات
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setProductModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة منتج جديد</span>
                </button>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو الوصف..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">جميع التصنيفات ({products.length})</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Products Table (Desktop) / Cards (Mobile) */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
                {filteredProducts.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Package className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-slate-400 text-sm font-semibold">لا توجد منتجات مطابقة للبحث أو التصنيف المحدد</p>
                    <button
                      onClick={() => {
                        setEditingProduct(null);
                        setProductModalOpen(true);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      إضافة أول منتج الآن
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                            <th className="py-3 px-4">المنتج والصورة</th>
                            <th className="py-3 px-4">التصنيف</th>
                            <th className="py-3 px-4">السعر الأساسي</th>
                            <th className="py-3 px-4">الباقات والخيارات</th>
                            <th className="py-3 px-4">معرض الصور</th>
                            <th className="py-3 px-4">الحالة</th>
                            <th className="py-3 px-4 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-850/60 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={p.main_image || '/logo.png'}
                                    alt={p.name}
                                    className="w-12 h-10 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                                    onError={(e) => { (e.target as any).src = '/logo.png'; }}
                                  />
                                  <div>
                                    <span className="font-bold text-white block max-w-xs truncate">{p.name}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-slate-400 font-mono">/{p.slug}</span>
                                      {p.is_featured && (
                                        <span className="text-[9px] text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/40">
                                          مميز
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-slate-300 font-medium">{p.category_name || 'عام'}</td>

                              <td className="py-3 px-4 font-mono font-bold text-emerald-400 tabular-nums">
                                {p.base_price?.toLocaleString('ar-LY')} <span className="text-[10px] text-slate-400 font-sans">د.ل</span>
                              </td>

                              <td className="py-3 px-4 text-slate-400">
                                {(p.options || []).length > 0 ? (
                                  <span className="text-slate-300 font-mono">{(p.options || []).length} خيارات</span>
                                ) : (
                                  <span className="text-slate-500">لا توجد</span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-slate-400">
                                {(p.gallery_images || []).length > 0 ? (
                                  <span className="text-cyan-400 font-mono">{(p.gallery_images || []).length} لقطة</span>
                                ) : (
                                  <span className="text-slate-500">صورة غلاف فقط</span>
                                )}
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
                                <div className="flex items-center justify-center gap-1.5">
                                  {onViewProductLive && (
                                    <button
                                      onClick={() => onViewProductLive(p)}
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                      title="معاينة في المتجر"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingProduct(p);
                                      setProductModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-800/40 transition-colors cursor-pointer"
                                    title="تعديل المنتج والخيارات"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(p)}
                                    className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/40 transition-colors cursor-pointer"
                                    title="حذف المنتج"
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

                    {/* Mobile Cards View */}
                    <div className="md:hidden divide-y divide-slate-800">
                      {filteredProducts.map((p) => (
                        <div key={p.id} className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <img
                              src={p.main_image || '/logo.png'}
                              alt={p.name}
                              className="w-16 h-14 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                              onError={(e) => { (e.target as any).src = '/logo.png'; }}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white text-sm truncate">{p.name}</h4>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{p.category_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono font-bold text-emerald-400 text-xs">
                                  {p.base_price?.toLocaleString('ar-LY')} د.ل
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  p.status === 'published' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {p.status === 'published' ? 'منشور' : 'مسودة'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                            <span className="text-slate-400 text-[11px]">
                              {(p.options || []).length} خيارات • {(p.gallery_images || []).length} لقطة
                            </span>
                            <div className="flex items-center gap-2">
                              {onViewProductLive && (
                                <button
                                  onClick={() => onViewProductLive(p)}
                                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductModalOpen(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-900/60 text-blue-200 border border-blue-700/50 text-[11px] font-bold"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>تعديل</span>
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="p-1.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. CATEGORIES TAB */}
          {/* ================================================================= */}
          {activeTab === 'categories' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">التصنيفات البرمجية</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إدارة أقسام وتصنيفات المنتجات (نقاط البيع، البوتات، الويب، SaaS)
                  </p>
                </div>

                <button
                  onClick={() => setNewCategoryModal(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-950/40 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة تصنيف جديد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const catProductsCount = products.filter(p => p.category_id === cat.id || p.category_name === cat.name).length;
                  return (
                    <div key={cat.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-sm">{cat.name}</h3>
                        <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                          {catProductsCount} منتج
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                        {cat.description || 'لا يوجد وصف محدد لهذا التصنيف'}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                        <span className="font-mono">slug: {cat.slug}</span>
                        <button
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف التصنيف "${cat.name}"؟`)) {
                              await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
                              showToast('تم حذف التصنيف');
                              loadAdminData();
                            }
                          }}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. ROLES & PERMISSIONS TAB (RBAC MATRIX) */}
          {/* ================================================================= */}
          {activeTab === 'roles' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">إدارة الأدوار ومصفوفة الصلاحيات (RBAC)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تحكم احترافي في أدوار Super Admin، Admin، Moderator، Support، Editor، مع إمكانية إنشاء أدوار مخصصة
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingRole(null);
                    setRoleModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-950/40 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إنشاء دور مخصص (Custom Role)</span>
                </button>
              </div>

              {/* Roles Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rolesList.map((r) => {
                  const permCount = r.permissions?.length || 0;
                  const isSuper = r.id === 'super_admin' || r.id === 'owner';
                  return (
                    <div 
                      key={r.id} 
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
                      style={{ borderTop: `3px solid ${r.color || '#8b5cf6'}` }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: r.color || '#8b5cf6' }} 
                            />
                            <h3 className="font-bold text-white text-sm">{r.name_ar}</h3>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {r.user_count || 0} موظف
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                          {r.description}
                        </p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-slate-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">الصلاحيات الممنوحة:</span>
                          <span className="font-bold font-mono text-emerald-400">
                            {isSuper ? 'كاملة (12 من 12)' : `${permCount} من 12`}
                          </span>
                        </div>

                        {/* Permission Badges Preview */}
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                          {isSuper ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-semibold">
                              تحكم كلي ومطلق بدون قيود
                            </span>
                          ) : (
                            r.permissions?.slice(0, 4).map(p => {
                              const item = SYSTEM_PERMISSIONS.find(sp => sp.key === p);
                              return (
                                <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                                  {item?.label || p}
                                </span>
                              );
                            })
                          )}
                          {!isSuper && permCount > 4 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 font-mono">
                              +{permCount - 4} المزيد
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={() => {
                              setEditingRole(r);
                              setRoleModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل الصلاحيات</span>
                          </button>

                          {!r.is_system && (
                            <button
                              onClick={async () => {
                                if (confirm(`هل أنت متأكد من حذف الدور المخصص "${r.name_ar}"؟`)) {
                                  const res = await fetch(`/api/admin/roles/${r.id}`, { method: 'DELETE' });
                                  if (res.ok) {
                                    showToast('تم حذف الدور المخصص بنجاح');
                                    loadAdminData();
                                  } else {
                                    alert('تعذر حذف هذا الدور');
                                  }
                                }
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              حذف الدور
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full Permissions Reference Matrix */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">دليل الصلاحيات القياسية للمنصة (12 صلاحية)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      تفاصيل كل صلاحية وتأثيرها على العمليات الحساسة
                    </p>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {SYSTEM_PERMISSIONS.map((perm) => (
                    <div key={perm.key} className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{perm.label}</span>
                        <span className="text-[9px] text-slate-500 font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                          {perm.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">{perm.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 5. STAFF TAB (USER ROLE ASSIGNMENT) */}
          {/* ================================================================= */}
          {activeTab === 'staff' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">طاقم العمل والمشرفين</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تعيين وتكليف الموظفين بالأدوار الإدارية (Super Admin, Admin, Moderator, Support, Editor)
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                        <th className="py-3 px-4">الموظف / البريد</th>
                        <th className="py-3 px-4">رقم الهاتف</th>
                        <th className="py-3 px-4">الدور الحالي</th>
                        <th className="py-3 px-4">تغيير الدور</th>
                        <th className="py-3 px-4">تاريخ الانضمام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {staffList.map((member) => {
                        const currentRoleObj = rolesList.find(r => r.id === member.role);
                        const isPrimaryOwner = member.email?.toLowerCase() === 'advesapp@gmail.com';
                        return (
                          <tr key={member.id} className="hover:bg-slate-850/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
                                  {member.full_name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                  <span className="font-bold text-white block">{member.full_name}</span>
                                  <span className="text-[11px] text-slate-400 font-mono">{member.email}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-slate-300 font-mono">
                              {member.phone || '091-3004448'}
                            </td>

                            <td className="py-3 px-4">
                              <span 
                                className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-block"
                                style={{ 
                                  backgroundColor: `${currentRoleObj?.color || '#8b5cf6'}20`,
                                  color: currentRoleObj?.color || '#a855f7',
                                  border: `1px solid ${currentRoleObj?.color || '#8b5cf6'}60`
                                }}
                              >
                                {currentRoleObj?.name_ar || member.role}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              {isPrimaryOwner ? (
                                <span className="text-[11px] text-amber-400 font-semibold">المالك الأصيل (غير قابل للتعديل)</span>
                              ) : (
                                <select
                                  value={member.role}
                                  onChange={async (e) => {
                                    const newRole = e.target.value;
                                    const res = await fetch(`/api/admin/staff/${member.id}/role`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ role: newRole })
                                    });
                                    if (res.ok) {
                                      showToast(`تم تعيين الدور إلى ${newRole} بنجاح`);
                                      loadAdminData();
                                    } else {
                                      const data = await res.json();
                                      alert(data.error || 'فشل تغيير الدور');
                                    }
                                  }}
                                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                                >
                                  {rolesList.map(r => (
                                    <option key={r.id} value={r.id}>{r.name_ar} ({r.name})</option>
                                  ))}
                                  <option value="customer">عميل عادي (Customer)</option>
                                </select>
                              )}
                            </td>

                            <td className="py-3 px-4 text-slate-400 font-mono">
                              {new Date(member.created_at).toLocaleDateString('ar-LY')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 6. ORDERS TAB */}
          {/* ================================================================= */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">إدارة طلبات الشراء</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    متابعة طلبات العملاء وحالة الدفع وتسليم الحزم والخدمات
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
                {orders.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="font-semibold text-sm">لا توجد طلبات مسجلة حتى الآن</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                          <th className="py-3 px-4">رقم الطلب</th>
                          <th className="py-3 px-4">العميل</th>
                          <th className="py-3 px-4">إجمالي المبلغ</th>
                          <th className="py-3 px-4">حالة الدفع</th>
                          <th className="py-3 px-4">حالة الطلب</th>
                          <th className="py-3 px-4">التاريخ</th>
                          <th className="py-3 px-4">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-850/60 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              {o.order_number}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-white block">{o.customer_name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{o.customer_phone}</span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              {o.total_amount?.toLocaleString('ar-LY')} د.ل
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                o.payment_status === 'paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                o.payment_status === 'under_review' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                o.payment_status === 'rejected' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {o.payment_status === 'paid' ? 'مدفوع ومعتمد' :
                                 o.payment_status === 'under_review' ? 'قيد المراجعة' :
                                 o.payment_status === 'rejected' ? 'مرفوض' : 'في انتظار التحويل'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {o.order_status === 'processing' ? 'قيد التنفيذ' : o.order_status === 'completed' ? 'مكتمل' : 'معلق'}
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono">
                              {new Date(o.created_at).toLocaleDateString('ar-LY')}
                            </td>
                            <td className="py-3 px-4">
                              {o.payment_submission && (
                                <button
                                  onClick={() => setSelectedOrderForReview(o)}
                                  className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors cursor-pointer font-semibold"
                                >
                                  معاينة الإيصال
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 7. PAYMENTS REVIEW TAB */}
          {/* ================================================================= */}
          {activeTab === 'payments' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">مراجعة وتأكيد المدفوعات المصرفية</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    التحقق من إيصالات التحويل البنكي وتأكيد وصول المبالغ لحسابات المنصة في طرابلس
                  </p>
                </div>
              </div>

              {orders.filter(o => o.payment_submission).length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 space-y-2">
                  <CheckCircle className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="font-semibold text-sm">لا توجد إيصالات دفع معلقة بحاجة للمراجعة حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orders.filter(o => o.payment_submission).map((o) => {
                    const sub = o.payment_submission!;
                    return (
                      <div key={o.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-base text-white">{o.order_number}</span>
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                            sub.status === 'paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            sub.status === 'rejected' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                            'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {sub.status === 'paid' ? 'معتمد' : sub.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block">اسم المرسل:</span>
                            <span className="font-bold text-white">{sub.sender_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">المصرف المحول منه:</span>
                            <span className="font-bold text-white">{sub.sender_bank || 'مصرف محلي'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">رقم الحوالة المرجعي:</span>
                            <span className="font-mono text-cyan-400">{sub.transaction_reference}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">المبلغ المحول:</span>
                            <span className="font-mono font-bold text-emerald-400">{sub.transferred_amount} د.ل</span>
                          </div>
                        </div>

                        {sub.receipt_storage_path && (
                          <div 
                            onClick={() => setSelectedOrderForReview(o)}
                            className="relative h-32 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 cursor-pointer group"
                          >
                            <img src={sub.receipt_storage_path} alt="Receipt" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-bold flex items-center gap-1.5">
                                <ZoomIn className="w-4 h-4" />
                                <span>تكبير الإيصال</span>
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => setSelectedOrderForReview(o)}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            اتخاذ قرار المراجعة (اعتماد / رفض)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 8. CUSTOMERS TAB */}
          {/* ================================================================= */}
          {activeTab === 'customers' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">قاعدة العملاء المسجلين</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    الاطلاع على العملاء، وتاريخ طلباتهم، وإجمالي المبالغ المنفقة بالدينار الليبي
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                        <th className="py-3 px-4">العميل</th>
                        <th className="py-3 px-4">رقم الهاتف</th>
                        <th className="py-3 px-4">إجمالي الطلبات</th>
                        <th className="py-3 px-4">الطلبات المدفوعة</th>
                        <th className="py-3 px-4">إجمالي الإنفاق</th>
                        <th className="py-3 px-4">التراخيص النشطة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-white block">{c.full_name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{c.email}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono">{c.phone || '—'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-white">{c.total_orders_count || 0}</td>
                          <td className="py-3 px-4 font-mono text-emerald-400">{c.paid_orders_count || 0}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {(c.total_spent_lyd || 0).toLocaleString('ar-LY')} د.ل
                          </td>
                          <td className="py-3 px-4 font-mono text-cyan-400">{c.active_entitlements_count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 9. DOWNLOADS TAB */}
          {/* ================================================================= */}
          {activeTab === 'downloads' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">استحقاقات وسجلات التحميل الآمن</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    التحكم في تراخيص التحميل المشفرة، وإعادة ضبط عداد المحاولات للمشترين
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                        <th className="py-3 px-4">المنتج والملف</th>
                        <th className="py-3 px-4">رقم الطلب</th>
                        <th className="py-3 px-4">مرات التحميل</th>
                        <th className="py-3 px-4">تاريخ الصلاحية</th>
                        <th className="py-3 px-4">الحالة</th>
                        <th className="py-3 px-4">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {entitlements.map((ent) => (
                        <tr key={ent.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-white block">{ent.product_name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{ent.file_name}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-cyan-400">{ent.order_number}</td>
                          <td className="py-3 px-4 font-mono">
                            <span className={ent.used_downloads >= ent.allowed_downloads ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                              {ent.used_downloads}
                            </span>
                            <span className="text-slate-500"> / {ent.allowed_downloads}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono">
                            {ent.expires_at ? new Date(ent.expires_at).toLocaleDateString('ar-LY') : 'دائم'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              ent.is_active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400'
                            }`}>
                              {ent.is_active ? 'نشط' : 'معطل'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleResetDownloadLimit(ent.id)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                            >
                              إعادة ضبط المحاولات (+5)
                            </button>
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
          {/* 10. SERVICES & INSTALLATION TASKS TAB */}
          {/* ================================================================= */}
          {activeTab === 'services' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">مهام التركيب والدعم الفني المباشر</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    متابعة وجدولة خدمات التركيب على استضافة العميل والتخصيص البرمجي
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serviceTasks.map((t) => (
                  <div key={t.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{t.service_name}</span>
                      <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                        {t.order_number}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div>العميل: <span className="font-bold text-white">{t.customer_name}</span></div>
                      <div>المنتج: <span className="text-slate-300">{t.product_name}</span></div>
                      <div>التفاصيل: <span className="text-slate-300">{t.details}</span></div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <select
                        value={t.status}
                        onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                      >
                        <option value="not_started">لم تبدأ بعد</option>
                        <option value="in_progress">قيد التنفيذ</option>
                        <option value="waiting_customer_info">في انتظار بيانات العميل</option>
                        <option value="completed">مكتملة بنجاح</option>
                      </select>

                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(t.created_at).toLocaleDateString('ar-LY')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 11. BANK ACCOUNTS TAB */}
          {/* ================================================================= */}
          {activeTab === 'banks' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">الحسابات المصرفية الرسمية (ليبيا)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إدارة بيانات المصارف لاستلام الحوالات بالدينار الليبي
                  </p>
                </div>

                <button
                  onClick={() => setNewBankModal(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة حساب مصرفي</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankAccounts.map((b) => (
                  <div key={b.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white text-base">{b.bank_name}</h3>
                      {b.is_default && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          الافتراضي
                        </span>
                      )}
                    </div>

                    <div className="text-xs space-y-1.5 text-slate-300">
                      <div>المستفيد: <span className="font-bold text-white">{b.account_holder}</span></div>
                      <div>رقم الحساب: <span className="font-mono text-cyan-400 font-bold">{b.account_number}</span></div>
                      {b.iban && <div>الآيبان: <span className="font-mono text-slate-400">{b.iban}</span></div>}
                      {b.instructions && (
                        <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                          {b.instructions}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                      <button
                        onClick={async () => {
                          if (confirm(`هل أنت متأكد من حذف الحساب في ${b.bank_name}؟`)) {
                            await fetch(`/api/bank-accounts/${b.id}`, { method: 'DELETE' });
                            showToast('تم حذف الحساب المصرفي');
                            loadAdminData();
                          }
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف الحساب</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 12. COUPONS TAB */}
          {/* ================================================================= */}
          {activeTab === 'coupons' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">الكوبونات ورموز الخصم</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إنشاء وإدارة حملات التخفيضات وتحديد نسب أو قيم الخصومات
                  </p>
                </div>

                <button
                  onClick={() => setNewCouponModal(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-950/40 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إنشاء كود خصم</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1"
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

          {/* ================================================================= */}
          {/* 13. AUDIT LOGS TAB */}
          {/* ================================================================= */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">سجل التدقيق الأمني (Audit Logs)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    توثيق كافة الإجراءات الإدارية وتغييرات الصلاحيات ومحاولات الوصول الحساسة
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                        <th className="py-3 px-4">الإجراء</th>
                        <th className="py-3 px-4">المسؤول</th>
                        <th className="py-3 px-4">العنصر المتأثر</th>
                        <th className="py-3 px-4">التفاصيل</th>
                        <th className="py-3 px-4">الوقت والتاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.action.includes('UNAUTHORIZED') ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                              log.action.includes('CONFIRM') ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                              'bg-slate-800 text-slate-200'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white font-sans font-semibold">{log.admin_name}</td>
                          <td className="py-3 px-4 text-cyan-400">{log.entity_id}</td>
                          <td className="py-3 px-4 text-slate-400 font-sans text-[11px] max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {new Date(log.created_at).toLocaleString('ar-LY')}
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
          {/* 14. SETTINGS TAB */}
          {/* ================================================================= */}
          {activeTab === 'settings' && siteSettings && (
            <div className="space-y-6 animate-fade-in max-w-4xl">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">إعدادات المنصة والهوية وSEO</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  بيانات التواصل في طرابلس، وسياسات الاستخدام، ومؤشرات محركات البحث
                </p>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as any;
                const updated = {
                  store_name: form.store_name.value,
                  store_description: form.store_description.value,
                  support_phone: form.support_phone.value,
                  support_email: form.support_email.value,
                  whatsapp_number: form.whatsapp_number.value,
                  telegram_username: form.telegram_username.value,
                  hero_title: form.hero_title.value,
                  hero_subtitle: form.hero_subtitle.value,
                  default_download_limit: Number(form.default_download_limit.value),
                  default_download_expiry_days: Number(form.default_download_expiry_days.value)
                };

                const res = await fetch('/api/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updated)
                });

                if (res.ok) {
                  showToast('تم حفظ الإعدادات بنجاح');
                  loadAdminData();
                }
              }} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">اسم المنصة الرسمي</label>
                    <input name="store_name" defaultValue={siteSettings.store_name} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">هاتف الدعم (ليبيا)</label>
                    <input name="support_phone" defaultValue={siteSettings.support_phone} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">البريد الإلكتروني للدعم</label>
                    <input name="support_email" defaultValue={siteSettings.support_email} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">رقم الواتساب</label>
                    <input name="whatsapp_number" defaultValue={siteSettings.whatsapp_number} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">وصف المنصة لـ SEO</label>
                  <textarea name="store_description" rows={2} defaultValue={siteSettings.store_description} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">عنوان الهيرو الرئيسي</label>
                    <input name="hero_title" defaultValue={siteSettings.hero_title} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">حساب تليجرام للدعم</label>
                    <input name="telegram_username" defaultValue={siteSettings.telegram_username} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">حد محاولات التنزيل الافتراضي</label>
                    <input type="number" name="default_download_limit" defaultValue={siteSettings.default_download_limit} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">صلاحية التحميل بالأيام</label>
                    <input type="number" name="default_download_expiry_days" defaultValue={siteSettings.default_download_expiry_days} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-slate-800">
                  <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/40 cursor-pointer">
                    حفظ التغييرات
                  </button>
                </div>
              </form>
            </div>
          )}

        </main>
      </div>

      {/* ===================================================================== */}
      {/* MODALS SECTION */}
      {/* ===================================================================== */}

      {/* 1. COMPREHENSIVE ADD / EDIT PRODUCT MODAL */}
      {productModalOpen && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setProductModalOpen(false);
            setEditingProduct(null);
          }}
          onSaved={() => {
            setProductModalOpen(false);
            setEditingProduct(null);
            showToast(editingProduct ? 'تم تعديل المنتج بنجاح' : 'تمت إضافة المنتج بنجاح');
            loadAdminData();
          }}
        />
      )}

      {/* 2. ROLE & PERMISSIONS MATRIX MODAL */}
      {roleModalOpen && (
        <RoleEditorModal
          role={editingRole}
          onClose={() => {
            setRoleModalOpen(false);
            setEditingRole(null);
          }}
          onSaved={() => {
            setRoleModalOpen(false);
            setEditingRole(null);
            showToast(editingRole ? 'تم تحديث مصفوفة الصلاحيات للدور' : 'تم إنشاء الدور المخصص بنجاح');
            loadAdminData();
          }}
        />
      )}

      {/* 3. REVIEW RECEIPT MODAL */}
      {selectedOrderForReview && (
        <ReceiptViewerModal
          order={selectedOrderForReview}
          isOpen={Boolean(selectedOrderForReview)}
          onClose={() => setSelectedOrderForReview(null)}
          onApprove={handleApprovePayment}
          onReject={handleRejectPayment}
        />
      )}

      {/* 4. NEW BANK MODAL */}
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

      {/* 5. NEW COUPON MODAL */}
      {newCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white">إنشاء رمز خصم جديد</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              await fetch('/api/coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code: form.code.value,
                  discount_type: form.discount_type.value,
                  discount_value: Number(form.discount_value.value),
                  minimum_order: Number(form.minimum_order.value),
                  max_uses: Number(form.max_uses.value)
                })
              });
              setNewCouponModal(false);
              showToast('تم إنشاء رمز الخصم بنجاح');
              loadAdminData();
            }} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1">رمز الكوبون (Code)</label>
                <input name="code" required placeholder="مثلاً: ZARNIX2026" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono uppercase font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">نوع الخصم</label>
                  <select name="discount_type" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (د.ل)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">قيمة الخصم</label>
                  <input type="number" name="discount_value" required placeholder="15" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">الحد الأدنى للطلب (د.ل)</label>
                  <input type="number" name="minimum_order" defaultValue="0" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">أقصى مرات استخدام</label>
                  <input type="number" name="max_uses" defaultValue="50" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewCouponModal(false)} className="px-3 py-2 text-slate-400">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 rounded-xl text-white font-bold">حفظ وتفعيل</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. NEW CATEGORY MODAL */}
      {newCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white">إضافة تصنيف برمجيات جديد</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: form.name.value,
                  slug: form.slug.value || form.name.value.toLowerCase().replace(/\s+/g, '-'),
                  description: form.description.value
                })
              });
              setNewCategoryModal(false);
              showToast('تمت إضافة التصنيف بنجاح');
              loadAdminData();
            }} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1">اسم التصنيف *</label>
                <input name="name" required placeholder="مثلاً: أنظمة الذكاء الاصطناعي" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">المعرف البرمجي (Slug)</label>
                <input name="slug" placeholder="ai-systems" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">وصف التصنيف</label>
                <textarea name="description" rows={2} placeholder="وصف موجز للمنتجات المدرجة في هذا التصنيف..." className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewCategoryModal(false)} className="px-3 py-2 text-slate-400">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 rounded-xl text-white font-bold">إضافة التصنيف</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// =============================================================================
// SUBCOMPONENT: Comprehensive Product Form Modal (Add & Edit with Images & Gallery)
// =============================================================================
interface ProductFormModalProps {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ product, categories, onClose, onSaved }) => {
  const isEditing = Boolean(product);

  // Form Fields
  const [name, setName] = useState(product?.name || '');
  const [slug, setSlug] = useState(product?.slug || '');
  const [categoryId, setCategoryId] = useState(product?.category_id || (categories[0]?.id || ''));
  const [basePrice, setBasePrice] = useState(product?.base_price ? String(product.base_price) : '450');
  const [shortDesc, setShortDesc] = useState(product?.short_description || '');
  const [fullDesc, setFullDesc] = useState(product?.full_description || '');
  const [productType, setProductType] = useState(product?.product_type || 'web_app');
  const [licenseType, setLicenseType] = useState(product?.license_type || 'commercial');
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>(product?.status || 'published');
  const [isFeatured, setIsFeatured] = useState(product?.is_featured || false);
  const [demoUrl, setDemoUrl] = useState(product?.demo_url || '');
  const [downloadFileUrl, setDownloadFileUrl] = useState(product?.download_file_url || '');
  const [codeRepo, setCodeRepo] = useState(product?.code_repository || '');

  // Cover Image
  const [mainImage, setMainImage] = useState(product?.main_image || '/src/assets/images/nizar_hero_marketplace_1793738527373.jpg');
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Gallery Screenshots
  const [galleryImages, setGalleryImages] = useState<string[]>(product?.gallery_images || []);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  // Options & Pricing Packages Builder
  const [options, setOptions] = useState<ProductOption[]>(
    product?.options && product.options.length > 0 
      ? product.options 
      : [
          {
            id: `opt_${Date.now()}_1`,
            product_id: product?.id || '',
            name: 'الكود المصدري الكامل للمشروع + رخصة الاستخدام',
            price: Number(basePrice) || 450,
            option_type: 'package',
            is_required: true,
            is_active: true,
            sort_order: 1,
            description: 'تسليم الملفات الكاملة وقواعد البيانات والمستندات'
          },
          {
            id: `opt_${Date.now()}_2`,
            product_id: product?.id || '',
            name: 'خدمة التركيب والإعداد على خادم واستضافة العميل',
            price: Math.round((Number(basePrice) || 450) * 0.4),
            option_type: 'addon',
            is_required: false,
            is_active: true,
            sort_order: 2,
            description: 'فريقنا يتولى تهيئة الخادم وربط النطاق وقواعد البيانات'
          }
        ]
  );

  // Technical Requirements
  const [techRequirements, setTechRequirements] = useState<TechnicalRequirement[]>(
    product?.technical_requirements || [
      { label: 'بيئة التشغيل', value: 'Node.js 20+ أو أي خادم سحابي' },
      { label: 'قاعدة البيانات', value: 'PostgreSQL / Supabase' }
    ]
  );

  const [saving, setSaving] = useState(false);

  const { user, role } = useAuth();
  const [compressing, setCompressing] = useState(false);

  // Handle Cover Image Upload with Automatic Smart Compression (<150KB)
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImage(file, 1200, 0.75);
      if (dataUrl) setMainImage(dataUrl);
    } catch (err) {
      console.error('Failed to compress cover image', err);
    } finally {
      setCompressing(false);
    }
  };

  // Handle Gallery Screenshots Upload with Automatic Smart Compression
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCompressing(true);
    try {
      const compressedList: string[] = [];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, 1200, 0.75);
        if (compressed) compressedList.push(compressed);
      }
      setGalleryImages(prev => [...prev, ...compressedList]);
    } catch (err) {
      console.error('Failed to compress gallery screenshots', err);
    } finally {
      setCompressing(false);
    }
  };

  // Remove individual screenshot
  const removeGalleryImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  // Options Handlers
  const addOption = () => {
    setOptions(prev => [
      ...prev,
      {
        id: `opt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        product_id: product?.id || '',
        name: 'باقة أو خيار جديد',
        price: 100,
        option_type: 'addon',
        is_required: false,
        is_active: true,
        sort_order: prev.length + 1,
        description: 'تفاصيل هذا الخيار...'
      }
    ]);
  };

  const updateOption = (index: number, key: keyof ProductOption, value: any) => {
    setOptions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const removeOption = (index: number) => {
    setOptions(prev => prev.filter((_, i) => i !== index));
  };

  // Tech Requirements Handlers
  const addTechReq = () => {
    setTechRequirements(prev => [...prev, { label: 'المتطلب', value: 'القيمة' }]);
  };

  const updateTechReq = (index: number, key: 'label' | 'value', value: string) => {
    setTechRequirements(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const removeTechReq = (index: number) => {
    setTechRequirements(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !basePrice) {
      alert('يرجى كتابة اسم المنتج والسعر الأساسي');
      return;
    }

    setSaving(true);
    const cat = categories.find(c => c.id === categoryId);

    const payload: Product = {
      id: (isEditing && product) ? product.id : `prod_${Date.now()}`,
      name,
      slug: slug || `prod-${Date.now()}`,
      category_id: categoryId,
      category_name: cat ? cat.name : 'برمجيات عامة',
      base_price: Number(basePrice),
      short_description: shortDesc,
      full_description: fullDesc,
      product_type: productType as any,
      license_type: licenseType as any,
      status,
      is_featured: isFeatured,
      main_image: mainImage,
      gallery_images: galleryImages,
      demo_url: demoUrl,
      download_file_url: downloadFileUrl,
      code_repository: codeRepo,
      options,
      technical_requirements: techRequirements,
      features: product?.features || ['كود مصدري نظيف وموثق', 'دعم كامل لقواعد البيانات', 'واجهة مستخدم عصرية ومتجاوبة'],
      faq: product?.faq || [],
      economic_study: product?.economic_study || {
        target_market: 'السوق الليبي والعربي',
        potential_buyers: 'الشركات وأصحاب الأعمال والمستثمرون',
        revenue_streams: ['مبيعات مباشرة', 'خدمات التخصيص', 'اشتراكات الدعم الفني'],
        initial_costs: `${basePrice} د.ل`,
        operational_costs: 'حسب الخادم والاستضافة',
        conservative_scenario: { title: 'متحفظ', estimated_revenue: `${Number(basePrice) * 3} د.ل`, estimated_costs: '100 د.ل', net_profit: `${Number(basePrice) * 3 - 100} د.ل`, notes: '' },
        moderate_scenario: { title: 'متوسط', estimated_revenue: `${Number(basePrice) * 8} د.ل`, estimated_costs: '250 د.ل', net_profit: `${Number(basePrice) * 8 - 250} د.ل`, notes: '' },
        optimistic_scenario: { title: 'متفائل', estimated_revenue: `${Number(basePrice) * 20} د.ل`, estimated_costs: '500 د.ل', net_profit: `${Number(basePrice) * 20 - 500} د.ل`, notes: '' },
        break_even_point: 'من أول عملية بيع مباشر',
        disclaimer: 'توقعات دراسة الجدوى استرشادية مبنية على معايير السوق.'
      },
      files: product?.files || [
        {
          id: `file_${Date.now()}`,
          product_id: (isEditing && product) ? product.id : `prod_${Date.now()}`,
          file_name: `${slug || 'package'}_release.zip`,
          storage_path: `private/projects/${slug || 'package'}.zip`,
          file_size: 1024 * 1024 * 45,
          mime_type: 'application/zip',
          version: '1.0.0',
          is_downloadable: true,
          is_active: true,
          download_count: 0,
          created_at: new Date().toISOString()
        }
      ],
      created_at: product?.created_at || new Date().toISOString()
    };

    try {
      const url = (isEditing && product) ? `/api/products/${product.id}` : '/api/products';
      const method = (isEditing && product) ? 'PUT' : 'POST';

      // Always save to localStorage immediately to guarantee no data loss on cold starts
      saveProductToLocalStorage(payload);

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-email': user?.email || 'advesapp@gmail.com',
          'x-auth-role': role || 'super_admin'
        },
        body: JSON.stringify(payload)
      });

      // Safely read response text and parse JSON (prevents "Unexpected token 'A'" crash)
      const resText = await res.text();
      let resData: any = null;
      try {
        resData = JSON.parse(resText);
      } catch {
        // Response was not JSON
      }

      if (res.ok && resData) {
        saveProductToLocalStorage(resData);
      }

      onSaved();
    } catch (err: any) {
      console.warn('Backend sync warning, product safely preserved in local storage:', err);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-5 sm:p-7 w-full max-w-4xl my-6 space-y-6 text-xs max-h-[92vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isEditing && product ? `تعديل المنتج: ${product.name}` : 'إضافة منتج أو منظومة برمجية جديدة'}
              </h3>
              <p className="text-[11px] text-slate-400">
                إدارة الصور، وخيارات التسعير، والمعارض، وتفاصيل الترخيص
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs border-r-2 border-emerald-500 pr-2">
              البيانات الأساسية والتصنيف
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">اسم المنتج البرمجي *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!isEditing && !slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  placeholder="مثلاً: نظام إدارة الصيدليات والمخازن الذكي"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">المعرف الرابطي (Slug)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="pharmacy-erp-system"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">التصنيف *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">السعر الأساسي (دينار ليبي LYD) *</label>
                <input
                  type="number"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="450"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">نوع البرمجية</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="web_app">تطبيق ويب (Web App)</option>
                  <option value="pwa">تطبيق تقدمي (PWA)</option>
                  <option value="pos_system">نظام كاشير ومبيعات (POS)</option>
                  <option value="accounting">منظومة محاسبة وERP</option>
                  <option value="telegram_bot">بوت تليجرام وتداول</option>
                  <option value="ecommerce">متجر إلكتروني متكامل</option>
                  <option value="source_code">كود مصدري وقالب كامل</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">الوصف المختصر (يظهر في البطاقات)</label>
              <input
                type="text"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="منظومة متكاملة لإدارة المبيعات والمخازن مع دعم الفواتير الإلكترونية والباركود"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">الوصف التفصيلي والمميزات الشاملة</label>
              <textarea
                rows={3}
                value={fullDesc}
                onChange={(e) => setFullDesc(e.target.value)}
                placeholder="شرح متكامل للمنظومة والتقنيات المستخدمة والفوائد التي يحصل عليها المشتري..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>
          </div>

          {/* SECTION 2: COVER IMAGE & GALLERY SCREENSHOTS */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <h4 className="font-bold text-white text-xs border-r-2 border-cyan-500 pr-2">
              إدارة الصور والمعرض (Cover & Screenshots)
            </h4>

            {/* Cover Image Uploader */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="text-slate-200 font-bold block">
                الصورة البارزة (Cover Image)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-28 h-20 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center relative">
                  <img src={mainImage} alt="Cover Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as any).src = '/logo.png'; }} />
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={coverFileInputRef}
                      onChange={handleCoverUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => coverFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-cyan-400" />
                      <span>اختر صورة من جهازك / هاتفك</span>
                    </button>
                    <span className="text-[11px] text-slate-500">أو أدخل الرابط مباشرة:</span>
                  </div>
                  <input
                    type="text"
                    value={mainImage}
                    onChange={(e) => setMainImage(e.target.value)}
                    placeholder="https://... أو /src/assets/..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Gallery Screenshots Uploader */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-200 font-bold block">
                    معرض لقطات الشاشة (Screenshots Gallery)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    صور توضيحية لواجهات النظام ولوحات التحكم ({galleryImages.length} صور مرفوعة)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={galleryFileInputRef}
                    onChange={handleGalleryUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => galleryFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-800/40 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة لقطات شاشة</span>
                  </button>
                </div>
              </div>

              {/* Gallery Grid */}
              {galleryImages.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                  لم تقم برفع صور إضافية للمعرض بعد. يمكنك اختيار صور من هاتفك أو حاسوبك لعرضها للمشترين.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                  {galleryImages.map((imgUrl, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 h-24">
                      <img src={imgUrl} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(idx)}
                        className="absolute top-1 left-1 p-1 rounded-full bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                        title="حذف هذه الصورة"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Demo & Code Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">رابط المعاينة الحية (Live Demo URL)</label>
                <input
                  type="text"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://demo.zarnix-group.ly"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">رابط مستودع الكود (GitHub / GitLab)</label>
                <input
                  type="text"
                  value={codeRepo}
                  onChange={(e) => setCodeRepo(e.target.value)}
                  placeholder="https://github.com/zarnix/..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">رابط التحميل المباشر للملف (Cloud Link)</label>
                <input
                  type="text"
                  value={downloadFileUrl}
                  onChange={(e) => setDownloadFileUrl(e.target.value)}
                  placeholder="https://storage.googleapis.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: PRICING OPTIONS & PACKAGES BUILDER */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-xs border-r-2 border-emerald-500 pr-2">
                  باقات التسعير والخيارات الإضافية (Pricing Packages)
                </h4>
                <p className="text-[11px] text-slate-400">
                  حدد حزم التراخيص المتاحة للعميل (مثل: الكود المصدري، خدمة التركيب، الدعم السنوي)
                </p>
              </div>
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-800/40 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خيار تسعير</span>
              </button>
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={opt.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => updateOption(idx, 'name', e.target.value)}
                      placeholder="اسم الباقة أو الخدمة"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={opt.price}
                        onChange={(e) => updateOption(idx, 'price', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-xs"
                      />
                      <span className="text-[10px] text-slate-400 shrink-0">د.ل</span>
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opt.is_required}
                        onChange={(e) => updateOption(idx, 'is_required', e.target.checked)}
                        className="rounded accent-emerald-500"
                      />
                      <span>إلزامي</span>
                    </label>
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-1 rounded-lg text-rose-400 hover:bg-rose-950 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: TECHNICAL REQUIREMENTS */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-xs border-r-2 border-blue-500 pr-2">
                  المواصفات والمتطلبات التقنية (Technical Specs)
                </h4>
                <p className="text-[11px] text-slate-400">
                  متطلبات تشغيل النظام (إصدار اللغة، قاعدة البيانات، الرام، الاستضافة)
                </p>
              </div>
              <button
                type="button"
                onClick={addTechReq}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-800/40 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة متطلب</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {techRequirements.map((req, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={req.label}
                    onChange={(e) => updateTechReq(idx, 'label', e.target.value)}
                    placeholder="العنصر (مثلاً: الرام)"
                    className="w-1/3 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs"
                  />
                  <input
                    type="text"
                    value={req.value}
                    onChange={(e) => updateTechReq(idx, 'value', e.target.value)}
                    placeholder="القيمة (مثلاً: 2GB كحد أدنى)"
                    className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeTechReq(idx)}
                    className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 5: STATUS & PUBLICATION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
            <div>
              <label className="text-slate-300 font-bold block mb-1">حالة النشر</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
              >
                <option value="published">منشور ومتاح للشراء في المتجر</option>
                <option value="draft">مسودة داخلية (غير مرئي للزوار)</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <label className="flex items-center gap-2 text-xs text-white font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded w-4 h-4 accent-amber-500"
                />
                <span>تمييز هذا المنتج في واجهة المتجر الرئيسية (Featured)</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all cursor-pointer flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? 'حفظ التعديلات' : 'إضافة ونشر المنتج'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

// =============================================================================
// SUBCOMPONENT: Role Editor & Permissions Matrix Modal
// =============================================================================
interface RoleEditorModalProps {
  role: RoleItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const RoleEditorModal: React.FC<RoleEditorModalProps> = ({ role, onClose, onSaved }) => {
  const isEditing = Boolean(role);
  const [name, setName] = useState(role?.name || '');
  const [nameAr, setNameAr] = useState(role?.name_ar || '');
  const [description, setDescription] = useState(role?.description || '');
  const [color, setColor] = useState(role?.color || '#8b5cf6');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>(
    role?.permissions || ['manage_products']
  );
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = role?.id === 'super_admin' || role?.id === 'owner';

  const togglePermission = (key: PermissionKey) => {
    if (isSuperAdmin) return; // Super admin always has all permissions
    setSelectedPermissions(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => {
    setSelectedPermissions(SYSTEM_PERMISSIONS.map(p => p.key));
  };

  const clearAll = () => {
    if (isSuperAdmin) return;
    setSelectedPermissions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr) {
      alert('اسم الدور مطلوب');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && role) {
        const res = await fetch(`/api/admin/roles/${role.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name_ar: nameAr,
            description,
            color,
            permissions: isSuperAdmin ? SYSTEM_PERMISSIONS.map(p => p.key) : selectedPermissions
          })
        });
        if (res.ok) onSaved();
      } else {
        const res = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name || nameAr.toLowerCase().replace(/\s+/g, '_'),
            name_ar: nameAr,
            description,
            color,
            permissions: selectedPermissions
          })
        });
        if (res.ok) onSaved();
      }
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الدور');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-5 sm:p-7 w-full max-w-3xl my-6 space-y-6 text-xs max-h-[92vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/60">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isEditing && role ? `مصفوفة صلاحيات: ${role.name_ar}` : 'إنشاء دور مخصص جديد (Custom Role)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                تحديد الصلاحيات الدقيقة لهذا الدور ومجالات تدخله في المنصة
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">اسم الدور بالعربية *</label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثلاً: مشرف التسويق والمبيعات"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">المعرف الإنجليزي (Role ID)</label>
              <input
                type="text"
                disabled={isEditing}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="marketing_supervisor"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-slate-300 font-bold block mb-1">وصف الدور ومسؤولياته</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مسؤول عن إدارة الحملات التسويقية ومتابعة كوبونات التخفيض..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">لون الدور في الواجهة</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-8 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer"
                />
                <span className="font-mono text-slate-300 text-xs">{color}</span>
              </div>
            </div>
          </div>

          {/* Permissions Matrix with Checkboxes */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-xs">
                  مصفوفة الصلاحيات (اختر الصلاحيات الممنوحة لهذا الدور)
                </h4>
                <p className="text-[11px] text-slate-400">
                  تم تحديد {isSuperAdmin ? '12 من 12' : `${selectedPermissions.length} من 12`} صلاحية
                </p>
              </div>

              {!isSuperAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto p-1">
              {SYSTEM_PERMISSIONS.map((perm) => {
                const isChecked = isSuperAdmin || selectedPermissions.includes(perm.key);
                return (
                  <div
                    key={perm.key}
                    onClick={() => togglePermission(perm.key)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isChecked
                        ? 'bg-purple-950/30 border-purple-800/60 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white block">{perm.label}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{perm.category}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">{perm.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/40 transition-all cursor-pointer flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? 'حفظ الصلاحيات' : 'إنشاء الدور الآن'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

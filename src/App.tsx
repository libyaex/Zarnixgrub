import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { SiteProvider, useSite } from './context/SiteContext';
import { NotificationsProvider, useNotifications } from './context/NotificationsContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InstallPrompt, UpdateBanner, ConnectionBanner } from './components/pwa/PwaPrompts';
import { ToastHost } from './components/notifications/NotificationUI';
import { GoogleLoginPage } from './pages/GoogleLoginPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { CustomerPortal } from './pages/CustomerPortal';
import { NotificationsPage } from './pages/NotificationsPage';
import { Product, Order, SelectedOptionSnapshot, CartItem } from './types';
import { apiFetch } from './lib/api';
import { buildPath, parsePath, type Route, type View } from './lib/router';
import { navigateTo } from './lib/nav';
import { registerServiceWorker } from './lib/pwa';

// Heavy / rarely-visited screens are split out of the main bundle (customers never download the dashboard).
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const PoliciesPage = lazy(() => import('./pages/PoliciesPage').then((m) => ({ default: m.PoliciesPage })));

const PRIVATE_VIEWS: View[] = ['portal', 'checkout', 'notifications', 'admin', 'order_success'];

const Spinner: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center text-emerald-400">
    <div className="w-9 h-9 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
  </div>
);

const Splash: React.FC = () => {
  const site = useSite();
  return (
    <div className="min-h-screen bg-[#06090f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <img src={String(site.logo_url)} alt="" className="w-16 h-16 object-contain animate-pulse" />
        <span className="text-xs text-slate-400 font-medium">جارٍ تحميل المنصة...</span>
      </div>
    </div>
  );
};

const AnnouncementBar: React.FC = () => {
  const site = useSite();
  if (!site.announcement_enabled || !site.announcement_text) return null;
  const inner = <span className="font-bold">{String(site.announcement_text)}</span>;
  return (
    <div className="bg-emerald-500 text-slate-950 text-center text-xs sm:text-sm py-2 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      {site.announcement_link ? <a href={String(site.announcement_link)} className="underline-offset-2 hover:underline">{inner}</a> : inner}
    </div>
  );
};

type DetailState = { slug: string; product: Product | null; status: 'loading' | 'ready' | 'missing' };

function MainApp() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const { addToCart, directCheckoutItem, setDirectCheckoutItem } = useCart();
  const site = useSite();
  const { unread } = useNotifications();

  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname, window.location.search));
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [updateReg, setUpdateReg] = useState<ServiceWorkerRegistration | null>(null);

  // URL <-> view: back/forward, refresh and deep links all work.
  useEffect(() => {
    const sync = () => setRoute(parsePath(window.location.pathname, window.location.search));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => { void registerServiceWorker(setUpdateReg); }, []);

  // Products come from the server only (the database is the single source of truth).
  useEffect(() => {
    apiFetch('/api/products')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllProducts(Array.isArray(data) ? data : []))
      .catch(() => setAllProducts([]));
  }, []);

  const handleNavigate = useCallback((view: string, data?: any) => {
    navigateTo(buildPath(view as View, { filter: data?.filter, tab: data?.tab, slug: data?.slug }));
  }, []);

  const handleViewProduct = useCallback((product: Product) => {
    setDetail({ slug: product.slug, product, status: 'ready' });
    navigateTo(buildPath('product_details', { slug: product.slug }));
  }, []);

  // Resolve the product for /products/:slug (from the list, or fetched for direct visits).
  const slug = route.view === 'product_details' ? route.params.slug : undefined;
  useEffect(() => {
    if (!slug) return;
    const known = allProducts.find((p) => p.slug === slug || p.id === slug);
    if (known) { setDetail({ slug, product: known, status: 'ready' }); return; }
    if (detail?.slug === slug && detail.status === 'ready') return;
    setDetail({ slug, product: null, status: 'loading' });
    let alive = true;
    apiFetch(`/api/products/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (alive) setDetail({ slug, product: p, status: p ? 'ready' : 'missing' }); })
      .catch(() => { if (alive) setDetail({ slug, product: null, status: 'missing' }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, allProducts]);

  // Browser tab title (crawlers already got a server-rendered one).
  useEffect(() => {
    const suffix = String(site.seo_title_suffix || '');
    const titles: Partial<Record<View, string>> = {
      products: 'جميع المنتجات', cart: 'سلة المشتريات', checkout: 'إتمام الطلب', order_success: 'تم استلام طلبك',
      portal: 'حسابي', policies: 'السياسات والشروط', notifications: 'الإشعارات', admin: 'لوحة التحكم', login: 'تسجيل الدخول',
      product_details: detail?.product?.name,
    };
    const t = route.view === 'home' ? String(site.seo_title || site.store_name) : titles[route.view] ? `${titles[route.view]}${suffix}` : String(site.store_name);
    document.title = unread > 0 ? `(${unread}) ${t}` : t;
  }, [route, site, detail, unread]);

  // Order success needs the order we just created; after a refresh send the customer to their orders.
  useEffect(() => {
    if (route.view === 'order_success' && !lastPlacedOrder && isAuthenticated) navigateTo('/portal/orders', true);
  }, [route.view, lastPlacedOrder, isAuthenticated]);

  // Signed-in users do not need the login page.
  useEffect(() => {
    if (route.view === 'login' && isAuthenticated) navigateTo(route.params.next || '/', true);
  }, [route, isAuthenticated]);

  const handleQuickAdd = (product: Product) => {
    const baseOption = (product.options || []).find((o) => o.is_required || o.sort_order === 1);
    const optionsSnapshot: SelectedOptionSnapshot[] = baseOption ? [{
      option_id: baseOption.id, name: baseOption.name, price: baseOption.price, description: baseOption.description,
    }] : [];
    addToCart(product, optionsSnapshot);
  };

  const handleDirectBuy = (product: Product, options: SelectedOptionSnapshot[]) => {
    const optionsTotal = options.length > 0 ? options.reduce((sum, opt) => sum + opt.price, 0) : product.base_price;
    const item: CartItem = {
      id: `direct_${Date.now()}`, product, selected_options: options, base_price: product.base_price,
      options_total: optionsTotal, total_price: optionsTotal, quantity: 1,
    };
    setDirectCheckoutItem(item);
    navigateTo('/checkout');
  };

  const handleOrderCreated = (order: Order) => {
    setLastPlacedOrder(order);
    navigateTo('/orders/success');
  };

  if (loading) return <Splash />;

  const staff = isAuthenticated && isAdmin;

  // Maintenance: everyone except signed-in staff sees the maintenance page.
  if (site.maintenance_mode && !staff) {
    if (route.view === 'login' || route.view === 'admin') return <GoogleLoginPage onSuccess={() => navigateTo(route.view === 'admin' ? '/admin' : '/', true)} />;
    return <MaintenancePage onStaffLogin={() => navigateTo('/login')} />;
  }

  // Login wall: always for private areas, and for the whole store when the owner requires it.
  const needsLogin = !isAuthenticated && (site.require_login_to_browse || PRIVATE_VIEWS.includes(route.view) || route.view === 'login');
  if (needsLogin) {
    const next = PRIVATE_VIEWS.includes(route.view) ? window.location.pathname + window.location.search : undefined;
    return <GoogleLoginPage onSuccess={() => { if (route.view === 'login') navigateTo(route.params.next || '/', true); else if (next && route.view === 'admin') navigateTo(next, true); }} />;
  }

  const view = route.view;
  const isAdminView = view === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-[#06090f] text-slate-100 selection:bg-emerald-500 selection:text-slate-950 pb-16 lg:pb-0">
      <ConnectionBanner />
      <UpdateBanner registration={updateReg} />
      <ToastHost />

      {!isAdminView && <AnnouncementBar />}
      {!isAdminView && <Header currentView={view} setCurrentView={handleNavigate} />}

      <main className="flex-1">
        <Suspense fallback={<Spinner />}>
          {view === 'home' && <HomePage onNavigate={handleNavigate} onViewProduct={handleViewProduct} onQuickAdd={handleQuickAdd} />}

          {view === 'products' && <ProductsPage initialFilter={route.params.filter} onViewProduct={handleViewProduct} onQuickAdd={handleQuickAdd} />}

          {view === 'product_details' && detail?.status === 'ready' && detail.product && (
            <ProductDetailsPage
              product={detail.product}
              allProducts={allProducts}
              onBack={() => handleNavigate('products')}
              onAddToCart={(p, o) => addToCart(p, o)}
              onDirectBuy={handleDirectBuy}
              onViewProduct={handleViewProduct}
            />
          )}
          {view === 'product_details' && detail?.status === 'loading' && <Spinner />}
          {view === 'product_details' && detail?.status === 'missing' && (
            <div className="max-w-md mx-auto py-24 px-6 text-center">
              <p className="text-5xl mb-4">🔎</p>
              <h1 className="text-xl font-bold text-white mb-2">المنتج غير موجود</h1>
              <p className="text-sm text-slate-400 mb-6">ربما أُزيل المنتج أو تغيّر رابطه.</p>
              <button onClick={() => handleNavigate('products')} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm cursor-pointer">تصفح المنتجات</button>
            </div>
          )}

          {view === 'cart' && <CartPage onCheckout={() => handleNavigate('checkout')} onBrowseProducts={() => handleNavigate('products')} onViewProduct={handleViewProduct} />}

          {view === 'checkout' && <CheckoutPage directItem={directCheckoutItem} onOrderCreated={handleOrderCreated} onBackToCart={() => handleNavigate('cart')} />}

          {view === 'order_success' && lastPlacedOrder && (
            <OrderSuccessPage order={lastPlacedOrder} onGoToPortal={() => handleNavigate('portal')} onContinueShopping={() => handleNavigate('products')} />
          )}

          {view === 'portal' && (
            <CustomerPortal
              key={route.params.tab}
              initialTab={route.params.tab || 'downloads'}
              onNavigateHome={() => handleNavigate('home')}
              onViewProduct={(s) => { const p = allProducts.find((item) => item.slug === s); if (p) handleViewProduct(p); }}
            />
          )}

          {view === 'notifications' && <NotificationsPage />}

          {view === 'policies' && <PoliciesPage key={route.params.tab} initialTab={route.params.tab || 'terms'} onBack={() => handleNavigate('home')} />}

          {isAdminView && (
            <AdminDashboard
              initialTab={route.params.tab}
              onBackToStore={() => handleNavigate('home')}
              onViewProductLive={(p) => handleViewProduct(p)}
            />
          )}
        </Suspense>
      </main>

      {!isAdminView && <Footer onNavigate={handleNavigate} />}
      {!isAdminView && <MobileBottomNav currentView={view} onNavigate={handleNavigate} />}
      {!isAdminView && <InstallPrompt />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SiteProvider>
        <AuthProvider>
          <NotificationsProvider>
            <CartProvider>
              <MainApp />
            </CartProvider>
          </NotificationsProvider>
        </AuthProvider>
      </SiteProvider>
    </ErrorBoundary>
  );
}

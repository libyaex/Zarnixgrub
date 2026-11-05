import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { GoogleLoginPage } from './pages/GoogleLoginPage';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { CustomerPortal } from './pages/CustomerPortal';
import { PoliciesPage } from './pages/PoliciesPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Product, Order, SelectedOptionSnapshot, CartItem } from './types';

// Helper to check if current browser URL is specifically targeting /admin
const checkIsAdminUrl = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  return (
    path === '/admin' || 
    path.startsWith('/admin/') || 
    hash === '#/admin' || 
    hash.startsWith('#/admin/') ||
    search.includes('view=admin') ||
    search.includes('admin=true')
  );
};

function MainApp() {
  const { isAuthenticated, loading } = useAuth();
  const { addToCart, directCheckoutItem, setDirectCheckoutItem } = useCart();

  // Initialize view: only open admin if the browser URL explicitly requests /admin
  const [currentView, setCurrentView] = useState<string>(() => {
    return checkIsAdminUrl() ? 'admin' : 'home';
  });

  const [viewParams, setViewParams] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // Sync URL popstate / hashchange (e.g. typing /admin or clicking browser back/forward)
  useEffect(() => {
    const handleUrlChange = () => {
      if (checkIsAdminUrl()) {
        setCurrentView('admin');
      } else {
        setCurrentView((prev) => (prev === 'admin' ? 'home' : prev));
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Fetch all products on mount
  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setAllProducts(data))
      .catch(console.error);
  }, []);

  const handleNavigate = (view: string, data?: any) => {
    setViewParams(data || null);
    setCurrentView(view);
    
    // Manage browser URL history cleanly
    if (view === 'admin') {
      window.history.pushState({}, '', '/admin');
    } else {
      if (checkIsAdminUrl()) {
        window.history.pushState({}, '', '/');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentView('product_details');
    if (checkIsAdminUrl()) {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickAdd = (product: Product) => {
    const baseOption = (product.options || []).find(o => o.is_required || o.sort_order === 1);
    const optionsSnapshot: SelectedOptionSnapshot[] = baseOption ? [{
      option_id: baseOption.id,
      name: baseOption.name,
      price: baseOption.price,
      description: baseOption.description
    }] : [];

    addToCart(product, optionsSnapshot);
  };

  const handleAddToCartWithOptions = (product: Product, options: SelectedOptionSnapshot[]) => {
    addToCart(product, options);
  };

  const handleDirectBuy = (product: Product, options: SelectedOptionSnapshot[]) => {
    let optionsTotal = 0;
    if (options.length > 0) {
      optionsTotal = options.reduce((sum, opt) => sum + opt.price, 0);
    } else {
      optionsTotal = product.base_price;
    }

    const item: CartItem = {
      id: `direct_${Date.now()}`,
      product,
      selected_options: options,
      base_price: product.base_price,
      options_total: optionsTotal,
      total_price: optionsTotal,
      quantity: 1
    };

    setDirectCheckoutItem(item);
    setCurrentView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderCreated = (order: Order) => {
    setLastPlacedOrder(order);
    setCurrentView('order_success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If loading session, show clean splash
  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090f] flex items-center justify-center text-emerald-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center font-bold font-mono text-xl animate-pulse">
            N
          </div>
          <span className="text-xs text-slate-400 font-medium">جارٍ تحميل المنصة...</span>
        </div>
      </div>
    );
  }

  // FIRST PAGE MUST BE GOOGLE SIGN-IN ONLY AS REQUESTED
  if (!isAuthenticated) {
    return (
      <GoogleLoginPage 
        onSuccess={() => {
          if (checkIsAdminUrl()) {
            setCurrentView('admin');
          } else {
            setCurrentView('home');
          }
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#06090f] text-slate-100 selection:bg-emerald-500 selection:text-slate-950 pb-16 lg:pb-0">
      
      {/* Show header on all customer pages. Zero admin trace in header! */}
      {currentView !== 'admin' && (
        <Header
          currentView={currentView}
          setCurrentView={handleNavigate}
        />
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomePage
            onNavigate={handleNavigate}
            onViewProduct={handleViewProduct}
            onQuickAdd={handleQuickAdd}
          />
        )}

        {currentView === 'products' && (
          <ProductsPage
            initialFilter={viewParams?.filter}
            onViewProduct={handleViewProduct}
            onQuickAdd={handleQuickAdd}
          />
        )}

        {currentView === 'product_details' && selectedProduct && (
          <ProductDetailsPage
            product={selectedProduct}
            allProducts={allProducts}
            onBack={() => handleNavigate('products')}
            onAddToCart={handleAddToCartWithOptions}
            onDirectBuy={handleDirectBuy}
            onViewProduct={handleViewProduct}
          />
        )}

        {currentView === 'cart' && (
          <CartPage
            onCheckout={() => handleNavigate('checkout')}
            onBrowseProducts={() => handleNavigate('products')}
            onViewProduct={handleViewProduct}
          />
        )}

        {currentView === 'checkout' && (
          <CheckoutPage
            directItem={directCheckoutItem}
            onOrderCreated={handleOrderCreated}
            onBackToCart={() => handleNavigate('cart')}
          />
        )}

        {currentView === 'order_success' && lastPlacedOrder && (
          <OrderSuccessPage
            order={lastPlacedOrder}
            onGoToPortal={() => handleNavigate('portal')}
            onContinueShopping={() => handleNavigate('products')}
          />
        )}

        {currentView === 'portal' && (
          <CustomerPortal
            initialTab={viewParams?.tab || 'downloads'}
            onNavigateHome={() => handleNavigate('home')}
            onViewProduct={(slug) => {
              const p = allProducts.find(item => item.slug === slug);
              if (p) handleViewProduct(p);
            }}
          />
        )}

        {currentView === 'policies' && (
          <PoliciesPage
            initialTab={viewParams?.tab || 'terms'}
            onBack={() => handleNavigate('home')}
          />
        )}

        {/* Admin Dashboard: Exclusively at /admin with zero presence in customer views */}
        {currentView === 'admin' && (
          <AdminDashboard
            onBackToStore={() => {
              window.history.pushState({}, '', '/');
              handleNavigate('home');
            }}
            onViewProductLive={(p) => {
              window.history.pushState({}, '', '/');
              handleViewProduct(p);
            }}
          />
        )}
      </main>

      {/* Show footer on all customer pages */}
      {currentView !== 'admin' && (
        <Footer onNavigate={handleNavigate} />
      )}

      {/* Mobile Bottom Navigation Bar: Customer-only tabs (Zero admin presence) */}
      {currentView !== 'admin' && (
        <MobileBottomNav
          currentView={currentView}
          onNavigate={handleNavigate}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainApp />
      </CartProvider>
    </AuthProvider>
  );
}

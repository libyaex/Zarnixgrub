/**
 * Tiny History-API router. The app used to keep the current page in React
 * state only, so refresh lost the page, the back button did nothing and no
 * page could be linked to or indexed. Views map 1:1 to real URLs now.
 */
export type View =
  | 'home' | 'products' | 'product_details' | 'cart' | 'checkout' | 'order_success'
  | 'portal' | 'policies' | 'notifications' | 'admin' | 'login';

export interface Route {
  view: View;
  params: { slug?: string; tab?: string; filter?: string; next?: string; [k: string]: string | undefined };
}

const PORTAL_TABS = ['downloads', 'orders', 'services', 'licenses', 'profile'];
const POLICY_TABS = ['terms', 'privacy', 'refunds', 'digital_goods', 'licensing', 'support'];

export function parsePath(pathname: string, search = ''): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(search);
  const parts = clean.split('/').filter(Boolean);
  const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

  if (parts.length === 0) return { view: 'home', params: {} };
  switch (parts[0]) {
    case 'products':
      if (parts[1]) return { view: 'product_details', params: { slug: decode(parts[1]) } };
      return { view: 'products', params: q.get('filter') ? { filter: q.get('filter')! } : {} };
    case 'cart': return { view: 'cart', params: {} };
    case 'checkout': return { view: 'checkout', params: {} };
    case 'orders': return { view: 'order_success', params: {} };
    case 'portal': {
      const tab = parts[1] && PORTAL_TABS.includes(parts[1]) ? parts[1] : 'downloads';
      return { view: 'portal', params: { tab } };
    }
    case 'policies': {
      const tab = parts[1] && POLICY_TABS.includes(parts[1]) ? parts[1] : 'terms';
      return { view: 'policies', params: { tab } };
    }
    case 'notifications': return { view: 'notifications', params: {} };
    case 'login': return { view: 'login', params: q.get('next') && isAppPath(q.get('next')!) ? { next: q.get('next')! } : {} };
    case 'admin': return { view: 'admin', params: q.get('tab') ? { tab: q.get('tab')! } : {} };
    default: return { view: 'home', params: {} };
  }
}

export function buildPath(view: View, params: Route['params'] = {}): string {
  switch (view) {
    case 'home': return '/';
    case 'products': return params.filter ? `/products?filter=${encodeURIComponent(params.filter)}` : '/products';
    case 'product_details': return params.slug ? `/products/${encodeURIComponent(params.slug)}` : '/products';
    case 'cart': return '/cart';
    case 'checkout': return '/checkout';
    case 'order_success': return '/orders/success';
    case 'portal': return `/portal/${params.tab && PORTAL_TABS.includes(params.tab) ? params.tab : 'downloads'}`;
    case 'policies': return `/policies/${params.tab && POLICY_TABS.includes(params.tab) ? params.tab : 'terms'}`;
    case 'notifications': return '/notifications';
    case 'login': return params.next && isAppPath(params.next) ? `/login?next=${encodeURIComponent(params.next)}` : '/login';
    case 'admin': return params.tab ? `/admin?tab=${encodeURIComponent(params.tab)}` : '/admin';
  }
}

/** Only same-origin app paths may be navigated to from notifications / SW messages. */
export function isAppPath(url: string): boolean {
  return /^\/(?!\/)[^\s<>"']*$/.test(url);
}

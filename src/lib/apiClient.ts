/**
 * Global fetch interceptor for the Zarnix frontend.
 *
 * WHY: the admin dashboard and several pages issue dozens of raw `fetch()`
 * calls to `/api/...` without an Authorization header. The hardened server
 * correctly rejects those with 401, which made the dashboard lists look
 * empty ("phantom pages"). Patching ~51 call sites one by one is fragile;
 * instead we patch `window.fetch` ONCE, early in the bootstrap, so every
 * same-origin `/api` request automatically carries the current Supabase
 * access token.
 *
 * Rules:
 * - Only same-origin `/api/` URLs are touched; everything else is unchanged.
 * - An explicit Authorization header set by the caller is never overridden.
 * - Public endpoints ignore the header; adding it is harmless.
 * - The legacy forgeable `x-auth-email` header is stripped.
 */
import { supabase } from './supabase';

export function installApiFetchInterceptor(): void {
  if (typeof window === 'undefined' || (window as unknown as Record<string, unknown>).__zarnixFetchPatched) {
    return;
  }
  (window as unknown as Record<string, unknown>).__zarnixFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = '';
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.href;
    else if (input instanceof Request) url = input.url;

    const sameOriginApi =
      url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);

    if (!sameOriginApi) {
      return originalFetch(input as RequestInfo, init);
    }

    const headers = new Headers(
      (init?.headers as HeadersInit | undefined) ??
        (input instanceof Request ? input.headers : undefined) ??
        {}
    );
    headers.delete('x-auth-email');

    if (!headers.has('Authorization') && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          headers.set('Authorization', `Bearer ${data.session.access_token}`);
        }
      } catch (error) {
        console.error('[apiClient] could not attach auth token', error);
      }
    }

    const finalInit: RequestInit = { ...(init ?? {}) };
    if (input instanceof Request && !init) {
      // Preserve body/method of a Request instance with no init overrides.
      finalInit.method = input.method;
      finalInit.body = input.body;
    }
    finalInit.headers = headers;
    return originalFetch(input as RequestInfo, finalInit);
  };
}

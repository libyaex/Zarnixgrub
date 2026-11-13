/**
 * Single entry point for talking to the API.
 *
 *  - Attaches the Supabase access token (Authorization: Bearer) to every
 *    same-origin /api call, so no component has to remember to.
 *  - apiJson() throws ApiError with the server's Arabic message instead of
 *    swallowing failures — the UI must never show "saved" when it was not.
 */
import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await accessToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}

/** JSON request that throws ApiError on any non-2xx response. */
export async function apiJson<T = any>(
  input: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {}
): Promise<T> {
  const { body, ...rest } = init;
  const res = await apiFetch(input, {
    ...rest,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    throw new ApiError(
      data?.error || `تعذر إكمال الطلب (HTTP ${res.status})`,
      res.status,
      data?.code
    );
  }
  return data as T;
}

/** Best-effort message for toasts. */
export function errorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

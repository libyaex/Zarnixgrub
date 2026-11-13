/** Test harness: mocks `express` + the Supabase client once, then loads REAL router modules. */
import { mock } from 'node:test';
import { createFakeDb } from './fakeDb.ts';

type Handler = (req: any, res: any, next: (e?: unknown) => void) => unknown;
export interface Route { method: string; path: string; handlers: Handler[] }
export type Routes = Route[];

export const db = createFakeDb();

let mocked = false;
function setupMocks() {
  if (mocked) return;
  mocked = true;
  // Only the database client is mocked; the REAL express Router is used.
  mock.module(new URL('../../server/lib/supabaseAdmin.ts', import.meta.url).href, {
    namedExports: {
      supabaseAdmin: db.client, isSupabaseConfigured: true,
      SUPABASE_HOST: 'test.supabase.co', SUPABASE_URL: 'https://test.supabase.co',
    },
  });
}

/** Read the registered routes out of a real express Router's layer stack. */
export async function loadRoutes(relPath: string, exportName: string): Promise<Routes> {
  setupMocks();
  const mod = await import(new URL(relPath, import.meta.url).href);
  const router = mod[exportName];
  return router.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      method: Object.keys(layer.route.methods)[0].toUpperCase(),
      path: layer.route.path as string,
      handlers: layer.route.stack.map((l: any) => l.handle as Handler),
    }));
}

/** Replace the whole in-memory database between tests. */
export function resetDb(seed: Record<string, any[]> = {}) {
  for (const k of Object.keys(db.tables)) delete db.tables[k];
  for (const [k, v] of Object.entries(seed)) db.tables[k] = v.map((r) => ({ ...r }));
  db.objects.clear();
}

export function makeRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  return res;
}

/** Run a route's handler chain, skipping only the real JWT check (tests inject req.user). */
export async function call(routes: Routes, method: string, path: string, req: Record<string, any>) {
  const route = routes.find((r) => r.method === method && r.path === path);
  if (!route) throw new Error(`no route ${method} ${path}`);
  const res = makeRes();
  const full = { headers: {}, body: {}, params: {}, query: {}, ...req };
  for (const h of route.handlers) {
    if (h.name === 'requireAuth') continue;
    let proceed = false;
    await h(full, res, () => { proceed = true; });
    if (!proceed) break;
  }
  return res;
}

export const CUSTOMER = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const STAFF = '33333333-3333-4333-8333-333333333333';

export const user = (over: Record<string, any> = {}) => ({
  id: CUSTOMER, email: 'u@test.co', full_name: 'User', role: 'customer',
  status: 'active', permissions: [] as string[], is_staff: false, ...over,
});
export const staff = (permissions: string[], role = 'payment_manager', id = STAFF) =>
  user({ id, role, permissions, is_staff: true, email: 's@test.co', full_name: 'Staff' });

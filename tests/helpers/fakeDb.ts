/**
 * Minimal in-memory stand-in for the parts of supabase-js the API uses:
 * select/insert/update/delete/upsert, eq/neq/in/is/lt filters, order/range,
 * single/maybeSingle, simple embedded relations, rpc and storage.
 * It exists so the money/permission flows can be executed in unit tests.
 */
type Row = Record<string, any>;
const SINGULAR: Record<string, string> = { categories: 'category' };
const singular = (t: string) => SINGULAR[t] ?? t.replace(/s$/, '');
const UNIQUE: Record<string, string[]> = { payment_submissions: ['transaction_reference'], coupons: ['code'], products: ['slug'] };

export function createFakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  const objects = new Set<string>(); // "bucket/path"
  let counter = 1;
  const uuid = () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
  const T = (name: string) => (tables[name] ??= []);

  class Query implements PromiseLike<any> {
    private filters: Array<(r: Row) => boolean> = [];
    private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
    private payload: any;
    private cols = '*';
    private mode: 'many' | 'single' | 'maybe' = 'many';
    private wantRows = false;
    private head = false;
    private wantCount = false;
    private from_ = 0;
    private to_ = Infinity;
    private ordering: { col: string; asc: boolean } | null = null;
    private upsertOpts: any;
    private table: string;
    constructor(table: string) { this.table = table; }

    select(cols = '*', opts?: { count?: string; head?: boolean }) {
      this.cols = cols; this.wantRows = true;
      if (opts?.count) this.wantCount = true;
      if (opts?.head) this.head = true;
      return this;
    }
    insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
    update(p: any) { this.op = 'update'; this.payload = p; return this; }
    upsert(p: any, o?: any) { this.op = 'upsert'; this.payload = p; this.upsertOpts = o; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
    neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
    in(c: string, v: any[]) { this.filters.push((r) => v.includes(r[c])); return this; }
    is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
    lt(c: string, v: any) { this.filters.push((r) => r[c] < v); return this; }
    order(col: string, o?: { ascending?: boolean }) { this.ordering = { col, asc: o?.ascending !== false }; return this; }
    range(f: number, t: number) { this.from_ = f; this.to_ = t; return this; }
    limit(n: number) { this.to_ = n - 1; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }
    single() { this.mode = 'single'; return this; }

    private embed(row: Row): Row | null {
      const out = { ...row };
      for (const m of this.cols.matchAll(/(\w+)(!inner)?\(([^()]*)\)/g)) {
        const rel = m[1];
        const fk = `${singular(rel)}_id`;
        if (fk in row) {
          const parent = T(rel).find((p) => p.id === row[fk]) ?? null;
          if (m[2] && !parent) return null;
          out[rel] = parent ? { ...parent } : null;
        } else {
          out[rel] = T(rel).filter((c) => c[`${singular(this.table)}_id`] === row.id).map((c) => ({ ...c }));
        }
      }
      return out;
    }

    private run(): { data: any; error: any; count?: number } {
      const rows = T(this.table);
      const err = (code: string, message: string) => ({ data: null, error: { code, message } });
      let result: Row[] = [];

      if (this.op === 'insert' || this.op === 'upsert') {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row) => ({ id: uuid(), created_at: new Date().toISOString(), ...p }));
        const inserted: Row[] = [];
        for (const r of list) {
          const keys = UNIQUE[this.table] ?? [];
          const dupe = rows.find((x) => keys.some((k) => r[k] != null && x[k] === r[k]));
          const conflictCols: string[] | undefined = this.upsertOpts?.onConflict?.split(',');
          const upsertDupe = conflictCols && rows.find((x) => conflictCols.every((k) => x[k] === r[k]));
          if (this.op === 'upsert' && upsertDupe) { if (!this.upsertOpts?.ignoreDuplicates) Object.assign(upsertDupe, r); continue; }
          if (dupe) return err('23505', 'duplicate key value violates unique constraint');
          rows.push(r); inserted.push(r);
        }
        result = inserted;
      } else if (this.op === 'update') {
        result = rows.filter((r) => this.filters.every((f) => f(r)));
        for (const r of result) Object.assign(r, this.payload);
      } else if (this.op === 'delete') {
        result = rows.filter((r) => this.filters.every((f) => f(r)));
        tables[this.table] = rows.filter((r) => !result.includes(r));
      } else {
        result = rows.filter((r) => this.filters.every((f) => f(r)));
      }

      if (this.ordering) {
        const { col, asc } = this.ordering;
        result = [...result].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      const count = result.length;
      result = result.slice(this.from_, this.to_ + 1);

      if (this.op !== 'select' && !this.wantRows) return { data: null, error: null };
      if (this.head) return { data: null, error: null, count };
      let shaped = result.map((r) => this.embed(r)).filter((r): r is Row => r !== null);
      if (this.mode === 'single') return shaped.length === 1 ? { data: shaped[0], error: null } : err('PGRST116', 'no rows');
      if (this.mode === 'maybe') return { data: shaped[0] ?? null, error: null };
      return { data: shaped, error: null, ...(this.wantCount ? { count } : {}) };
    }
    then<A, B>(ok?: (v: any) => A | PromiseLike<A>, bad?: (e: any) => B | PromiseLike<B>) {
      return Promise.resolve().then(() => this.run()).then(ok, bad);
    }
  }

  const client = {
    from: (t: string) => new Query(t),
    rpc: async (name: string, args: any) => {
      if (name !== 'redeem_coupon') return { data: null, error: { message: 'unknown rpc' } };
      const c = T('coupons').find((x) => x.code === String(args.p_code).toUpperCase() && x.is_active && x.used_count < x.max_uses);
      if (!c) return { data: false, error: null };
      c.used_count += 1;
      return { data: true, error: null };
    },
    auth: { getUser: async () => ({ data: { user: null }, error: { message: 'n/a' } }) },
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, o: any) => ({
          data: [...objects].filter((p) => p.startsWith(`${bucket}/${folder}/`)).map((p) => ({ name: p.split('/').pop() }))
            .filter((f) => !o?.search || f.name === o.search),
          error: null,
        }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed.test/${bucket}/${path}` }, error: null }),
        createSignedUploadUrl: async (path: string) => ({ data: { path, token: 'tok-' + path }, error: null }),
        remove: async (paths: string[]) => { paths.forEach((p) => objects.delete(`${bucket}/${p}`)); return { data: null, error: null }; },
      }),
    },
  };
  return { client, tables, objects, T, uuid };
}

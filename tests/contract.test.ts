/**
 * Contract test: every /api URL the frontend uses must exist on the server.
 * This is the test that would have caught "the UI was never migrated to the
 * new backend" (20 calls to routes that did not exist).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// router file -> mount prefix (mirrors server.ts)
const MOUNTS: Record<string, string> = {
  auth: '/api/auth', payments: '/api/payments', upload: '/api/upload', downloads: '/api/downloads',
  dashboard: '/api/admin', admin: '/api/admin', manage: '/api/admin', store: '/api',
};

const norm = (p: string) => p.replace(/\$\{[^}]*\}/g, '{}').replace(/:\w+/g, '{}').split('?')[0].replace(/\/$/, '');

function serverRoutes(): Set<string> {
  const out = new Set<string>();
  for (const [file, prefix] of Object.entries(MOUNTS)) {
    const src = fs.readFileSync(path.join(root, 'server/routes', `${file}.ts`), 'utf8');
    for (const m of src.matchAll(/\w+Router\.(get|post|put|delete|patch)\(\s*'([^']*)'/g)) {
      out.add(`${m[1].toUpperCase()} ${norm(prefix + (m[2] === '/' ? '' : m[2]))}`);
    }
  }
  out.add('GET /api/health');
  return out;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

const routes = serverRoutes();
const routePaths = new Set([...routes].map((r) => r.split(' ')[1]));

test('server.ts mounts every router file used by the contract', () => {
  const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
  for (const name of ['authRouter', 'storeRouter', 'paymentsRouter', 'uploadRouter', 'downloadsRouter', 'adminRouter', 'manageRouter', 'dashboardRouter']) {
    assert.match(server, new RegExp(`protectRouter\\(${name}\\)`), `${name} must be wrapped with protectRouter`);
  }
});

test('every /api path literal in the frontend exists on the server (any method)', () => {
  const missing: string[] = [];
  for (const file of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/([`'"])(\/api\/[^`'"\s]*)\1/g)) {
      const p = norm(m[2]);
      if (!routePaths.has(p)) missing.push(`${path.relative(root, file)}: ${m[2]}`);
    }
  }
  assert.deepEqual(missing, [], `Frontend calls routes the server does not have:\n${missing.join('\n')}`);
});

test('every direct apiFetch/apiJson call uses a METHOD the server implements', () => {
  const bad: string[] = [];
  for (const file of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/api(?:Fetch|Json)(?:<[^>]*>)?\(\s*([`'"])(\/api\/[^`'"]*)\1(?=([^]{0,260}))/g)) {
      const tail = m[3].split(/api(?:Fetch|Json)/)[0];
      const method = (tail.match(/method:\s*'(\w+)'/)?.[1] ?? 'GET').toUpperCase();
      if (!routes.has(`${method} ${norm(m[2])}`)) bad.push(`${path.relative(root, file)}: ${method} ${m[2]}`);
    }
  }
  assert.deepEqual(bad, [], `Method/route mismatch:\n${bad.join('\n')}`);
});

test('no legacy trust of browser identity or local product storage remains', () => {
  const offenders: string[] = [];
  for (const file of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const needle of ['x-auth-email', 'x-auth-role', 'zarnix_custom_products', 'zarnix_custom_categories']) {
      if (src.includes(needle)) offenders.push(`${path.relative(root, file)} -> ${needle}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('plain fetch(/api) is only used where a token is deliberately passed manually', () => {
  const raw: string[] = [];
  for (const file of walk(path.join(root, 'src'))) {
    if (file.endsWith('lib/api.ts')) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?<![\w.])fetch\(\s*[`'"]\/api\//g)) raw.push(`${path.relative(root, file)}@${m.index}`);
  }
  assert.deepEqual(raw, ['src/context/AuthContext.tsx@' + raw[0]?.split('@')[1]].filter(() => raw.length === 1),
    'only AuthContext (/api/auth/me with an explicit token) may call fetch directly');
});

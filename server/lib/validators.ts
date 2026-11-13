/** Small pure validators used by routes (unit-tested). */

/** A receipt path is only acceptable if it lives under the caller's own folder. */
export function isOwnReceiptPath(path: unknown, userId: string): boolean {
  if (typeof path !== 'string' || !userId) return false;
  if (path.includes('..') || path.includes('\\') || path.startsWith('/')) return false;
  const [owner, ...rest] = path.split('/');
  return owner === userId && rest.length >= 1 && rest.every(Boolean);
}

/** Make a user-supplied file name safe for object storage keys. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '')
    .slice(-120);
  return cleaned || 'file';
}

const PROJECT_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz'];

/** Archives are validated by extension (browsers report inconsistent MIME types). */
export function isAllowedProjectFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return PROJECT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const RECEIPT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export function isAllowedReceiptMime(mime: string): boolean {
  return RECEIPT_MIME.includes(mime);
}

/** Bytes in a base64 payload (accepts data: URLs). */
export function base64ByteLength(input: string): number {
  const data = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

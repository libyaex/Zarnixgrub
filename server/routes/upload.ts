/**
 * Direct-to-storage uploads via short-lived SIGNED UPLOAD URLS.
 *
 * Why: sending files as base64 through the API is capped at ~4.5 MB on Vercel
 * and ~37 MB elsewhere, so real project archives could never be uploaded.
 * Now the API only validates intent and mints a one-time token; the browser
 * uploads the bytes straight to private Supabase Storage.
 *
 *  - receipts  -> private `payment_receipts`, under `<userId>/...`
 *  - projects  -> private `project_files` (requires manage_products)
 *  - images    -> public `product_images` (requires manage_products; cover/gallery)
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth } from '../lib/auth.ts';
import { hasPermission } from '../lib/permissions.ts';
import { safeFileName, isAllowedProjectFile, isAllowedReceiptMime } from '../lib/validators.ts';

export const uploadRouter = Router();

export const RECEIPT_BUCKET = 'payment_receipts';
export const PROJECT_BUCKET = 'project_files';
export const IMAGE_BUCKET = 'product_images'; // public: storefront cover/gallery images only
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PROJECT_MAX_BYTES = 500 * 1024 * 1024; // 500 MB (also bounded by your Supabase plan)

/** POST /api/upload/sign { kind, file_name, mime_type, size_bytes } -> { bucket, path, token } */
uploadRouter.post('/sign', requireAuth, async (req: Request, res: Response) => {
  const kind = String(req.body?.kind ?? '');
  const fileName = typeof req.body?.file_name === 'string' ? req.body.file_name.slice(0, 200) : '';
  const mimeType = typeof req.body?.mime_type === 'string' ? req.body.mime_type.slice(0, 120) : '';
  const size = Number(req.body?.size_bytes);

  if (!['receipt', 'project', 'image'].includes(kind) || !fileName) {
    res.status(400).json({ error: 'بيانات الملف غير مكتملة' });
    return;
  }
  if (!Number.isFinite(size) || size <= 0) {
    res.status(400).json({ error: 'حجم الملف غير صالح' });
    return;
  }

  const isReceipt = kind === 'receipt';
  const isImage = kind === 'image';
  if (isImage) {
    if (!hasPermission(req.user!.permissions, 'manage_products')) {
      res.status(403).json({ error: 'ليست لديك صلاحية رفع صور المنتجات', code: 'forbidden' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      res.status(415).json({ error: 'صيغة الصورة غير مدعومة (JPG / PNG / WebP)' });
      return;
    }
  } else if (isReceipt) {
    if (!isAllowedReceiptMime(mimeType)) {
      res.status(415).json({ error: 'نوع الإيصال غير مسموح (صورة JPG/PNG/WebP أو PDF فقط)' });
      return;
    }
  } else {
    if (!hasPermission(req.user!.permissions, 'manage_products')) {
      res.status(403).json({ error: 'ليست لديك صلاحية رفع ملفات المشاريع', code: 'forbidden' });
      return;
    }
    if (!isAllowedProjectFile(fileName)) {
      res.status(415).json({ error: 'يجب أن يكون ملف المشروع أرشيفاً (zip / rar / 7z / tar / gz)' });
      return;
    }
  }
  const max = isImage ? IMAGE_MAX_BYTES : isReceipt ? RECEIPT_MAX_BYTES : PROJECT_MAX_BYTES;
  if (size > max) {
    res.status(413).json({ error: `حجم الملف يتجاوز الحد المسموح (${Math.floor(max / 1048576)} ميجابايت)` });
    return;
  }

  const bucket = isImage ? IMAGE_BUCKET : isReceipt ? RECEIPT_BUCKET : PROJECT_BUCKET;
  const path = `${req.user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFileName(fileName)}`;
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[upload] createSignedUploadUrl failed:', error?.message);
    res.status(500).json({ error: 'تعذر تجهيز رابط الرفع الآمن. تأكد من إنشاء حاويات التخزين (phase3-complete.sql).' });
    return;
  }
  res.json({ bucket, path: data.path, token: data.token });
});

/** True when an object really exists in the bucket (used before trusting a client-sent path). */
export async function storageObjectExists(bucket: string, path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/');
  const folder = slash >= 0 ? path.slice(0, slash) : '';
  const name = path.slice(slash + 1);
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, { search: name, limit: 10 });
  return !error && !!data?.some((f) => f.name === name);
}

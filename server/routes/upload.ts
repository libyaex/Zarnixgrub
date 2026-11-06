/**
 * Phase 5 — Authenticated uploads to Supabase Storage.
 *
 * Fixes:
 * - Uploads require authentication (no more public /api/upload).
 * - Receipts go to the private `payment_receipts` bucket; project files
 *   to the private `project_files` bucket. Public assets are NOT accepted.
 * - Files are validated by type and size before upload.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth } from '../lib/auth';

export const uploadRouter = Router();

const RECEIPT_BUCKET = 'payment_receipts';
const PROJECT_BUCKET = 'project_files';

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PROJECT_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

const RECEIPT_MIME_PREFIXES = ['image/'];
const PROJECT_MIME_ALLOWED = [
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/x-tar',
  'application/gzip',
];

uploadRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const kind = String(req.body?.kind ?? 'receipt'); // 'receipt' | 'project'
  const fileName = typeof req.body?.file_name === 'string' ? req.body.file_name.slice(0, 200) : '';
  const mimeType = typeof req.body?.mime_type === 'string' ? req.body.mime_type.slice(0, 120) : '';
  const sizeBytes = Number(req.body?.size_bytes);
  const base64 = typeof req.body?.file_data === 'string' ? req.body.file_data : '';

  if (!fileName || !base64) {
    res.status(400).json({ error: 'بيانات الملف غير مكتملة' });
    return;
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    res.status(400).json({ error: 'حجم الملف غير صالح' });
    return;
  }

  const isReceipt = kind === 'receipt';
  const maxBytes = isReceipt ? RECEIPT_MAX_BYTES : PROJECT_MAX_BYTES;
  const allowed = isReceipt
    ? RECEIPT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))
    : PROJECT_MIME_ALLOWED.includes(mimeType);

  if (!allowed) {
    res.status(415).json({ error: 'نوع الملف غير مسموح' });
    return;
  }
  if (sizeBytes > maxBytes) {
    res.status(413).json({
      error: `حجم الملف يتجاوز الحد المسموح (${Math.floor(maxBytes / (1024 * 1024))} ميجابايت)`,
    });
    return;
  }

  // Only staff may upload project files; customers may upload receipts only.
  if (!isReceipt && !['owner', 'super_admin', 'admin', 'product_manager'].includes(req.user!.role)) {
    res.status(403).json({ error: 'ليست لديك صلاحية رفع ملفات المشاريع' });
    return;
  }

  const bucket = isReceipt ? RECEIPT_BUCKET : PROJECT_BUCKET;
  const safeExt = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const objectPath = `${req.user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;

  const buffer = Buffer.from(base64, 'base64');

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType: mimeType, upsert: false });

  if (error || !data) {
    res.status(500).json({ error: 'تعذر رفع الملف إلى التخزين الآمن' });
    return;
  }

  res.status(201).json({
    storage_bucket: bucket,
    storage_path: (data as { path: string }).path,
  });
});

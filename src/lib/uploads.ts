/**
 * Upload a file straight to private Supabase Storage using a one-time signed
 * URL minted by the API (the API only validates intent; bytes never pass
 * through it, so there is no 4.5 MB serverless body limit).
 */
import { supabase } from './supabase';
import { apiJson } from './api';

export interface UploadedObject {
  bucket: string;
  path: string;
}

export async function uploadViaSignedUrl(kind: 'receipt' | 'project' | 'image', file: File): Promise<UploadedObject> {
  if (!supabase) throw new Error('خدمة التخزين غير مهيأة');
  const sign = await apiJson<{ bucket: string; path: string; token: string }>('/api/upload/sign', {
    method: 'POST',
    body: {
      kind,
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    },
  });
  const { error } = await supabase.storage
    .from(sign.bucket)
    .uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type || undefined });
  if (error) throw new Error(`فشل رفع الملف: ${error.message}`);
  return { bucket: sign.bucket, path: sign.path };
}

/** Upload a storefront image (cover/gallery) and return its public URL. */
export async function uploadPublicImage(file: File | Blob, name = 'image.jpg'): Promise<string> {
  if (!supabase) throw new Error('خدمة التخزين غير مهيأة');
  const asFile = file instanceof File ? file : new File([file], name, { type: file.type || 'image/jpeg' });
  const { bucket, path } = await uploadViaSignedUrl('image', asFile);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** data: URL (from the in-browser compressor) -> File. */
export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

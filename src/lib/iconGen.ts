/**
 * Browser-side icon generation: from ONE uploaded logo produce every PWA icon
 * (192, 512, maskable 512 with safe padding) and a favicon, so the owner never
 * needs image tools. Canvas only; no dependencies.
 */
export interface GeneratedIcons {
  icon192: Blob;
  icon512: Blob;
  maskable512: Blob;
  favicon64: Blob;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذر قراءة الصورة')); };
    img.src = url;
  });
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('تعذر إنشاء الأيقونة'))), 'image/png'));

/** Draw `img` centered and contained inside a square canvas with `padRatio` margin on every side. */
function drawIcon(img: HTMLImageElement, size: number, padRatio: number, background: string | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, size, size); }
  const inner = size * (1 - padRatio * 2);
  const scale = Math.min(inner / img.width, inner / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas;
}

export async function generateIcons(logo: Blob, maskableBackground = '#06090f'): Promise<GeneratedIcons> {
  const img = await loadImage(logo);
  if (img.width < 128 || img.height < 128) throw new Error('الشعار صغير جداً (الحد الأدنى 128×128، والأفضل 512×512)');
  return {
    icon192: await toBlob(drawIcon(img, 192, 0.06, null)),
    icon512: await toBlob(drawIcon(img, 512, 0.06, null)),
    // Maskable icons must keep the artwork inside the central 80% "safe zone".
    maskable512: await toBlob(drawIcon(img, 512, 0.2, maskableBackground)),
    favicon64: await toBlob(drawIcon(img, 64, 0.04, null)),
  };
}

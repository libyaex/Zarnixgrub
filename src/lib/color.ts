/** Derives a full Tailwind-style palette from the single accent color chosen in Settings. */
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');

const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const SHADES: Array<[string, 'white' | 'black' | 'base', number]> = [
  ['50', 'white', 0.92], ['100', 'white', 0.84], ['200', 'white', 0.68], ['300', 'white', 0.5], ['400', 'white', 0.25],
  ['500', 'base', 0], ['600', 'black', 0.15], ['700', 'black', 0.3], ['800', 'black', 0.45], ['900', 'black', 0.6], ['950', 'black', 0.75],
];

export function paletteFromAccent(hex: string): Record<string, string> | null {
  const base = hexToRgb(hex);
  if (!base) return null;
  const out: Record<string, string> = {};
  for (const [name, to, t] of SHADES) {
    const rgb = to === 'base' ? base : mix(base, to === 'white' ? [255, 255, 255] : [0, 0, 0], t);
    out[name] = toHex(...rgb);
  }
  return out;
}

/** WCAG relative luminance -> readable text color on top of the accent. */
export function readableOn(hex: string): '#ffffff' | '#04130d' {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#04130d';
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#04130d' : '#ffffff';
}

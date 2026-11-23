/**
 * Price filter bounds derived from the REAL catalogue. The old slider was
 * hard-coded to 5,000 and hid every product above it, so adding a more
 * expensive product made it "disappear". There is no ceiling any more: the
 * slider's maximum is computed from the most expensive product, and sitting at
 * the maximum means "no limit".
 */
export function niceCeil(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / magnitude) * magnitude;
}

export interface PriceBounds { ceiling: number; step: number }

export function priceBounds(prices: number[]): PriceBounds {
  const highest = prices.reduce((m, p) => (Number.isFinite(p) && p > m ? p : m), 0);
  const ceiling = niceCeil(highest);
  const roughStep = ceiling / 50;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  return { ceiling, step: Math.max(1, Math.round(roughStep / magnitude) * magnitude) };
}

/** `maxPrice === null` means "no limit": every product passes. */
export const passesPriceFilter = (price: number, maxPrice: number | null): boolean =>
  maxPrice === null || price <= maxPrice;

/** Slider position -> filter value: dragging to the end removes the limit. */
export const sliderToMax = (value: number, ceiling: number): number | null => (value >= ceiling ? null : value);

/**
 * Fixed-window in-memory rate limiter.
 * - Keyed by the verified user id when present, else the client IP taken
 *   from the LAST trusted proxy hop (x-forwarded-for can be forged by the
 *   client, so only its final entry — appended by Vercel — is used).
 * - Old buckets are purged so the map cannot grow without bound.
 * NOTE: state is per serverless instance. It blunts abuse but is not a
 * global guarantee; use Vercel Firewall / Upstash for hard limits.
 */
import type { Request, Response, NextFunction } from 'express';

interface Bucket { count: number; resetAt: number; }

export function clientKey(req: Pick<Request, 'headers' | 'ip'> & { user?: { id: string } }): string {
  if (req.user?.id) return `u:${req.user.id}`;
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff.join(',') : xff ?? '';
  const last = raw.split(',').map((s) => s.trim()).filter(Boolean).pop();
  return `ip:${last || req.ip || 'unknown'}`;
}

export function createRateLimiter(name: string, max: number, windowMs: number, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();
  let lastPurge = now();

  return function limiter(req: Request, res: Response, next: NextFunction): void {
    const t = now();
    if (t - lastPurge > windowMs) {
      for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
      lastPurge = t;
    }
    const key = `${name}:${clientKey(req)}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      bucket = { count: 0, resetAt: t + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - t) / 1000)));
      res.status(429).json({ error: 'طلبات كثيرة. حاول بعد قليل.', code: 'rate_limited' });
      return;
    }
    next();
  };
}

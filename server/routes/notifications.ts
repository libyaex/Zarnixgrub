/**
 * Notification center API (all routes require a signed-in user and only ever
 * touch the caller's own rows) + Web Push subscription management.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth } from '../lib/auth.ts';
import { isUuid } from '../lib/validators.ts';
import { notifyUsers } from '../lib/notify.ts';
import { normalizePreferences } from '../lib/notifyRules.ts';
import { vapidFromEnv } from '../lib/webpush.ts';
import { isNotificationType } from '../../src/shared/notificationTypes.ts';

export const notificationsRouter = Router();

const PAGE_DEFAULT = 20;
const PAGE_MAX = 50;
const RETENTION_DAYS = 90;

async function unreadCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  return count ?? 0;
}

/** GET /api/notifications?limit=&before=&unread=1 */
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(PAGE_MAX, Math.floor(Number(req.query.limit) || PAGE_DEFAULT)));
  let query = supabaseAdmin
    .from('notifications').select('*').eq('user_id', req.user!.id)
    .order('created_at', { ascending: false }).limit(limit + 1);
  if (req.query.unread === '1') query = query.is('read_at', null);
  if (typeof req.query.before === 'string' && !Number.isNaN(Date.parse(req.query.before))) {
    query = query.lt('created_at', req.query.before);
  }
  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل الإشعارات' });
    return;
  }
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  res.json({
    items: page,
    unread_count: await unreadCount(req.user!.id),
    next_cursor: rows.length > limit ? page[page.length - 1].created_at : null,
  });
});

notificationsRouter.get('/unread-count', requireAuth, async (req: Request, res: Response) => {
  res.json({ count: await unreadCount(req.user!.id) });
});

/** POST /api/notifications/read { ids?: uuid[], all?: boolean } */
notificationsRouter.post('/read', requireAuth, async (req: Request, res: Response) => {
  const now = new Date().toISOString();
  if (req.body?.all === true) {
    await supabaseAdmin.from('notifications').update({ read_at: now }).eq('user_id', req.user!.id).is('read_at', null);
  } else {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(isUuid).slice(0, 100) : [];
    if (!ids.length) {
      res.status(400).json({ error: 'لم يتم تحديد إشعارات' });
      return;
    }
    await supabaseAdmin.from('notifications').update({ read_at: now }).eq('user_id', req.user!.id).in('id', ids).is('read_at', null);
  }
  // Lazy retention: drop this user's old READ notifications.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await supabaseAdmin.from('notifications').delete().eq('user_id', req.user!.id).lt('created_at', cutoff).not('read_at', 'is', null);
  res.json({ success: true, unread_count: await unreadCount(req.user!.id) });
});

notificationsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) {
    res.status(400).json({ error: 'معرف غير صالح' });
    return;
  }
  await supabaseAdmin.from('notifications').delete().eq('id', req.params.id).eq('user_id', req.user!.id);
  res.json({ success: true, unread_count: await unreadCount(req.user!.id) });
});

// ---------------------------------------------------------------- preferences
notificationsRouter.get('/preferences', requireAuth, async (req: Request, res: Response) => {
  const { data } = await supabaseAdmin.from('notification_preferences').select('*').eq('user_id', req.user!.id).maybeSingle();
  res.json(normalizePreferences(data));
});

notificationsRouter.put('/preferences', requireAuth, async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const hour = (v: unknown) => (v === null || v === '' ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 23 ? Number(v) : undefined);
  const start = hour(b.quiet_start);
  const end = hour(b.quiet_end);
  if (start === undefined || end === undefined) {
    res.status(400).json({ error: 'ساعات الهدوء يجب أن تكون بين 0 و23' });
    return;
  }
  const tz = Number(b.tz_offset_minutes);
  const row = {
    user_id: req.user!.id,
    in_app: b.in_app !== false,
    push: b.push !== false,
    muted_types: Array.isArray(b.muted_types) ? [...new Set<string>(b.muted_types.filter(isNotificationType))] : [],
    quiet_start: start,
    quiet_end: end,
    tz_offset_minutes: Number.isFinite(tz) && Math.abs(tz) <= 840 ? Math.round(tz) : 120,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from('notification_preferences').upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.error('[notifications] preferences save failed (phase4 migration?):', error.message);
    res.status(500).json({ error: 'تعذر حفظ التفضيلات' });
    return;
  }
  res.json(normalizePreferences(row));
});

// ---------------------------------------------------------------- web push
/** GET /api/notifications/push/config -> { enabled, public_key } (the public key is not a secret). */
notificationsRouter.get('/push/config', requireAuth, async (_req: Request, res: Response) => {
  const keys = vapidFromEnv();
  res.json({ enabled: Boolean(keys), public_key: keys?.publicKey ?? null });
});

const b64uLen = (s: unknown, bytes: number) => typeof s === 'string' && /^[A-Za-z0-9_-]+$/.test(s) && Buffer.from(s, 'base64url').length === bytes;

/** POST /api/notifications/push/subscribe { endpoint, keys: { p256dh, auth } } */
notificationsRouter.post('/push/subscribe', requireAuth, async (req: Request, res: Response) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  const p256dh = req.body?.keys?.p256dh;
  const auth = req.body?.keys?.auth;
  if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || !b64uLen(p256dh, 65) || !b64uLen(auth, 16)) {
    res.status(400).json({ error: 'اشتراك الإشعارات غير صالح' });
    return;
  }
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert({
    user_id: req.user!.id, endpoint, p256dh, auth, failed_count: 0,
    user_agent: String(req.headers['user-agent'] ?? '').slice(0, 200),
  }, { onConflict: 'endpoint' });
  if (error) {
    console.error('[notifications] subscribe failed (phase4 migration?):', error.message);
    res.status(500).json({ error: 'تعذر حفظ اشتراك الإشعارات' });
    return;
  }
  res.status(201).json({ success: true });
});

notificationsRouter.post('/push/unsubscribe', requireAuth, async (req: Request, res: Response) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (endpoint) await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', req.user!.id);
  res.json({ success: true });
});

/** POST /api/notifications/push/test — sends a real notification to the caller. */
notificationsRouter.post('/push/test', requireAuth, async (req: Request, res: Response) => {
  const result = await notifyUsers([req.user!.id], {
    type: 'system', title: 'إشعار تجريبي 🔔', body: 'ممتاز! الإشعارات تعمل على هذا الجهاز.',
    link: '/notifications', priority: 'high',
  });
  res.json({ success: true, ...result, push_configured: Boolean(vapidFromEnv()) });
});

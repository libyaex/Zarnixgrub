/** Pure "smart" rules for notifications (unit-tested; no I/O). */
import {
  NOTIFICATION_TYPES, DEFAULT_PREFERENCES, isNotificationType,
  type NotificationPreferences, type NotificationType, type NotificationPriority,
} from '../../src/shared/notificationTypes.ts';

export const COLLAPSE_WINDOW_MS = 15 * 60 * 1000;

export function normalizePreferences(row: Partial<Record<keyof NotificationPreferences, unknown>> | null | undefined): NotificationPreferences {
  const d = DEFAULT_PREFERENCES;
  if (!row) return { ...d, muted_types: [] };
  const hour = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23 ? v : null);
  return {
    in_app: row.in_app !== false,
    push: row.push !== false,
    muted_types: Array.isArray(row.muted_types) ? row.muted_types.filter(isNotificationType) : [],
    quiet_start: hour(row.quiet_start),
    quiet_end: hour(row.quiet_end),
    tz_offset_minutes: typeof row.tz_offset_minutes === 'number' && Math.abs(row.tz_offset_minutes) <= 840 ? row.tz_offset_minutes : d.tz_offset_minutes,
  };
}

/** Local hour (0-23) for a UTC instant and a minutes-east-of-UTC offset. */
export function localHour(now: Date, tzOffsetMinutes: number): number {
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffsetMinutes) % 1440;
  return Math.floor((minutes + 1440) % 1440 / 60);
}

/** Quiet window may wrap past midnight (e.g. 23 -> 7). Equal start/end = disabled. */
export function isQuietHour(prefs: NotificationPreferences, now: Date): boolean {
  const { quiet_start: s, quiet_end: e } = prefs;
  if (s === null || e === null || s === e) return false;
  const h = localHour(now, prefs.tz_offset_minutes);
  return s < e ? h >= s && h < e : h >= s || h < e;
}

export interface DeliveryPlan { inApp: boolean; push: boolean; reason?: 'muted' | 'in_app_off' | 'quiet' | 'push_off' }

/**
 * Decide what a user receives. Muting a type silences everything for it.
 * Quiet hours silence only the phone (push), and never for high priority.
 */
export function planDelivery(
  prefs: NotificationPreferences, type: NotificationType, priority: NotificationPriority, now: Date = new Date()
): DeliveryPlan {
  if (prefs.muted_types.includes(type)) return { inApp: false, push: false, reason: 'muted' };
  const inApp = prefs.in_app;
  if (!prefs.push) return { inApp, push: false, reason: 'push_off' };
  if (priority !== 'high' && isQuietHour(prefs, now)) return { inApp, push: false, reason: 'quiet' };
  return { inApp, push: true };
}

export const urgencyFor = (p: NotificationPriority): 'low' | 'normal' | 'high' => p;

/** Merged copy for N unread notifications that share a group key. */
export function collapsedCopy(type: NotificationType, count: number, latestBody: string): { title: string; body: string } {
  return { title: NOTIFICATION_TYPES[type].collapsedTitle(count), body: latestBody };
}

/** Only same-origin paths may be used as deep links (no open redirects via notifications). */
export function safeLink(link: unknown): string | null {
  if (typeof link !== 'string') return null;
  const v = link.trim();
  return /^\/(?!\/)[^\s<>"']*$/.test(v) && v.length <= 300 ? v : null;
}

/** Compact payload sent to the service worker (kept far below the 3.8KB push limit). */
export function pushPayload(n: {
  id: string; type: NotificationType; title: string; body: string; link: string | null;
  priority: NotificationPriority; group_key: string | null; count?: number; unread?: number;
}) {
  const clip = (s: string, m: number) => (s.length > m ? s.slice(0, m - 1) + '…' : s);
  return {
    id: n.id,
    type: n.type,
    title: clip(n.title, 90),
    body: clip(n.body, 220),
    url: n.link ?? '/notifications',
    tag: n.group_key ?? `${n.type}:${n.id}`,
    priority: n.priority,
    count: n.count ?? 1,
    unread: n.unread ?? undefined,
    renotify: n.priority === 'high',
  };
}

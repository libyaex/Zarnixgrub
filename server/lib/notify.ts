/**
 * Notification delivery: in-app rows (live via Supabase Realtime) + Web Push.
 *
 * Smart behaviour (all rules live in notifyRules.ts and are unit-tested):
 *  - per-user preferences: mute a type, turn push/in-app off, quiet hours;
 *  - grouping: unread notifications of the same group inside 15 minutes are
 *    merged ("3 طلبات جديدة") instead of spamming the list and the phone;
 *  - high priority breaks through quiet hours; deep links are same-origin only;
 *  - dead push subscriptions (404/410) are deleted automatically.
 * Delivery never throws: a failed notification must never fail the business action.
 */
import { supabaseAdmin } from './supabaseAdmin.ts';
import { sendPush, vapidFromEnv, type VapidKeys } from './webpush.ts';
import {
  COLLAPSE_WINDOW_MS, collapsedCopy, normalizePreferences, planDelivery, pushPayload, safeLink, urgencyFor,
} from './notifyRules.ts';
import {
  NOTIFICATION_TYPES, type NotificationPreferences, type NotificationPriority, type NotificationType,
} from '../../src/shared/notificationTypes.ts';
import { BUILTIN_ROLES, hasPermission, permissionsFor, type PermissionKey } from './permissions.ts';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown>;
  groupKey?: string | null;
  priority?: NotificationPriority;
}

export interface NotifyResult { inApp: number; pushed: number }

const MAX_FAILURES = 5;
const PUSH_CONCURRENCY = 20;

async function inChunks<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}

async function deliverPush(
  userId: string, payload: Record<string, unknown>, priority: NotificationPriority, groupKey: string | null, keys: VapidKeys
): Promise<number> {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions').select('id, endpoint, p256dh, auth, failed_count').eq('user_id', userId);
  let delivered = 0;
  await inChunks(subs ?? [], PUSH_CONCURRENCY, async (chunk) => {
    await Promise.all(chunk.map(async (s: any) => {
      const topic = groupKey ? groupKey.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : undefined;
      const result = await sendPush(s, payload, keys, { urgency: urgencyFor(priority), topic });
      if (result === 'sent') {
        delivered++;
        await supabaseAdmin.from('push_subscriptions').update({ failed_count: 0, last_used_at: new Date().toISOString() }).eq('id', s.id);
      } else if (result === 'gone' || s.failed_count + 1 >= MAX_FAILURES) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
      } else {
        await supabaseAdmin.from('push_subscriptions').update({ failed_count: s.failed_count + 1 }).eq('id', s.id);
      }
    }));
  });
  return delivered;
}

async function unreadCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  return count ?? 0;
}

/** Notify specific users. Safe to call without awaiting errors: it never throws. */
export async function notifyUsers(
  userIds: string[], input: NotifyInput, opts: { skipUserId?: string; now?: Date } = {}
): Promise<NotifyResult> {
  const result: NotifyResult = { inApp: 0, pushed: 0 };
  try {
    const ids = [...new Set(userIds)].filter((id) => id && id !== opts.skipUserId);
    if (!ids.length) return result;
    const now = opts.now ?? new Date();
    const meta = NOTIFICATION_TYPES[input.type];
    const priority = input.priority ?? meta.priority;
    const link = safeLink(input.link ?? null);
    const keys = vapidFromEnv();

    const { data: prefRows } = await supabaseAdmin.from('notification_preferences').select('*').in('user_id', ids);
    const prefsByUser = new Map<string, NotificationPreferences>(
      (prefRows ?? []).map((r: any) => [r.user_id as string, normalizePreferences(r)] as [string, NotificationPreferences])
    );

    for (const userId of ids) {
      const plan = planDelivery(prefsByUser.get(userId) ?? normalizePreferences(null), input.type, priority, now);
      if (!plan.inApp && !plan.push) continue;

      let row: any = null;
      let count = 1;
      if (plan.inApp) {
        // Merge into a recent unread notification of the same group instead of adding another row.
        if (input.groupKey) {
          const since = new Date(now.getTime() - COLLAPSE_WINDOW_MS).toISOString();
          const { data: existing } = await supabaseAdmin
            .from('notifications').select('id, data')
            .eq('user_id', userId).eq('group_key', input.groupKey).is('read_at', null).gte('created_at', since)
            .maybeSingle();
          if (existing) {
            count = Number((existing.data as any)?.count ?? 1) + 1;
            const merged = collapsedCopy(input.type, count, input.body);
            const { data: updated } = await supabaseAdmin
              .from('notifications')
              .update({ title: merged.title, body: merged.body, link, priority, data: { ...(input.data ?? {}), count }, created_at: now.toISOString() })
              .eq('id', existing.id).select().maybeSingle();
            row = updated ?? null;
          }
        }
        if (!row) {
          const { data: inserted } = await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: userId, type: input.type, title: input.title, body: input.body, link,
              data: { ...(input.data ?? {}), count: 1 }, priority, group_key: input.groupKey ?? null,
            })
            .select().single();
          row = inserted ?? null;
        }
        if (row) result.inApp++;
      }

      if (plan.push && keys) {
        const display = count > 1 ? collapsedCopy(input.type, count, input.body) : { title: input.title, body: input.body };
        const payload = pushPayload({
          id: row?.id ?? `${input.type}-${now.getTime()}`, type: input.type, title: display.title, body: display.body,
          link, priority, group_key: input.groupKey ?? null, count, unread: row ? await unreadCount(userId) : undefined,
        });
        result.pushed += await deliverPush(userId, payload, priority, input.groupKey ?? null, keys);
      }
    }
  } catch (error) {
    console.error('[notify] delivery failed:', error);
  }
  return result;
}

/** Roles whose fixed permission set includes `permission` (built-ins only). */
export function builtinRolesWith(permission: PermissionKey): string[] {
  return BUILTIN_ROLES.filter((r) => r !== 'customer' && hasPermission(permissionsFor(r), permission));
}

/** Active staff who hold `permission` through a built-in or a custom role. */
export async function staffWithPermission(permission: PermissionKey): Promise<string[]> {
  const ids = new Set<string>();
  const { data: direct } = await supabaseAdmin
    .from('profiles').select('id').in('role', builtinRolesWith(permission)).eq('status', 'active');
  for (const p of direct ?? []) ids.add(p.id);

  const { data: grants } = await supabaseAdmin.from('role_permissions').select('role_id').eq('permission_key', permission);
  const roleIds = (grants ?? []).map((g: any) => g.role_id);
  if (roleIds.length) {
    const { data: custom } = await supabaseAdmin
      .from('profiles').select('id').in('custom_role_id', roleIds).eq('status', 'active');
    for (const p of custom ?? []) ids.add(p.id);
  }
  return [...ids];
}

export async function notifyStaff(permission: PermissionKey, input: NotifyInput, opts: { skipUserId?: string } = {}): Promise<NotifyResult> {
  try {
    return await notifyUsers(await staffWithPermission(permission), input, opts);
  } catch (error) {
    console.error('[notify] staff lookup failed:', error);
    return { inApp: 0, pushed: 0 };
  }
}

/**
 * Announcement to a whole audience. Bulk insert (no per-user merging) and
 * capped push fan-out; respects each user's mute/push preferences.
 */
export async function broadcast(
  audience: 'all' | 'staff' | 'customers',
  input: { title: string; body: string; link?: string | null; priority?: NotificationPriority },
  now: Date = new Date()
): Promise<{ recipients: number; inApp: number; pushed: number }> {
  let query = supabaseAdmin.from('profiles').select('id, role').eq('status', 'active');
  if (audience === 'customers') query = query.eq('role', 'customer');
  const { data: profiles } = await query.range(0, 4999);
  let ids = (profiles ?? []).filter((p: any) => audience !== 'staff' || p.role !== 'customer').map((p: any) => p.id as string);
  if (audience === 'staff') {
    const { data: custom } = await supabaseAdmin.from('profiles').select('id').not('custom_role_id', 'is', null).eq('status', 'active');
    ids = [...new Set([...ids, ...(custom ?? []).map((c: any) => c.id as string)])];
  }

  const priority = input.priority ?? 'normal';
  const link = safeLink(input.link ?? null);
  const { data: prefRows } = await supabaseAdmin.from('notification_preferences').select('*').in('user_id', ids);
  const prefs = new Map<string, NotificationPreferences>(
    (prefRows ?? []).map((r: any) => [r.user_id as string, normalizePreferences(r)] as [string, NotificationPreferences])
  );

  const rows: any[] = [];
  const pushTo: string[] = [];
  for (const id of ids) {
    const plan = planDelivery(prefs.get(id) ?? normalizePreferences(null), 'broadcast', priority, now);
    if (plan.inApp) rows.push({ user_id: id, type: 'broadcast', title: input.title, body: input.body, link, priority, data: { count: 1 } });
    if (plan.push) pushTo.push(id);
  }
  await inChunks(rows, 500, async (chunk) => { await supabaseAdmin.from('notifications').insert(chunk); });

  let pushed = 0;
  const keys = vapidFromEnv();
  if (keys) {
    const payload = pushPayload({ id: `bc-${now.getTime()}`, type: 'broadcast', title: input.title, body: input.body, link, priority, group_key: null });
    await inChunks(pushTo, PUSH_CONCURRENCY, async (chunk) => {
      const counts = await Promise.all(chunk.map((id) => deliverPush(id, payload, priority, null, keys)));
      pushed += counts.reduce((a, b) => a + b, 0);
    });
  }
  return { recipients: ids.length, inApp: rows.length, pushed };
}

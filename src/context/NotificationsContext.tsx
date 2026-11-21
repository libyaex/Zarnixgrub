/**
 * Notification center state: list + unread count, live updates (Supabase
 * Realtime, with polling as a safety net), in-app toasts, app-icon badge and
 * Web Push subscription management.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiJson, apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getRegistration, setAppBadge, urlBase64ToUint8Array } from '../lib/pwa';
import { navigateTo } from '../lib/nav';
import {
  DEFAULT_PREFERENCES, type NotificationPreferences, type NotificationRow,
} from '../shared/notificationTypes';

export interface PushState {
  supported: boolean;
  configured: boolean; // server has VAPID keys
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}

export interface Toast { id: string; title: string; body: string; link: string | null; type: NotificationRow['type'] }

interface Ctx {
  items: NotificationRow[];
  unread: number;
  loading: boolean;
  hasMore: boolean;
  toasts: Toast[];
  preferences: NotificationPreferences;
  push: PushState;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  open: (n: Pick<NotificationRow, 'id' | 'link' | 'read_at'>) => void;
  dismissToast: (id: string) => void;
  savePreferences: (p: NotificationPreferences) => Promise<void>;
  enablePush: () => Promise<{ ok: boolean; reason?: string }>;
  disablePush: () => Promise<void>;
  sendTest: () => Promise<void>;
}

const NotificationsContext = createContext<Ctx | null>(null);
export const useNotifications = (): Ctx => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
};

const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [push, setPush] = useState<PushState>({ supported: pushSupported(), configured: false, permission: pushSupported() ? Notification.permission : 'unsupported', subscribed: false });
  const seen = useRef(new Map<string, string>()); // id -> created_at already toasted

  const showToast = useCallback((n: NotificationRow) => {
    if (n.read_at) return;
    if (seen.current.get(n.id) === n.created_at) return;
    seen.current.set(n.id, n.created_at);
    setToasts((prev) => [{ id: n.id, title: n.title, body: n.body, link: n.link, type: n.type }, ...prev.filter((t) => t.id !== n.id)].slice(0, 3));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 7000);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiJson<{ items: NotificationRow[]; unread_count: number; next_cursor: string | null }>('/api/notifications?limit=20');
      setItems(data.items);
      setUnread(data.unread_count);
      setCursor(data.next_cursor);
      data.items.forEach((n) => { if (!seen.current.has(n.id)) seen.current.set(n.id, n.created_at); });
    } catch { /* offline: keep the last list */ }
  }, [userId]);

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    try { setUnread((await apiJson<{ count: number }>('/api/notifications/unread-count')).count); } catch { /* ignore */ }
  }, [userId]);

  // Initial load + reset on user change.
  useEffect(() => {
    setItems([]); setUnread(0); setCursor(null); setToasts([]); seen.current.clear();
    if (!userId) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
    apiJson<NotificationPreferences>('/api/notifications/preferences').then(setPreferences).catch(() => {});
  }, [userId, refresh]);

  // Live updates: Realtime first, polling + focus refresh as a safety net.
  useEffect(() => {
    if (!userId) return;
    let debounce: number | undefined;
    const onChange = (payload: any) => {
      const row = payload.new as NotificationRow | undefined;
      if (row && payload.eventType !== 'DELETE') showToast(row);
      window.clearTimeout(debounce);
      debounce = window.setTimeout(refresh, 250);
    };
    const channel = supabase
      ?.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange)
      .subscribe();
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') refreshCount(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(debounce);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [userId, refresh, refreshCount, showToast]);

  // Keep the app-icon badge in sync with the unread count.
  useEffect(() => { setAppBadge(userId ? unread : 0); }, [unread, userId]);

  // Messages from the service worker (push received while open, notification click).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'push-received') refresh();
      if (msg?.type === 'navigate' && typeof msg.url === 'string') navigateTo(msg.url);
      if (msg?.type === 'resubscribe') void syncSubscription();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, userId]);

  const syncSubscription = useCallback(async () => {
    if (!userId || !pushSupported()) return;
    try {
      const cfg = await apiJson<{ enabled: boolean; public_key: string | null }>('/api/notifications/push/config');
      const reg = (await navigator.serviceWorker.getRegistration()) ?? getRegistration();
      const existing = reg ? await reg.pushManager.getSubscription() : null;
      setPush({ supported: true, configured: cfg.enabled, permission: Notification.permission, subscribed: Boolean(existing) });
      // Idempotent re-sync: the browser may have rotated the endpoint, or the user switched accounts.
      if (existing && Notification.permission === 'granted') {
        await apiJson('/api/notifications/push/subscribe', { method: 'POST', body: existing.toJSON() });
      }
    } catch { /* offline */ }
  }, [userId]);
  useEffect(() => { void syncSubscription(); }, [syncSubscription]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) && !n.read_at ? { ...n, read_at: now } : n)));
    setUnread((u) => Math.max(0, u - ids.length));
    try { setUnread((await apiJson<{ unread_count: number }>('/api/notifications/read', { method: 'POST', body: { ids } })).unread_count); } catch { await refresh(); }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    try { await apiJson('/api/notifications/read', { method: 'POST', body: { all: true } }); } catch { await refresh(); }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try { setUnread((await apiJson<{ unread_count: number }>(`/api/notifications/${id}`, { method: 'DELETE' })).unread_count); } catch { await refresh(); }
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    try {
      const data = await apiJson<{ items: NotificationRow[]; next_cursor: string | null }>(`/api/notifications?limit=20&before=${encodeURIComponent(cursor)}`);
      setItems((prev) => [...prev, ...data.items.filter((n) => !prev.some((p) => p.id === n.id))]);
      setCursor(data.next_cursor);
    } catch { /* ignore */ }
  }, [cursor]);

  const open = useCallback((n: Pick<NotificationRow, 'id' | 'link' | 'read_at'>) => {
    if (!n.read_at) void markRead([n.id]);
    if (n.link) navigateTo(n.link);
  }, [markRead]);

  const savePreferences = useCallback(async (p: NotificationPreferences) => {
    const saved = await apiJson<NotificationPreferences>('/api/notifications/preferences', { method: 'PUT', body: { ...p, tz_offset_minutes: -new Date().getTimezoneOffset() } });
    setPreferences(saved);
  }, []);

  const enablePush = useCallback(async () => {
    if (!pushSupported()) return { ok: false, reason: 'متصفحك لا يدعم الإشعارات. على iPhone ثبّت التطبيق على الشاشة الرئيسية أولاً.' };
    const cfg = await apiJson<{ enabled: boolean; public_key: string | null }>('/api/notifications/push/config');
    if (!cfg.enabled || !cfg.public_key) return { ok: false, reason: 'إشعارات الهاتف غير مفعّلة من الخادم بعد (مفاتيح VAPID).' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPush((p) => ({ ...p, permission }));
      return { ok: false, reason: 'لم تمنح إذن الإشعارات. يمكنك تفعيله من إعدادات المتصفح.' };
    }
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.public_key) as BufferSource,
    }));
    await apiJson('/api/notifications/push/subscribe', { method: 'POST', body: sub.toJSON() });
    setPush({ supported: true, configured: true, permission, subscribed: true });
    return { ok: true };
  }, []);

  const disablePush = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await apiFetch('/api/notifications/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setPush((p) => ({ ...p, subscribed: false }));
  }, []);

  const sendTest = useCallback(async () => { await apiJson('/api/notifications/push/test', { method: 'POST' }); }, []);

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return (
    <NotificationsContext.Provider value={{
      items, unread, loading, hasMore: Boolean(cursor), toasts, preferences, push,
      refresh, loadMore, markRead, markAllRead, remove, open, dismissToast, savePreferences, enablePush, disablePush, sendTest,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};

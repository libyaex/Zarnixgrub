import React, { useEffect, useRef, useState } from 'react';
import {
  Bell, BellRing, ShoppingBag, Banknote, Tag, CheckCircle2, XCircle, Package, Wrench, Download,
  ShieldCheck, Megaphone, Trash2, Check, X,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { NOTIFICATION_TYPES, type NotificationRow } from '../../shared/notificationTypes';
import { navigateTo } from '../../lib/nav';

const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  ShoppingBag, Banknote, Tag, CheckCircle2, XCircle, Package, Wrench, Download, ShieldCheck, Megaphone, Bell,
};

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'الآن';
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? 'أمس' : d === 2 ? 'قبل يومين' : `قبل ${d} أيام`;
  return new Date(iso).toLocaleDateString('ar-LY', { day: 'numeric', month: 'short' });
}

export const NotificationItem: React.FC<{
  n: NotificationRow; onOpen: (n: NotificationRow) => void; onRemove?: (id: string) => void; compact?: boolean;
}> = ({ n, onOpen, onRemove, compact }) => {
  const meta = NOTIFICATION_TYPES[n.type] ?? NOTIFICATION_TYPES.system;
  const Icon = ICONS[meta.icon] ?? Bell;
  const unread = !n.read_at;
  const count = Number((n.data as any)?.count ?? 1);
  return (
    <div className={`group relative flex items-start gap-3 ${compact ? 'p-3' : 'p-4'} transition-colors ${unread ? 'bg-emerald-500/[0.06]' : ''} hover:bg-slate-800/50`}>
      <button onClick={() => onOpen(n)} className="flex items-start gap-3 flex-1 min-w-0 text-right cursor-pointer">
        <span className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}1f` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`text-sm truncate ${unread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>{n.title}</span>
            {n.priority === 'high' && unread && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5 shrink-0">مهم</span>}
            {count > 1 && <span className="text-[10px] font-mono text-slate-400 bg-slate-800 rounded px-1.5 shrink-0">×{count}</span>}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</span>
          <span className="block text-[11px] text-slate-500 mt-1">{timeAgo(n.created_at)}</span>
        </span>
        {unread && <span className="mt-2 w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-label="غير مقروء" />}
      </button>
      {onRemove && (
        <button onClick={() => onRemove(n.id)} aria-label="حذف الإشعار" className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-opacity">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

/** Bell with unread badge and a dropdown preview of the latest notifications. */
export const NotificationBell: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { items, unread, open, markAllRead } = useNotifications();
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [show]);

  const Icon = unread > 0 ? BellRing : Bell;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setShow((s) => !s)}
        aria-label={unread ? `الإشعارات (${unread} غير مقروء)` : 'الإشعارات'}
        aria-expanded={show}
        className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-white hover:border-emerald-500/50 transition-colors cursor-pointer"
      >
        <Icon className={`w-4 h-4 ${unread ? 'text-emerald-400' : ''}`} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {show && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-12 w-[min(92vw,22rem)] rounded-2xl border border-slate-700 bg-[#0b111c] shadow-2xl shadow-black/60 overflow-hidden z-[90] animate-fade-in" role="dialog" aria-label="الإشعارات">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-bold text-white">الإشعارات</span>
            {unread > 0 && (
              <button onClick={() => markAllRead()} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800/70">
            {items.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                لا توجد إشعارات بعد
              </div>
            ) : (
              items.slice(0, 6).map((n) => (
                <NotificationItem key={n.id} n={n} compact onOpen={(x) => { setShow(false); open(x); }} />
              ))
            )}
          </div>
          <button onClick={() => { setShow(false); navigateTo('/notifications'); }} className="w-full py-2.5 text-xs font-bold text-emerald-400 hover:bg-slate-800/60 border-t border-slate-800 cursor-pointer">
            عرض كل الإشعارات وإعداداتها
          </button>
        </div>
      )}
    </div>
  );
};

/** Live toasts for notifications that arrive while the app is open. */
export const ToastHost: React.FC = () => {
  const { toasts, dismissToast, markRead } = useNotifications();
  if (!toasts.length) return null;
  return (
    <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:left-4 sm:w-96 z-[75] space-y-2 pointer-events-none" aria-live="polite">
      {toasts.map((t) => {
        const meta = NOTIFICATION_TYPES[t.type] ?? NOTIFICATION_TYPES.system;
        const Icon = ICONS[meta.icon] ?? Bell;
        return (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-700 bg-[#0b111c]/95 backdrop-blur-xl p-3 shadow-2xl animate-fade-in">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}22` }}>
              <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
            </span>
            <button
              className="flex-1 min-w-0 text-right cursor-pointer"
              onClick={() => { dismissToast(t.id); void markRead([t.id]); if (t.link) navigateTo(t.link); }}
            >
              <span className="block text-sm font-bold text-white truncate">{t.title}</span>
              <span className="block text-xs text-slate-400 line-clamp-2">{t.body}</span>
            </button>
            <button onClick={() => dismissToast(t.id)} aria-label="إغلاق" className="text-slate-500 hover:text-white p-1 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        );
      })}
    </div>
  );
};

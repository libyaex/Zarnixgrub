import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Check, Moon, Send, Smartphone, Loader2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { NotificationItem } from '../components/notifications/NotificationUI';
import { isIOS, isStandalone } from '../lib/pwa';
import { errorMessage } from '../lib/api';
import {
  NOTIFICATION_TYPES, NOTIFICATION_TYPE_KEYS, type NotificationPreferences, type NotificationType,
} from '../shared/notificationTypes';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
  >
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'right-[1.375rem]'}`} />
  </button>
);

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const n = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [prefs, setPrefs] = useState<NotificationPreferences>(n.preferences);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<'list' | 'settings'>('list');

  useEffect(() => { setPrefs(n.preferences); }, [n.preferences]);
  useEffect(() => { void n.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (filter === 'unread' ? n.items.filter((i) => !i.read_at) : n.items), [n.items, filter]);
  const types = NOTIFICATION_TYPE_KEYS.filter((k) => NOTIFICATION_TYPES[k].audience === 'customer' || user?.is_staff);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMessage(null);
    try { await fn(); setMessage({ ok: true, text: ok }); } catch (e) { setMessage({ ok: false, text: errorMessage(e) }); } finally { setBusy(false); }
  };

  const toggleType = (t: NotificationType, enabled: boolean) =>
    setPrefs((p) => ({ ...p, muted_types: enabled ? p.muted_types.filter((x) => x !== t) : [...new Set([...p.muted_types, t])] }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2"><Bell className="w-6 h-6 text-emerald-400" /> الإشعارات</h1>
        <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 text-xs font-bold">
          {(['list', 'settings'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg cursor-pointer transition-colors ${tab === t ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
              {t === 'list' ? 'الإشعارات' : 'الإعدادات'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'list' && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex gap-2 text-xs font-bold">
              {(['all', 'unread'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-lg cursor-pointer ${filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {f === 'all' ? 'الكل' : `غير المقروءة${n.unread ? ` (${n.unread})` : ''}`}
                </button>
              ))}
            </div>
            <button onClick={() => n.markAllRead()} disabled={!n.unread} className="text-xs text-emerald-400 disabled:text-slate-600 flex items-center gap-1 cursor-pointer disabled:cursor-default">
              <Check className="w-3.5 h-3.5" /> تعليم الكل كمقروء
            </button>
          </div>
          {n.loading && !n.items.length ? (
            <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <BellOff className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات بعد'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {shown.map((item) => <NotificationItem key={item.id} n={item} onOpen={n.open} onRemove={n.remove} />)}
            </div>
          )}
          {n.hasMore && filter === 'all' && (
            <button onClick={() => n.loadMore()} className="w-full py-3 text-xs font-bold text-slate-300 hover:bg-slate-800/60 border-t border-slate-800 cursor-pointer">تحميل المزيد</button>
          )}
        </section>
      )}

      {tab === 'settings' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Smartphone className="w-4 h-4 text-sky-400" /> إشعارات الهاتف والمتصفح</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">تصلك فوراً حتى والتطبيق مغلق: اعتماد الدفع، حالة الطلب، تحديثات الخدمة.</p>
            {isIOS() && !isStandalone() && (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3">على iPhone: ثبّت التطبيق أولاً من Safari («مشاركة» ثم «إضافة إلى الشاشة الرئيسية») ثم افتحه من الأيقونة لتفعيل الإشعارات.</p>
            )}
            {!n.push.supported ? (
              <p className="text-xs text-slate-400">هذا المتصفح لا يدعم إشعارات الهاتف. ستظل الإشعارات تظهر داخل التطبيق.</p>
            ) : !n.push.configured ? (
              <p className="text-xs text-slate-400">لم تُفعَّل إشعارات الهاتف من الخادم بعد. ستظل الإشعارات تظهر داخل التطبيق.</p>
            ) : n.push.permission === 'denied' ? (
              <p className="text-xs text-rose-300">الإذن محظور في المتصفح. فعّله من إعدادات الموقع ثم أعد المحاولة.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {n.push.subscribed ? (
                  <>
                    <button disabled={busy} onClick={() => run(() => n.sendTest(), 'أُرسل إشعار تجريبي إلى هذا الجهاز')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"><Send className="w-3.5 h-3.5" /> إشعار تجريبي</button>
                    <button disabled={busy} onClick={() => run(() => n.disablePush(), 'تم إيقاف إشعارات هذا الجهاز')} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-rose-300 text-xs font-bold cursor-pointer">إيقاف على هذا الجهاز</button>
                  </>
                ) : (
                  <button disabled={busy} onClick={() => run(async () => { const r = await n.enablePush(); if (!r.ok) throw new Error(r.reason); }, 'تم تفعيل الإشعارات على هذا الجهاز')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"><Bell className="w-3.5 h-3.5" /> تفعيل إشعارات هذا الجهاز</button>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-white">الإشعارات داخل التطبيق</p><p className="text-xs text-slate-400">الجرس والتنبيهات المنبثقة</p></div>
              <Toggle checked={prefs.in_app} onChange={(v) => setPrefs({ ...prefs, in_app: v })} label="الإشعارات داخل التطبيق" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-white">إشعارات الهاتف (Push)</p><p className="text-xs text-slate-400">تصل حتى والتطبيق مغلق</p></div>
              <Toggle checked={prefs.push} onChange={(v) => setPrefs({ ...prefs, push: v })} label="إشعارات الهاتف" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Moon className="w-4 h-4 text-violet-400" /> ساعات الهدوء</h2>
            <p className="text-xs text-slate-400 mb-3">لا تصلك إشعارات الهاتف في هذه الفترة (الإشعارات المهمة جداً تتجاوزها). تبقى كل الإشعارات في الجرس.</p>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-2 text-slate-300">من
                <select value={prefs.quiet_start ?? ''} onChange={(e) => setPrefs({ ...prefs, quiet_start: e.target.value === '' ? null : Number(e.target.value), quiet_end: e.target.value === '' ? null : prefs.quiet_end ?? 7 })} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white">
                  <option value="">بدون</option>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-slate-300">إلى
                <select value={prefs.quiet_end ?? ''} disabled={prefs.quiet_start === null} onChange={(e) => setPrefs({ ...prefs, quiet_end: e.target.value === '' ? null : Number(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white disabled:opacity-40">
                  <option value="">—</option>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-bold text-white mb-3">أنواع الإشعارات</h2>
            <div className="divide-y divide-slate-800/70">
              {types.map((t) => (
                <div key={t} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-slate-200">{NOTIFICATION_TYPES[t].label}</span>
                  <Toggle checked={!prefs.muted_types.includes(t)} onChange={(v) => toggleType(t, v)} label={NOTIFICATION_TYPES[t].label} />
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button disabled={busy} onClick={() => run(() => n.savePreferences(prefs), 'تم حفظ التفضيلات')} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer">حفظ التفضيلات</button>
            {message && <span className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

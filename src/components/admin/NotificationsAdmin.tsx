import React, { useEffect, useState } from 'react';
import { Megaphone, Send, Smartphone, CheckCircle2, AlertTriangle, Loader2, Users, UserCog, Globe } from 'lucide-react';
import { apiJson, errorMessage } from '../../lib/api';
import { useNotifications } from '../../context/NotificationsContext';

interface Status { push_configured: boolean; push_subscriptions: number; unread_total: number }
const AUDIENCES = [
  { id: 'all', label: 'الجميع', icon: Globe },
  { id: 'customers', label: 'العملاء فقط', icon: Users },
  { id: 'staff', label: 'الإدارة فقط', icon: UserCog },
] as const;

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500';

export const NotificationsAdmin: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const { sendTest } = useNotifications();
  const [status, setStatus] = useState<Status | null>(null);
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]['id']>('customers');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [sending, setSending] = useState(false);

  const loadStatus = () => apiJson<Status>('/api/admin/notifications/status').then(setStatus).catch(() => setStatus(null));
  useEffect(() => { void loadStatus(); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) { onToast('اكتب عنوان الإشعار ونصه'); return; }
    if (!confirm(`سيصل هذا الإشعار إلى «${AUDIENCES.find((a) => a.id === audience)!.label}». متابعة؟`)) return;
    setSending(true);
    try {
      const r = await apiJson<{ recipients: number; inApp: number; pushed: number }>('/api/admin/notifications/broadcast', {
        method: 'POST', body: { audience, title: title.trim(), body: body.trim(), link: link.trim() || null, priority },
      });
      onToast(`أُرسل إلى ${r.recipients} مستخدم (${r.pushed} على الهاتف)`);
      setTitle(''); setBody(''); setLink('');
      void loadStatus();
    } catch (e) {
      onToast(errorMessage(e, 'تعذر إرسال الإشعار'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">الإشعارات والبث</h2>
        <p className="text-xs text-slate-400 mt-0.5">أرسل إعلاناً لعملائك أو فريقك، وتحقّق من جاهزية إشعارات الهاتف. تحديد أي الأحداث تُرسل إشعاراً تلقائياً من «الإعدادات ← الإشعارات».</p>
      </div>

      <section className="grid sm:grid-cols-3 gap-3">
        <div className={`rounded-2xl border p-4 ${status?.push_configured ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            {status?.push_configured ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            إشعارات الهاتف
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            {status === null ? 'جارٍ الفحص…' : status.push_configured ? 'مفعّلة (مفاتيح VAPID مضبوطة).' : 'غير مفعّلة. شغّل node scripts/generate-vapid.mjs وأضف المفاتيح في متغيرات Vercel ثم أعد النشر. حتى ذلك الحين تعمل الإشعارات داخل التطبيق فقط.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> أجهزة مشتركة</p>
          <p className="text-2xl font-black text-white mt-1 tabular-nums">{status?.push_subscriptions ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-[11px] text-slate-400">إشعارات غير مقروءة (الكل)</p>
          <p className="text-2xl font-black text-white mt-1 tabular-nums">{status?.unread_total ?? '—'}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Megaphone className="w-4 h-4 text-rose-400" /> إرسال إعلان</h3>

        <div className="flex gap-2 flex-wrap">
          {AUDIENCES.map((a) => (
            <button key={a.id} onClick={() => setAudience(a.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${audience === a.id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'}`}>
              <a.icon className="w-3.5 h-3.5" /> {a.label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 flex justify-between mb-1.5"><span>العنوان</span><span className="text-slate-500 font-normal">{title.length}/90</span></label>
          <input value={title} maxLength={90} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: خصم 20% على جميع الأنظمة حتى الجمعة" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-300 flex justify-between mb-1.5"><span>النص</span><span className="text-slate-500 font-normal">{body.length}/220</span></label>
          <textarea value={body} maxLength={220} rows={3} onChange={(e) => setBody(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">الرابط عند الضغط (اختياري)</label>
            <input dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/products?filter=featured" className={`${inputCls} font-mono text-xs`} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">الأولوية</label>
            <div className="flex gap-2">
              {(['normal', 'high'] as const).map((p) => (
                <button key={p} onClick={() => setPriority(p)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${priority === p ? 'bg-slate-700 text-white' : 'bg-slate-950 border border-slate-800 text-slate-400'}`}>
                  {p === 'normal' ? 'عادية (تحترم ساعات الهدوء)' : 'مهمة (تتجاوزها)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {title && (
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex gap-3 items-start" aria-label="معاينة">
            <span className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0"><Megaphone className="w-4 h-4 text-rose-400" /></span>
            <div className="min-w-0"><p className="text-sm font-bold text-white truncate">{title}</p><p className="text-xs text-slate-400 line-clamp-2">{body}</p></div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={send} disabled={sending} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold cursor-pointer disabled:opacity-60">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
          </button>
          <button onClick={() => sendTest().then(() => onToast('أُرسل إشعار تجريبي إليك')).catch((e) => onToast(errorMessage(e)))} className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-sm font-bold cursor-pointer">
            إشعار تجريبي لي
          </button>
        </div>
      </section>
    </div>
  );
};

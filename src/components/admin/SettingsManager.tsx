/**
 * Dashboard -> Settings. Schema-driven: every field comes from
 * src/shared/siteSchema.ts, so adding a setting there adds it here AND to the
 * API validation automatically. Handles image upload (logo, favicon, share
 * image) and generates all PWA icons from the logo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Save, Upload, ImageIcon, Wand2, RotateCcw, Search, ExternalLink } from 'lucide-react';
import { apiJson, errorMessage } from '../../lib/api';
import { uploadPublicImage } from '../../lib/uploads';
import { generateIcons } from '../../lib/iconGen';
import { useSite } from '../../context/SiteContext';
import {
  GROUP_LABELS, SETTINGS_SCHEMA, defaultSettings, mergeSettings, validateSettingsUpdate,
  type SettingField, type SettingGroup, type SiteConfig,
} from '../../shared/siteSchema';

const GROUP_ORDER: SettingGroup[] = ['brand', 'hero', 'seo', 'pwa', 'contact', 'social', 'store', 'notifications'];

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500';

interface Props { onToast: (m: string) => void }

export const SettingsManager: React.FC<Props> = ({ onToast }) => {
  const live = useSite();
  const [saved, setSaved] = useState<SiteConfig>(mergeSettings({}));
  const [draft, setDraft] = useState<SiteConfig>(mergeSettings({}));
  const [group, setGroup] = useState<SettingGroup>('brand');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyField, setBusyField] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    apiJson<Record<string, unknown>>('/api/admin/settings')
      .then((s) => { const m = mergeSettings(s); setSaved(m); setDraft(m); })
      .catch((e) => onToast(errorMessage(e, 'تعذر تحميل الإعدادات')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirtyKeys = useMemo(() => SETTINGS_SCHEMA.map((f) => f.key).filter((k) => draft[k] !== saved[k]), [draft, saved]);
  const set = (key: string, value: string | number | boolean) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async (keys: string[] = dirtyKeys, source: SiteConfig = draft) => {
    if (!keys.length) { onToast('لا توجد تغييرات للحفظ'); return; }
    const payload = Object.fromEntries(keys.map((k) => [k, source[k]]));
    const check = validateSettingsUpdate(payload);
    if (!check.ok) { onToast(check.errors[0]); return; }
    setSaving(true);
    try {
      await apiJson('/api/admin/settings', { method: 'PUT', body: { settings: check.values } });
      setSaved((s) => ({ ...s, ...check.values }));
      setDraft((d) => ({ ...d, ...check.values }));
      onToast('تم حفظ الإعدادات وتطبيقها على المنصة');
    } catch (e) {
      onToast(errorMessage(e, 'تعذر حفظ الإعدادات'));
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (field: SettingField, file: File) => {
    setBusyField(field.key);
    try {
      const url = await uploadPublicImage(file, file.name);
      set(field.key, url);
      onToast('تم رفع الصورة. اضغط «حفظ» لتطبيقها.');
    } catch (e) {
      onToast(errorMessage(e, 'تعذر رفع الصورة'));
    } finally {
      setBusyField(null);
    }
  };

  /** Logo -> all PWA icons + favicon, uploaded and filled into the form. */
  const generatePwaIcons = async () => {
    const logoUrl = String(draft.logo_url || '');
    if (!logoUrl) { onToast('ارفع الشعار أولاً'); return; }
    setBusyField('__icons');
    try {
      const blob = await (await fetch(logoUrl)).blob();
      const icons = await generateIcons(blob, String(draft.pwa_background_color || '#06090f'));
      const [i192, i512, mask, fav] = await Promise.all([
        uploadPublicImage(icons.icon192, 'icon-192.png'),
        uploadPublicImage(icons.icon512, 'icon-512.png'),
        uploadPublicImage(icons.maskable512, 'icon-maskable-512.png'),
        uploadPublicImage(icons.favicon64, 'favicon-64.png'),
      ]);
      setDraft((d) => ({ ...d, pwa_icon_192: i192, pwa_icon_512: i512, pwa_icon_maskable: mask, favicon_url: fav }));
      onToast('تم توليد أيقونات التطبيق من الشعار. اضغط «حفظ» لتطبيقها.');
    } catch (e) {
      onToast(errorMessage(e, 'تعذر توليد الأيقونات'));
    } finally {
      setBusyField(null);
    }
  };

  const fields = SETTINGS_SCHEMA.filter((f) => f.group === group);
  const groupDirty = (g: SettingGroup) => SETTINGS_SCHEMA.filter((f) => f.group === g && draft[f.key] !== saved[f.key]).length;

  if (loading) return <div className="py-20 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const renderField = (f: SettingField) => {
    const value = draft[f.key];
    const changed = value !== saved[f.key];
    const labelEl = (
      <label className="flex items-center justify-between gap-2 text-slate-300 text-xs font-bold mb-1.5">
        <span>{f.label}</span>
        {changed && <span className="text-amber-400 text-[10px]">معدّل</span>}
      </label>
    );
    const help = f.help ? <p className="text-[11px] text-slate-500 mt-1">{f.help}</p> : null;

    if (f.type === 'boolean') {
      return (
        <div key={f.key} className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
          <div className="min-w-0"><p className="text-sm font-bold text-white">{f.label}</p>{help}</div>
          <button
            type="button" role="switch" aria-checked={Boolean(value)} aria-label={f.label} onClick={() => set(f.key, !value)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${value ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'right-0.5' : 'right-[1.375rem]'}`} />
          </button>
        </div>
      );
    }
    if (f.type === 'image') {
      const url = String(value || '');
      return (
        <div key={f.key}>
          {labelEl}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {url ? <img src={url} alt="" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="w-6 h-6 text-slate-600" />}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <input type="text" dir="ltr" value={url} onChange={(e) => set(f.key, e.target.value)} placeholder="https://… أو /path.png" className={`${inputCls} font-mono text-xs`} />
              <div className="flex gap-2">
                <input ref={(el) => { fileInputs.current[f.key] = el; }} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(f, file); e.target.value = ''; }} />
                <button type="button" disabled={busyField === f.key} onClick={() => fileInputs.current[f.key]?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white cursor-pointer">
                  {busyField === f.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} رفع صورة
                </button>
                {changed && <button type="button" onClick={() => set(f.key, saved[f.key])} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"><RotateCcw className="w-3 h-3" /> تراجع</button>}
              </div>
            </div>
          </div>
          {help}
        </div>
      );
    }
    if (f.type === 'color') {
      return (
        <div key={f.key}>
          {labelEl}
          <div className="flex items-center gap-3">
            <input type="color" value={String(value)} onChange={(e) => set(f.key, e.target.value)} className="w-12 h-10 rounded-lg bg-transparent border border-slate-700 cursor-pointer" aria-label={f.label} />
            <input type="text" dir="ltr" value={String(value)} onChange={(e) => set(f.key, e.target.value)} className={`${inputCls} font-mono w-32`} />
          </div>
          {help}
        </div>
      );
    }
    if (f.type === 'number') {
      return (
        <div key={f.key}>
          {labelEl}
          <input type="number" min={f.min} max={f.max} value={Number(value)} onChange={(e) => set(f.key, e.target.value === '' ? 0 : Number(e.target.value))} className={`${inputCls} w-40`} />
          {help}
        </div>
      );
    }
    if (f.type === 'text') {
      return (
        <div key={f.key}>
          {labelEl}
          <textarea rows={3} maxLength={f.max} value={String(value)} onChange={(e) => set(f.key, e.target.value)} className={`${inputCls} resize-y`} />
          <p className="text-[11px] text-slate-500 mt-1 flex justify-between"><span>{help ? f.help : ''}</span>{f.max && <span>{String(value).length}/{f.max}</span>}</p>
        </div>
      );
    }
    const ltr = f.type === 'url' || f.type === 'email';
    return (
      <div key={f.key}>
        {labelEl}
        <input type={f.type === 'email' ? 'email' : 'text'} dir={ltr ? 'ltr' : undefined} maxLength={f.max} value={String(value)} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
        {help}
      </div>
    );
  };

  const seoTitle = String(draft.seo_title);
  const seoDesc = String(draft.seo_description);

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">إعدادات المنصة</h2>
          <p className="text-xs text-slate-400 mt-0.5">كل ما تغيّره هنا يظهر فوراً للزوار: الشعار، الألوان، النصوص، SEO، تطبيق الهاتف، الإشعارات.</p>
        </div>
        <div className="flex gap-2">
          {dirtyKeys.length > 0 && (
            <button onClick={() => setDraft(saved)} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:text-white cursor-pointer">تجاهل التغييرات</button>
          )}
          <button onClick={() => save()} disabled={saving || !dirtyKeys.length} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 text-sm font-bold cursor-pointer transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ{dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {GROUP_ORDER.map((g) => (
          <button key={g} role="tab" aria-selected={group === g} onClick={() => setGroup(g)}
            className={`relative px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${group === g ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'}`}>
            {GROUP_LABELS[g].title}
            {groupDirty(g) > 0 && <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] flex items-center justify-center">{groupDirty(g)}</span>}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-5">
        <p className="text-xs text-slate-400">{GROUP_LABELS[group].description}</p>

        {group === 'pwa' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <Wand2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs text-slate-300 flex-1 min-w-[12rem]">ولّد كل الأيقونات (192، 512، Maskable، Favicon) تلقائياً من الشعار المرفوع في «الهوية».</p>
            <button onClick={generatePwaIcons} disabled={busyField === '__icons'} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer">
              {busyField === '__icons' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} توليد الأيقونات من الشعار
            </button>
          </div>
        )}

        {group === 'seo' && (
          <div className="rounded-xl bg-white p-4 text-right" dir="rtl" aria-label="معاينة نتيجة Google">
            <p className="text-[11px] text-slate-500 flex items-center gap-1"><Search className="w-3 h-3" /> معاينة نتيجة البحث في Google</p>
            <p className="text-[#1a0dab] text-lg leading-snug mt-1 truncate">{seoTitle || String(draft.store_name)}</p>
            <p className="text-[#006621] text-xs">{String(draft.canonical_domain || live.canonical_domain || 'https://your-domain.com')}</p>
            <p className="text-[#545454] text-sm leading-snug line-clamp-2">{seoDesc}</p>
            <p className={`text-[10px] mt-2 ${seoTitle.length > 60 ? 'text-rose-600' : 'text-slate-400'}`}>العنوان: {seoTitle.length}/60 · الوصف: {seoDesc.length}/160</p>
          </div>
        )}

        {group === 'seo' && draft.require_login_to_browse && (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            تنبيه: المتجر حالياً يتطلب تسجيل الدخول للتصفح، لذلك تُرسل الصفحات لمحركات البحث بوسم noindex ولن تُفهرس. عطّل «اشتراط تسجيل الدخول لتصفح المتجر» من تبويب «المتجر والتسليم» لتفعيل الفهرسة.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-5">
          {fields.map((f) => (
            <div key={f.key} className={f.type === 'text' || f.type === 'boolean' || f.type === 'image' ? 'sm:col-span-2' : ''}>{renderField(f)}</div>
          ))}
        </div>

        {group === 'seo' && (
          <div className="flex flex-wrap gap-3 text-xs">
            {['/robots.txt', '/sitemap.xml', '/manifest.webmanifest'].map((p) => (
              <a key={p} href={p} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono"><ExternalLink className="w-3 h-3" />{p}</a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export { defaultSettings };

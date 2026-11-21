import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Share, PlusSquare, WifiOff, X, CheckCircle2 } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { applyUpdate, isIOSSafari, isStandalone } from '../../lib/pwa';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const VISITS_KEY = 'pwa_visits';
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Offer installation only to engaged visitors (2nd visit or 30s), never twice in a week. */
export const InstallPrompt: React.FC = () => {
  const site = useSite();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const visits = Number(localStorage.getItem(VISITS_KEY) || '0') + 1;
    localStorage.setItem(VISITS_KEY, String(visits));
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || '0');
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000;
    setHidden(recentlyDismissed);

    const timer = window.setTimeout(() => setEngaged(true), visits >= 2 ? 3000 : 30_000);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setDeferred(null); setHidden(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setHidden(true); setShowIosHelp(false); };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'dismissed') dismiss(); else setHidden(true);
  };

  const canInstall = Boolean(deferred) || isIOSSafari();
  if (hidden || !engaged || !canInstall || isStandalone()) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 lg:bottom-6 lg:right-6 lg:left-auto lg:w-96 z-[60] animate-fade-in" role="dialog" aria-label="تثبيت التطبيق">
      <div className="rounded-2xl border border-emerald-500/30 bg-[#0b111c]/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-4">
        <div className="flex items-start gap-3">
          <img src={String(site.pwa_icon_192 || site.logo_url)} alt="" className="w-12 h-12 rounded-xl bg-slate-900 object-contain p-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">ثبّت تطبيق {site.pwa_short_name || site.store_name}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              وصول أسرع من شاشتك الرئيسية، إشعارات فورية بحالة طلباتك، ويعمل حتى مع ضعف الاتصال.
            </p>
          </div>
          <button onClick={dismiss} aria-label="إغلاق" className="text-slate-500 hover:text-white p-1 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {showIosHelp ? (
          <ol className="mt-3 text-xs text-slate-300 space-y-2 bg-slate-950/70 rounded-xl p-3 border border-slate-800">
            <li className="flex items-center gap-2"><Share className="w-4 h-4 text-sky-400 shrink-0" /> اضغط زر المشاركة في أسفل Safari</li>
            <li className="flex items-center gap-2"><PlusSquare className="w-4 h-4 text-emerald-400 shrink-0" /> اختر «إضافة إلى الشاشة الرئيسية»</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> افتح التطبيق من الأيقونة لتصلك الإشعارات</li>
          </ol>
        ) : (
          <button
            onClick={deferred ? install : () => setShowIosHelp(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm py-2.5 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" /> {deferred ? 'تثبيت التطبيق' : 'كيف أثبّت التطبيق؟'}
          </button>
        )}
      </div>
    </div>
  );
};

/** Appears when a new version has been installed in the background. */
export const UpdateBanner: React.FC<{ registration: ServiceWorkerRegistration | null }> = ({ registration }) => {
  if (!registration) return null;
  return (
    <div className="fixed top-3 inset-x-3 sm:left-auto sm:right-4 sm:w-96 z-[70] animate-fade-in" role="status">
      <div className="flex items-center gap-3 rounded-2xl border border-sky-500/40 bg-[#0b111c]/95 backdrop-blur-xl p-3 shadow-2xl">
        <RefreshCw className="w-5 h-5 text-sky-400 shrink-0" />
        <p className="text-sm text-slate-200 flex-1">يتوفر إصدار جديد من التطبيق</p>
        <button onClick={() => applyUpdate(registration)} className="rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold px-3 py-1.5 cursor-pointer">تحديث الآن</button>
      </div>
    </div>
  );
};

/** Thin status bar: offline notice, then a short "back online" confirmation. */
export const ConnectionBanner: React.FC = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    const off = () => { setOnline(false); setJustBack(false); };
    const on = () => { setOnline(true); setJustBack(true); window.setTimeout(() => setJustBack(false), 2500); };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, []);

  if (online && !justBack) return null;
  return (
    <div
      role="status"
      className={`fixed top-0 inset-x-0 z-[80] text-center text-xs font-bold py-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)] ${online ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}
    >
      {online ? 'عاد الاتصال بالإنترنت' : (<span className="inline-flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5" /> أنت غير متصل — تُعرض البيانات المحفوظة</span>)}
    </div>
  );
};

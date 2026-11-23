import React from 'react';
import { Check, Clock, AlertTriangle, Upload, Download, Loader2, XCircle, PackageCheck, Hourglass } from 'lucide-react';
import { describeOrder, type OrderLike, type Progress, type StepState, type Tone } from '../lib/orderStatus';
import { useSite } from '../context/SiteContext';

const TONES: Record<Tone, { box: string; icon: string; chip: string }> = {
  amber: { box: 'border-amber-500/30 bg-amber-500/[0.07]', icon: 'text-amber-400 bg-amber-500/15', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  sky: { box: 'border-sky-500/30 bg-sky-500/[0.07]', icon: 'text-sky-400 bg-sky-500/15', chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  emerald: { box: 'border-emerald-500/30 bg-emerald-500/[0.07]', icon: 'text-emerald-400 bg-emerald-500/15', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  rose: { box: 'border-rose-500/30 bg-rose-500/[0.07]', icon: 'text-rose-400 bg-rose-500/15', chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  slate: { box: 'border-slate-700 bg-slate-800/40', icon: 'text-slate-400 bg-slate-700/50', chip: 'bg-slate-700/60 text-slate-300 border-slate-600' },
};

const STAGE_ICON: Record<Progress['stage'], React.ComponentType<{ className?: string }>> = {
  awaiting_proof: Upload, verifying: Hourglass, approved: PackageCheck, delivered: PackageCheck,
  rejected: AlertTriangle, cancelled: XCircle, refunded: XCircle,
};

const ACTION_LABEL: Record<NonNullable<Progress['action']>, string> = {
  upload_proof: 'تحويل المبلغ وإرفاق الإيصال',
  reupload_proof: 'إعادة إرسال إثبات الدفع',
  open_downloads: 'فتح ملفاتي',
};

const StepDot: React.FC<{ state: StepState; index: number }> = ({ state, index }) => {
  if (state === 'done') return <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center"><Check className="w-4 h-4" strokeWidth={3} /></span>;
  if (state === 'attention') return <span className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-sm font-black">!</span>;
  if (state === 'current') {
    return (
      <span className="relative w-7 h-7 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center text-xs font-black">
        <span className="absolute inset-0 rounded-full bg-sky-400/50 animate-ping" aria-hidden />
        <span className="relative">{index + 1}</span>
      </span>
    );
  }
  return <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-500 flex items-center justify-center text-xs font-bold">{index + 1}</span>;
};

export const OrderSteps: React.FC<{ steps: Progress['steps'] }> = ({ steps }) => (
  <ol className="grid grid-cols-4 gap-1.5" aria-label="مراحل الطلب">
    {steps.map((s, i) => (
      <li key={s.key} className="flex flex-col items-center text-center gap-1.5 relative" aria-current={s.state === 'current' ? 'step' : undefined}>
        {i > 0 && <span className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-0 ${steps[i - 1].state === 'done' ? 'bg-emerald-500/60' : 'bg-slate-800'}`} aria-hidden />}
        <span className="relative z-10"><StepDot state={s.state} index={i} /></span>
        <span className={`text-[10px] sm:text-xs leading-tight px-0.5 ${s.state === 'todo' ? 'text-slate-500' : s.state === 'attention' ? 'text-rose-300 font-bold' : 'text-slate-200 font-semibold'}`}>{s.label}</span>
      </li>
    ))}
  </ol>
);

interface Props {
  order: OrderLike;
  /** Handles the primary action (open the proof modal / go to downloads). */
  onAction?: (action: NonNullable<Progress['action']>) => void;
  compact?: boolean;
  busy?: boolean;
}

/** Plain-language status for an order: what happened, what happens next, and what (if anything) the customer must do. */
export const OrderStatusTracker: React.FC<Props> = ({ order, onAction, compact, busy }) => {
  const site = useSite();
  const p = describeOrder(order, String(site.payment_review_eta || undefined));
  const tone = TONES[p.tone];
  const Icon = STAGE_ICON[p.stage];

  return (
    <section className={`rounded-2xl border ${tone.box} ${compact ? 'p-3.5 space-y-3' : 'p-5 space-y-5'}`} aria-live="polite" data-stage={p.stage}>
      <div className="flex items-start gap-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
          {p.waitingOnUs && p.stage === 'verifying' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-extrabold text-white ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>{p.headline}</h3>
            {compact && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tone.chip}`}>{p.badge}</span>}
          </div>
          {!compact && <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">{p.message}</p>}
        </div>
      </div>

      <OrderSteps steps={p.steps} />

      {compact && <p className="text-[11px] text-slate-400 leading-relaxed">{p.message}</p>}

      {p.action && onAction && (
        <button
          onClick={() => onAction(p.action!)}
          disabled={busy}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
            p.action === 'open_downloads' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : p.tone === 'rose' ? 'bg-rose-500 hover:bg-rose-400 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
          }`}
        >
          {p.action === 'open_downloads' ? <Download className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {ACTION_LABEL[p.action]}
        </button>
      )}

      {p.waitingOnUs && p.stage === 'verifying' && (
        <p className="flex items-center gap-1.5 text-[11px] text-sky-300/80"><Clock className="w-3.5 h-3.5" /> تصلك إشعارات فور أي تحديث، ويمكنك إغلاق الصفحة بأمان.</p>
      )}
    </section>
  );
};

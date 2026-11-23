import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle2, ImageIcon, ArrowLeft } from 'lucide-react';
import { Order, PaymentAccount } from '../types';
import { apiFetch, apiJson, errorMessage } from '../lib/api';
import { uploadViaSignedUrl } from '../lib/uploads';
import { useSite } from '../context/SiteContext';
import { methodMeta } from '../shared/paymentMethods';
import { PaymentMethodPicker, PaymentAccountDetails } from './PaymentMethodUI';
import { OrderStatusTracker } from './OrderStatusTracker';

interface Props {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (updated: Order) => void;
}

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500';
const MAX_BYTES = 10 * 1024 * 1024;

const StepTitle: React.FC<{ n: number; title: string; done?: boolean }> = ({ n, title, done }) => (
  <div className="flex items-center gap-2.5">
    <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{done ? '✓' : n}</span>
    <h3 className="text-sm font-bold text-white">{title}</h3>
  </div>
);

/**
 * Pay-and-prove flow: 1) choose the payment service, 2) see only that
 * service's details and pay, 3) upload the receipt. Ends with a clear
 * "we are now verifying" screen so the customer is never left guessing.
 */
export const BankTransferModal: React.FC<Props> = ({ order, isOpen, onClose, onSubmitted }) => {
  const site = useSite();
  const currency = String(site.currency || 'د.ل');
  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderBank, setSenderBank] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(order.total_amount));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Order | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDone(null); setError(null); setAmount(String(order.total_amount));
    apiFetch('/api/banks')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PaymentAccount[]) => {
        const active = Array.isArray(list) ? list : [];
        setAccounts(active);
        if (active.length === 1) setSelectedId(active[0].id); // nothing to choose
      })
      .catch(() => setAccounts([]));
  }, [isOpen, order.total_amount]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  const selected = useMemo(() => accounts?.find((a) => a.id === selectedId) ?? null, [accounts, selectedId]);
  const meta = methodMeta(selected?.method_type);
  const amountNumber = Number(amount);
  const amountDiffers = Number.isFinite(amountNumber) && Math.abs(amountNumber - Number(order.total_amount)) > 1;

  if (!isOpen) return null;

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setError('صيغة الإيصال غير مدعومة. استخدم صورة JPG أو PNG أو WebP.'); return; }
    if (f.size > MAX_BYTES) { setError('حجم الصورة كبير (الحد الأقصى 10 ميجابايت).'); return; }
    setError(null); setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(String(e.target?.result ?? ''));
    reader.readAsDataURL(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selected) { setError('اختر وسيلة الدفع التي استخدمتها أولاً.'); return; }
    if (!senderName.trim()) { setError('اكتب اسم صاحب الحساب الذي حوّلت منه.'); return; }
    if (!reference.trim()) { setError('اكتب رقم العملية أو المرجع الظاهر في الإيصال.'); return; }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) { setError('اكتب المبلغ الذي حوّلته.'); return; }
    if (!file) { setError('أرفق صورة إيصال التحويل.'); return; }

    setSubmitting(true);
    try {
      const uploaded = await uploadViaSignedUrl('receipt', file);
      const data = await apiJson<{ order?: Order }>('/api/payments/submit', {
        method: 'POST',
        body: {
          order_id: order.id,
          payment_account_id: selected.id,
          sender_name: senderName.trim(),
          sender_bank: senderBank.trim(),
          transaction_reference: reference.trim(),
          transferred_amount: amountNumber,
          transfer_date: date,
          receipt_storage_path: uploaded.path,
          notes: notes.trim(),
        },
      });
      setDone(data.order ?? { ...order, payment_status: 'under_review' });
    } catch (err) {
      setError(errorMessage(err, 'تعذر رفع إثبات الدفع. حاول مرة أخرى.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="إتمام الدفع وإرفاق الإيصال">
      <div className="bg-[#0b101d] border border-slate-800 sm:rounded-3xl rounded-t-3xl w-full max-w-2xl max-h-[94vh] overflow-y-auto shadow-2xl animate-fade-in">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-[#0b101d]/95 backdrop-blur border-b border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">{done ? 'تم استلام إثبات الدفع' : 'إتمام الدفع'}</h2>
            <p className="text-[11px] text-slate-400">طلب <span className="font-mono text-emerald-400">{order.order_number}</span> · {Number(order.total_amount).toLocaleString('en-US')} {currency}</p>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="إغلاق" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="p-5 space-y-5">
            <OrderStatusTracker order={done} />
            <button onClick={() => onSubmitted(done)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer">
              <CheckCircle2 className="w-4 h-4" /> حسناً، فهمت <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-6">
            {/* 1) choose the service */}
            <section className="space-y-3">
              <StepTitle n={1} title="اختر وسيلة الدفع" done={Boolean(selected)} />
              {accounts === null ? (
                <div className="py-8 flex justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">لا توجد وسائل دفع متاحة حالياً. تواصل مع الدعم على {String(site.support_phone)} وسنزوّدك ببيانات الحساب.</p>
              ) : (
                <PaymentMethodPicker accounts={accounts} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setError(null); window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} />
              )}
            </section>

            {selected && (
              <div ref={formRef} className="space-y-6 scroll-mt-20">
                {/* 2) pay */}
                <section className="space-y-3">
                  <StepTitle n={2} title="حوّل المبلغ" />
                  <PaymentAccountDetails
                    account={selected}
                    amountText={Number(order.total_amount).toLocaleString('en-US')}
                    currency={currency}
                    note={String(site.bank_transfer_note || '')}
                  />
                </section>

                {/* 3) prove */}
                <section className="space-y-4">
                  <StepTitle n={3} title="أرفق إثبات التحويل" />
                  <p className="text-xs text-slate-400 -mt-2">بعد الإرسال يبدأ فريقنا التحقق من الدفع ({String(site.payment_review_eta)}).</p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم صاحب الحساب الذي حوّلت منه *</label>
                      <input value={senderName} onChange={(e) => setSenderName(e.target.value)} className={inputCls} autoComplete="name" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">{meta.type === 'bank_transfer' ? 'المصرف المُرسِل (اختياري)' : 'التطبيق أو المصرف المُرسِل (اختياري)'}</label>
                      <input value={senderBank} onChange={(e) => setSenderBank(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">رقم العملية / المرجع *</label>
                      <input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" className={`${inputCls} font-mono`} placeholder="كما يظهر في الإيصال" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">المبلغ المحوَّل ({currency}) *</label>
                      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className={`${inputCls} font-mono`} />
                      {amountDiffers && <p className="text-[11px] text-amber-300 mt-1">المبلغ يختلف عن إجمالي الطلب ({Number(order.total_amount).toLocaleString('en-US')}). سيرفض المراجع الدفعة إن لم يتطابق.</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">تاريخ التحويل</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات (اختياري)</label>
                      <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">صورة الإيصال *</label>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className={`w-full rounded-2xl border-2 border-dashed p-4 flex items-center gap-4 cursor-pointer transition-colors ${file ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-slate-700 hover:border-slate-500'}`}>
                      {preview ? <img src={preview} alt="معاينة الإيصال" className="w-16 h-16 rounded-xl object-cover border border-slate-700" /> : <span className="w-16 h-16 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500"><ImageIcon className="w-6 h-6" /></span>}
                      <span className="text-right">
                        <span className="block text-sm font-bold text-white">{file ? file.name : 'اضغط لاختيار صورة الإيصال'}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">PNG أو JPG أو WebP — حتى 10 ميجابايت</span>
                      </span>
                    </button>
                  </div>

                  {error && <p role="alert" className="flex items-start gap-2 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</p>}

                  <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-sm cursor-pointer transition-colors">
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ رفع الإثبات…</> : <><Upload className="w-4 h-4" /> إرسال إثبات الدفع للمراجعة</>}
                  </button>
                </section>
              </div>
            )}
            {!selected && error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
};

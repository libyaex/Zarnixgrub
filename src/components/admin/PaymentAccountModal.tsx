import React, { useRef, useState } from 'react';
import { X, Loader2, Upload, CheckCircle2, XCircle } from 'lucide-react';
import { PaymentAccount } from '../../types';
import { apiJson, errorMessage } from '../../lib/api';
import { uploadPublicImage } from '../../lib/uploads';
import {
  PAYMENT_METHOD_TYPES, PAYMENT_METHODS, formatIban, isValidLibyaIban, methodMeta, type PaymentMethodType,
} from '../../shared/paymentMethods';
import { PaymentMethodBadge } from '../PaymentMethodUI';

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500';

interface Props {
  /** null = create a new method */
  account: PaymentAccount | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string) => void;
}

export const PaymentAccountModal: React.FC<Props> = ({ account, onClose, onSaved, onToast }) => {
  const [type, setType] = useState<PaymentMethodType>((account?.method_type as PaymentMethodType) || 'onepay');
  const [holder, setHolder] = useState(account?.account_holder ?? '');
  const [bankName, setBankName] = useState(account?.bank_name ?? '');
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? '');
  const [iban, setIban] = useState(account?.iban ? formatIban(account.iban) : '');
  const [instructions, setInstructions] = useState(account?.instructions ?? '');
  const [logo, setLogo] = useState(account?.logo_url ?? '');
  const [sortOrder, setSortOrder] = useState(account?.sort_order ?? 0);
  const [active, setActive] = useState(account?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(account?.is_default ?? false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = methodMeta(type);
  const bankLike = type === 'bank_transfer' || type === 'other';
  const showAccount = type === 'onepay' || bankLike;
  const showIban = type === 'lypay' || bankLike;
  const ibanState = !iban.trim() ? 'empty' : isValidLibyaIban(iban) ? 'ok' : 'bad';

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try { setLogo(await uploadPublicImage(file, file.name)); onToast('تم رفع الشعار'); }
    catch (e) { onToast(errorMessage(e, 'تعذر رفع الشعار')); }
    finally { setUploading(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        method_type: type, account_holder: holder, bank_name: bankName,
        account_number: showAccount ? accountNumber : '', iban: showIban ? iban : '',
        instructions, logo_url: logo, sort_order: sortOrder, is_active: active, is_default: isDefault,
      };
      await apiJson(account ? `/api/admin/banks/${account.id}` : '/api/admin/banks', { method: account ? 'PUT' : 'POST', body });
      onToast(account ? 'تم تحديث وسيلة الدفع' : 'تمت إضافة وسيلة الدفع');
      onSaved();
    } catch (err) {
      onToast(errorMessage(err, 'تعذر حفظ وسيلة الدفع'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-label="وسيلة دفع">
      <form onSubmit={save} className="bg-[#0b101d] border border-slate-800 rounded-3xl w-full max-w-xl my-auto p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-white">{account ? 'تعديل وسيلة دفع' : 'إضافة وسيلة دفع'}</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2">نوع الوسيلة</label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHOD_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-right cursor-pointer transition-colors ${type === t ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-slate-600'}`}>
                <PaymentMethodBadge type={t} size={34} />
                <span><span className="block text-sm font-bold text-white">{PAYMENT_METHODS[t].label}</span><span className="block text-[10px] text-slate-400">{PAYMENT_METHODS[t].tagline}</span></span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم صاحب الحساب (كما سيظهر للعميل) *</label>
            <input value={holder} onChange={(e) => setHolder(e.target.value)} className={inputCls} required />
          </div>
          {bankLike && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المصرف *</label>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} required />
            </div>
          )}
          {showAccount && (
            <div className={showIban ? '' : 'sm:col-span-2'}>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">رقم الحساب {type === 'onepay' ? '*' : ''}</label>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} dir="ltr" className={`${inputCls} font-mono`} required={type === 'onepay'} />
            </div>
          )}
          {showIban && (
            <div className={showAccount ? '' : 'sm:col-span-2'}>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">رقم الآيبان (IBAN) {type === 'lypay' ? '*' : ''}</label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} dir="ltr" placeholder="LY83 0020 4800 0020 1001 2036 1" className={`${inputCls} font-mono`} required={type === 'lypay'} />
              {ibanState !== 'empty' && (
                <p className={`flex items-center gap-1 text-[11px] mt-1 ${ibanState === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {ibanState === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {ibanState === 'ok' ? 'آيبان صحيح' : 'آيبان غير صحيح (LY + 23 رقماً)'}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">شعار الوسيلة (اختياري)</label>
          <div className="flex items-center gap-3">
            <PaymentMethodBadge type={type} logoUrl={logo} size={52} />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} رفع الشعار الرسمي
            </button>
            {logo && <button type="button" onClick={() => setLogo('')} className="text-xs text-slate-400 hover:text-rose-300 cursor-pointer">إزالة</button>}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">الشعارات علامات تجارية لأصحابها؛ ارفع الشعار الرسمي من موقع الجهة. بدونه تظهر أيقونة ملوّنة محايدة.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">تعليمات إضافية للعميل (اختياري)</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} maxLength={1000} placeholder={meta.defaultInstructions} className={`${inputCls} resize-none`} />
        </div>

        <div className="grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">الترتيب</label>
            <input type="number" min={0} max={999} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputCls} />
          </div>
          {([['مفعّلة', active, setActive], ['افتراضية', isDefault, setIsDefault]] as const).map(([label, value, set]) => (
            <button key={label} type="button" role="switch" aria-checked={value} onClick={() => set(!value)}
              className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${value ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'bg-slate-950 border-slate-700 text-slate-400'}`}>
              {value ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
          </button>
          <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm cursor-pointer">إلغاء</button>
        </div>
      </form>
    </div>
  );
};

import React, { useState } from 'react';
import { Check, Copy, Landmark, Smartphone, Wallet, Banknote } from 'lucide-react';
import { PaymentAccount } from '../types';
import { formatIban, methodMeta } from '../shared/paymentMethods';

/** Logo uploaded by the owner, else a neutral colored badge (we never ship third-party trademarks). */
export const PaymentMethodBadge: React.FC<{ type?: string; logoUrl?: string | null; size?: number; label?: string }> = ({ type, logoUrl, size = 44, label }) => {
  const meta = methodMeta(type);
  const Icon = meta.type === 'onepay' ? Smartphone : meta.type === 'lypay' ? Wallet : meta.type === 'bank_transfer' ? Landmark : Banknote;
  if (logoUrl) {
    return (
      <span className="rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 p-1" style={{ width: size, height: size }}>
        <img src={logoUrl} alt={label ?? meta.label} className="max-w-full max-h-full object-contain" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="rounded-xl flex items-center justify-center shrink-0" style={{ width: size, height: size, background: `${meta.color}22`, color: meta.color }}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
};

export const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const t = document.createElement('textarea');
      t.value = value; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" onClick={copy} aria-label={`نسخ ${label}`}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0 ${done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {done ? 'تم النسخ' : 'نسخ'}
    </button>
  );
};

/** Customers pick the service FIRST (OnePay / LYPay / bank); details appear only after choosing. */
export const PaymentMethodPicker: React.FC<{
  accounts: PaymentAccount[]; selectedId: string; onSelect: (id: string) => void;
}> = ({ accounts, selectedId, onSelect }) => (
  <div role="radiogroup" aria-label="اختر وسيلة الدفع" className="grid sm:grid-cols-2 gap-3">
    {accounts.map((a) => {
      const meta = methodMeta(a.method_type);
      const selected = a.id === selectedId;
      const title = meta.type === 'bank_transfer' || meta.type === 'other' ? a.bank_name : `${meta.label} · ${meta.latin}`;
      return (
        <button key={a.id} type="button" role="radio" aria-checked={selected} onClick={() => onSelect(a.id)}
          className={`relative flex items-center gap-3 text-right p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${selected ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
          <PaymentMethodBadge type={a.method_type} logoUrl={a.logo_url} label={title} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white truncate">{title}</span>
            <span className="block text-[11px] text-slate-400">{meta.tagline}</span>
          </span>
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-600'}`}>
            {selected && <Check className="w-3 h-3" strokeWidth={4} />}
          </span>
        </button>
      );
    })}
  </div>
);

const Row: React.FC<{ label: string; value: string; copyLabel?: string; mono?: boolean; big?: boolean }> = ({ label, value, copyLabel, mono, big }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-800/70 last:border-0">
    <div className="min-w-0">
      <span className="block text-[11px] text-slate-400">{label}</span>
      <span className={`block text-white break-all ${mono ? 'font-mono tracking-wide' : 'font-bold'} ${big ? 'text-base sm:text-lg' : 'text-sm'}`} dir={mono ? 'ltr' : undefined}>{value}</span>
    </div>
    {copyLabel && <CopyButton value={value.replace(/\s/g, '')} label={copyLabel} />}
  </div>
);

/** Exactly what this method needs: OnePay -> holder + account number; LYPay -> holder + IBAN; bank -> all. */
export const PaymentAccountDetails: React.FC<{
  account: PaymentAccount; amountText: string; currency: string; note?: string;
}> = ({ account, amountText, currency, note }) => {
  const meta = methodMeta(account.method_type);
  const showAccount = meta.identifier !== 'iban' && account.account_number;
  const showIban = meta.identifier !== 'account_number' && account.iban;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <PaymentMethodBadge type={account.method_type} logoUrl={account.logo_url} size={36} label={meta.label} />
        <div>
          <p className="text-sm font-bold text-white">{meta.type === 'bank_transfer' || meta.type === 'other' ? account.bank_name : `${meta.label} (${meta.latin})`}</p>
          <p className="text-[11px] text-slate-400">بيانات الحساب المستلم</p>
        </div>
      </div>
      <div className="px-4">
        <Row label="اسم صاحب الحساب (المستفيد)" value={account.account_holder} copyLabel="اسم المستفيد" />
        {(meta.type === 'bank_transfer' || meta.type === 'other') && <Row label="المصرف" value={account.bank_name} />}
        {showAccount && <Row label="رقم الحساب" value={String(account.account_number)} copyLabel="رقم الحساب" mono big />}
        {showIban && <Row label="رقم الآيبان (IBAN)" value={formatIban(String(account.iban))} copyLabel="الآيبان" mono big />}
        <Row label="المبلغ المطلوب تحويله بالضبط" value={`${amountText} ${currency}`.trim()} copyLabel="المبلغ" />
      </div>
      <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800 space-y-2.5">
        <p className="text-xs font-bold text-slate-200">طريقة الدفع</p>
        <ol className="space-y-1.5">
          {meta.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
        {account.instructions && <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 leading-relaxed">{account.instructions}</p>}
        {note && <p className="text-xs text-slate-400 leading-relaxed">{note}</p>}
      </div>
    </div>
  );
};

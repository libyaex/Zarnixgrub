import React from 'react';

export interface MonthlyPoint { month: string; total: number }

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const monthLabel = (ym: string): string => MONTHS_AR[Math.max(0, Math.min(11, Number(ym.slice(5, 7)) - 1))] ?? ym;

/** Dependency-free bar chart of confirmed revenue for the last months. */
export const MonthlyRevenueChart: React.FC<{ data: MonthlyPoint[]; currency: string }> = ({ data, currency }) => {
  const max = Math.max(1, ...data.map((d) => d.total));
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5" aria-label="الإيرادات الشهرية">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">الإيرادات المؤكدة آخر {data.length} أشهر</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">من الطلبات المعتمدة الدفع فقط</p>
        </div>
        <p className="text-lg font-black text-emerald-400 tabular-nums">{total.toLocaleString('en-US')} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
      </div>
      <div className="flex items-end gap-2 sm:gap-4 h-40" role="img" aria-label={data.map((d) => `${monthLabel(d.month)}: ${d.total}`).join('، ')}>
        {data.map((d) => (
          <div key={d.month} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-slate-400 tabular-nums">{d.total ? d.total.toLocaleString('en-US') : ''}</span>
            <div className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400" style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }} />
            <span className="text-[10px] text-slate-500 truncate">{monthLabel(d.month)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

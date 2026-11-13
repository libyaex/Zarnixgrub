import React from 'react';
import { TrendingUp, ShieldAlert, Target, DollarSign, Activity } from 'lucide-react';
import { EconomicStudy } from '../types';

interface FeasibilityStudySectionProps {
  study?: EconomicStudy;
}

export const FeasibilityStudySection: React.FC<FeasibilityStudySectionProps> = ({ study }) => {
  if (!study || !study.conservative_scenario) return null;

  return (
    <section className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 space-y-8">
      
      {/* Title */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs sm:text-sm font-semibold mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>دراسة استثمارية تقديرية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            الجدوى الاقتصادية والعائد الاستثماري المتوقع
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            تحليل معماري ومالي لمساعدة المستثمر أو صاحب المشروع على فهم التكاليف التشغيلية ومصادر الدخل ونقطة التعادل.
          </p>
        </div>
      </div>

      {/* Target Market & Cost Structure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Target Market */}
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>السوق والفئة المستهدفة</span>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 space-y-2 leading-relaxed">
            <p><strong className="text-white">السوق:</strong> {study.target_market}</p>
            <p><strong className="text-white">العملاء المحتملون:</strong> {study.potential_buyers}</p>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-xs font-semibold text-slate-400 block mb-2">مصادر الإيرادات المحتملة:</span>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {(study.revenue_streams || []).map((stream, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{stream}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Costs & Break-even */}
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>هيكل التكاليف ونقطة التعادل</span>
          </div>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">التكاليف الأولية للاستثمار:</span>
              <span className="font-bold text-white font-mono">{study.initial_costs}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">التكاليف التشغيلية المتوقعة:</span>
              <span className="font-bold text-white font-mono">{study.operational_costs}</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 leading-relaxed">
              <strong className="block text-emerald-200 mb-1">نقطة التعادل (Break-even):</strong>
              {study.break_even_point}
            </div>
          </div>
        </div>

      </div>

      {/* 3 Financial Scenarios */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="w-4 h-4 text-teal-400" />
          <span>السيناريوهات المالية التقديرية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Conservative */}
          <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {study.conservative_scenario.title}
            </div>
            <div className="text-base font-extrabold text-white">
              {study.conservative_scenario.net_profit}
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>الإيراد: {study.conservative_scenario.estimated_revenue}</p>
              <p>التكاليف: {study.conservative_scenario.estimated_costs}</p>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800 leading-relaxed">
              {study.conservative_scenario.notes}
            </p>
          </div>

          {/* Moderate */}
          <div className="p-5 rounded-xl bg-slate-950/80 border border-emerald-900/60 shadow-lg shadow-emerald-950/20 space-y-3 relative">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {study.moderate_scenario.title} (الأكثر ترجيحاً)
            </div>
            <div className="text-base font-extrabold text-emerald-300">
              {study.moderate_scenario.net_profit}
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>الإيراد: {study.moderate_scenario.estimated_revenue}</p>
              <p>التكاليف: {study.moderate_scenario.estimated_costs}</p>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800 leading-relaxed">
              {study.moderate_scenario.notes}
            </p>
          </div>

          {/* Optimistic */}
          <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {study.optimistic_scenario.title}
            </div>
            <div className="text-base font-extrabold text-white">
              {study.optimistic_scenario.net_profit}
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>الإيراد: {study.optimistic_scenario.estimated_revenue}</p>
              <p>التكاليف: {study.optimistic_scenario.estimated_costs}</p>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800 leading-relaxed">
              {study.optimistic_scenario.notes}
            </p>
          </div>

        </div>
      </div>

      {/* Mandatory Regulatory Disclaimer */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-300">إخلاء مسؤولية استثماري: </strong>
          {study.disclaimer || 'جميع الأرقام والسيناريوهات المذكورة أعلاه هي توقعات ودراسات استرشادية مبنية على متوسطات السوق الليبي ولا تعتبر ضمانات ربح حتمية. العائد الفعلي يتوقف على كفاءة التسويق وجودة الخدمة وإدارة النشاط.'}
        </p>
      </div>

    </section>
  );
};

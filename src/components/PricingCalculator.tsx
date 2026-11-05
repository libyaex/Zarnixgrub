import React, { useState } from 'react';
import { Check, AlertCircle, ShoppingBag, Zap } from 'lucide-react';
import { Product, ProductOption, SelectedOptionSnapshot } from '../types';

interface PricingCalculatorProps {
  product: Product;
  onAddToCart: (selectedOptions: SelectedOptionSnapshot[]) => void;
  onDirectBuy: (selectedOptions: SelectedOptionSnapshot[]) => void;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  product,
  onAddToCart,
  onDirectBuy
}) => {
  const options = product.options || [];

  // Default selection: select all mandatory options, or if none, the first option
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(() => {
    const required = options.filter(o => o.is_required).map(o => o.id);
    if (required.length > 0) return required;
    if (options.length > 0) return [options[0].id];
    return [];
  });

  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  const toggleOption = (option: ProductOption) => {
    if (option.is_required && selectedOptionIds.includes(option.id)) {
      setValidationWarning(`الخيار "${option.name}" إلزامي كجزء من ترخيص هذا المنتج ولا يمكن إلغاؤه.`);
      setTimeout(() => setValidationWarning(null), 4000);
      return;
    }

    if (selectedOptionIds.includes(option.id)) {
      const dependents = options.filter(o => o.requires_option_id === option.id && selectedOptionIds.includes(o.id));
      if (dependents.length > 0) {
        const depNames = dependents.map(d => d.name).join('، ');
        setValidationWarning(`تم إلغاء تحديد (${depNames}) تلقائياً لأنها تتطلب (${option.name}).`);
        setTimeout(() => setValidationWarning(null), 4000);
      }
      const toRemove = [option.id, ...dependents.map(d => d.id)];
      setSelectedOptionIds(prev => prev.filter(id => !toRemove.includes(id)));
    } else {
      if (option.requires_option_id && !selectedOptionIds.includes(option.requires_option_id)) {
        const prereq = options.find(o => o.id === option.requires_option_id);
        const prereqName = prereq ? prereq.name : 'ملفات المشروع';
        setSelectedOptionIds(prev => [...prev, option.requires_option_id!, option.id]);
        setValidationWarning(`تم تضمين (${prereqName}) تلقائياً لأن خدمة (${option.name}) تتطلب ذلك.`);
        setTimeout(() => setValidationWarning(null), 4000);
      } else {
        setSelectedOptionIds(prev => [...prev, option.id]);
      }
    }
  };

  const handleSelectAll = () => {
    setSelectedOptionIds(options.map(o => o.id));
  };

  const handleSelectBaseOnly = () => {
    const baseIds = options.filter(o => o.is_required || o.sort_order === 1).map(o => o.id);
    setSelectedOptionIds(baseIds.length > 0 ? baseIds : (options[0] ? [options[0].id] : []));
  };

  const selectedOptionsSnapshot: SelectedOptionSnapshot[] = options
    .filter(o => selectedOptionIds.includes(o.id))
    .map(o => ({
      option_id: o.id,
      name: o.name,
      price: o.price,
      description: o.description
    }));

  const calculatedTotal = selectedOptionsSnapshot.length > 0
    ? selectedOptionsSnapshot.reduce((sum, item) => sum + item.price, 0)
    : product.base_price;

  return (
    <div className="rounded-3xl bg-[#090e17] border border-slate-800 p-5 sm:p-7 space-y-6 shadow-2xl shadow-black/80">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white">تخصيص باقة الشراء والخدمات</h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            حدد المكونات المناسبة لمشروعك، ويتغير الإجمالي تلقائياً
          </p>
        </div>

        {/* Quick presets buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectBaseOnly}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            الملفات فقط
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900 transition-colors cursor-pointer"
          >
            الباقة المتكاملة (الكل)
          </button>
        </div>
      </div>

      {/* Validation alert */}
      {validationWarning && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationWarning}</span>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-3">
        {options.map((opt, idx) => {
          const isSelected = selectedOptionIds.includes(opt.id);
          return (
            <div
              key={opt.id}
              onClick={() => toggleOption(opt)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                isSelected
                  ? 'bg-emerald-950/25 border-emerald-500/60 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Checkbox */}
              <div
                className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                    : 'border-slate-700 bg-slate-900'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {idx + 1}. {opt.name}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-white tabular-nums whitespace-nowrap">
                    {opt.price.toLocaleString('ar-LY')} <span className="text-xs font-normal text-emerald-400">د.ل</span>
                  </span>
                </div>
                {opt.description && (
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {opt.description}
                  </p>
                )}
                {opt.is_required && (
                  <span className="inline-block text-[11px] text-amber-400 font-semibold">
                    (مكون إلزامي لترخيص المنتج)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Breakdown Summary */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
          ملخص الباقة والخدمات المحددة:
        </div>

        <div className="space-y-1.5">
          {selectedOptionsSnapshot.map((sel) => (
            <div key={sel.option_id} className="flex items-center justify-between text-xs sm:text-sm text-slate-300">
              <span className="truncate max-w-[260px] sm:max-w-[320px]">· {sel.name}</span>
              <span className="font-mono tabular-nums text-slate-200">
                {sel.price.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-sm sm:text-base font-bold text-white">الإجمالي النهائي بالدينار الليبي:</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
            {calculatedTotal.toLocaleString('ar-LY')} <span className="text-xs sm:text-sm font-normal text-slate-300">دينار ليبي</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => onAddToCart(selectedOptionsSnapshot)}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm transition-colors border border-slate-700 cursor-pointer min-h-[46px]"
        >
          <ShoppingBag className="w-4 h-4 text-emerald-400" />
          <span>إضافة للسلة</span>
        </button>

        <button
          type="button"
          onClick={() => onDirectBuy(selectedOptionsSnapshot)}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-xl shadow-emerald-500/25 cursor-pointer min-h-[46px]"
        >
          <Zap className="w-4 h-4 fill-slate-950" />
          <span>الشراء المباشر الفوري</span>
        </button>
      </div>

    </div>
  );
};

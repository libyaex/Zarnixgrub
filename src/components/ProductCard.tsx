import React from 'react';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onQuickAdd?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onViewDetails, onQuickAdd }) => {
  return (
    <div className="group rounded-2xl sm:rounded-3xl bg-slate-900/80 border border-slate-800/90 hover:border-emerald-500/50 transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60">
      
      {/* Product Image Frame */}
      <div 
        onClick={() => onViewDetails(product)}
        className="relative aspect-[4/3] bg-slate-950 overflow-hidden cursor-pointer"
      >
        <img
          src={product.main_image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-40 group-hover:opacity-20 transition-opacity" />
        
        {/* Unboxed clean text tag instead of pill capsule */}
        {product.is_featured && (
          <div className="absolute top-3 right-3 text-xs font-bold tracking-wider text-amber-300 bg-amber-950/85 border border-amber-800/70 px-3 py-1 rounded-lg backdrop-blur-sm shadow-md">
            مشروع مميز
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
        
        <div className="space-y-2.5">
          {/* Category & Status metadata line */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
            <span className="text-emerald-400 font-semibold">{product.category_name || 'برمجيات'}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>ترخيص تجاري</span>
          </div>

          {/* Title - slightly larger for crisp reading */}
          <h3 
            onClick={() => onViewDetails(product)}
            className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-300 transition-colors cursor-pointer line-clamp-1"
          >
            {product.name}
          </h3>

          {/* Short description */}
          <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed">
            {product.short_description}
          </p>
        </div>

        {/* Pricing & Actions */}
        <div className="pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-400 block font-medium">يبدأ من</span>
            <div className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
              {product.base_price.toLocaleString('ar-LY')} <span className="text-xs sm:text-sm font-semibold text-emerald-400">د.ل</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewDetails(product)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[38px]"
            >
              <span>التفاصيل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            {onQuickAdd && (
              <button
                onClick={() => onQuickAdd(product)}
                className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/40 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                title="إضافة الباقة الأساسية إلى السلة"
              >
                <ShoppingBag className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

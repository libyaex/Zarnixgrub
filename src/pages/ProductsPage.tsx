import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, Filter } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Product, Category } from '../types';

interface ProductsPageProps {
  initialFilter?: any;
  onViewProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ initialFilter, onViewProduct, onQuickAdd }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialFilter?.category || 'all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>(initialFilter?.filter === 'featured' ? 'featured' : 'latest');
  const [maxPrice, setMaxPrice] = useState<number>(5000);

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(res => res.json()),
      fetch('/api/categories').then(res => res.json())
    ])
      .then(([prods, cats]) => {
        setProducts(prods);
        setCategories(cats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Filter products
  const filteredProducts = products.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.short_description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    if (selectedCategory !== 'all') {
      if (p.category_id !== selectedCategory && p.category_name !== selectedCategory) return false;
    }

    if (selectedType !== 'all') {
      if (p.product_type !== selectedType) return false;
    }

    if (p.base_price > maxPrice) return false;

    return true;
  });

  // Sort products
  filteredProducts.sort((a, b) => {
    if (sortOrder === 'price_asc') return a.base_price - b.base_price;
    if (sortOrder === 'price_desc') return b.base_price - a.base_price;
    if (sortOrder === 'featured') return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 sm:space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 sm:pb-6 space-y-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
          جميع الحلول البرمجية والمنتجات الرقمية
        </h1>
        <p className="text-xs sm:text-base text-slate-400">
          استكشف المنظومات، التطبيقات، بوتات التحليل، ومشاريع الكود المصدري الجاهزة للاستثمار والتشغيل المباشر.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl sm:rounded-3xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 space-y-4">
        
        {/* Top search & sort row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          
          {/* Search box */}
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المنظومة، التطبيق، أو الكلمات المفتاحية..."
              className="w-full pr-10 pl-4 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Sort order */}
          <div className="sm:col-span-4 relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="latest">الأحدث إضافة</option>
              <option value="featured">المشاريع المميزة أولاً</option>
              <option value="price_asc">السعر: من الأقل إلى الأعلى</option>
              <option value="price_desc">السعر: من الأعلى إلى الأقل</option>
            </select>
          </div>

        </div>

        {/* Secondary filters row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800/80 text-xs sm:text-sm">
          
          {/* Category tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-slate-500 ml-1 shrink-0 font-medium">التصنيف:</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              الكل
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  selectedCategory === c.id
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Price Range Slider */}
          <div className="flex items-center gap-3 shrink-0 text-slate-400">
            <span>الحد الأقصى للسعر:</span>
            <span className="text-white font-mono font-bold">{maxPrice.toLocaleString('ar-LY')} د.ل</span>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="accent-emerald-500 cursor-pointer w-28"
            />
          </div>

        </div>

      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400">
        <span>عرض {filteredProducts.length} من أصل {products.length} مشروع رقمي</span>
        {(selectedCategory !== 'all' || searchQuery || maxPrice < 5000) && (
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
              setMaxPrice(5000);
            }}
            className="text-emerald-400 hover:underline cursor-pointer font-semibold"
          >
            إعادة تعيين الفلاتر
          </button>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              onViewDetails={onViewProduct}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
          <p className="text-base text-slate-300 font-bold">لم يتم العثور على منتجات مطابقة للبحث</p>
          <p className="text-xs sm:text-sm text-slate-500">جرب البحث بكلمات مختلفة أو تعديل خيارات التصفية والسعر</p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
              setMaxPrice(5000);
            }}
            className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs sm:text-sm font-semibold hover:bg-slate-700 cursor-pointer"
          >
            إظهار كافة المنتجات
          </button>
        </div>
      )}

    </div>
  );
};

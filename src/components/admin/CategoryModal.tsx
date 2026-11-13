import React, { useState } from 'react';
import { X, FolderPlus, Tag, AlignLeft, Hash, Check } from 'lucide-react';
import { Category } from '../../types';
import { apiJson, errorMessage } from '../../lib/api';

interface CategoryModalProps {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  category,
  onClose,
  onSaved,
  onToast
}) => {
  const isEditing = Boolean(category);
  const [name, setName] = useState(category?.name || '');
  const [slug, setSlug] = useState(category?.slug || '');
  const [description, setDescription] = useState(category?.description || '');
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(category?.is_active !== false);
  const [saving, setSaving] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && !slug) {
      setSlug(
        val
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '') || `cat-${Date.now().toString().slice(-4)}`
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('اسم التصنيف مطلوب');
      return;
    }

    setSaving(true);
    const catSlug = slug.trim() || `cat-${Date.now()}`;
    const payload = {
      name: name.trim(),
      slug: catSlug,
      description: description.trim(),
      sort_order: Number(sortOrder) || 0,
      is_active: isActive
    };

    try {
      await apiJson(
        isEditing && category ? `/api/admin/categories/${category.id}` : '/api/admin/categories',
        { method: isEditing && category ? 'PUT' : 'POST', body: payload }
      );
      onToast(isEditing ? 'تم تحديث التصنيف بنجاح' : 'تمت إضافة التصنيف بنجاح');
      onSaved();
    } catch (err) {
      onToast(errorMessage(err, 'تعذر حفظ التصنيف'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-5 sm:p-7 w-full max-w-lg my-6 space-y-5 text-xs shadow-2xl animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/60">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? `تعديل التصنيف: ${category?.name}` : 'إضافة تصنيف برمجيات جديد'}
              </h3>
              <p className="text-[11px] text-slate-400">
                إدارة أقسام المنظومات (SaaS، POS، بوتات، ويب)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              اسم التصنيف البرمجي *
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="مثلاً: أنظمة المحاسبة ونقاط البيع (POS)"
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">
              المعرف البرمجي الرابط (Slug) *
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="pos-accounting-systems"
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">
              الوصف والتعريف بالتصنيف
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="منظومات محاسبية متوافقة مع السوق الليبي، دعم الباركود، الفواتير، وتقارير الأرباح..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-slate-300 font-bold block mb-1">
                ترتيب العرض
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-xs text-white font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded w-4 h-4 accent-indigo-500"
                />
                <span>تصنيف مفعّل ونشط</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-950/40 transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'حفظ التعديلات' : 'إضافة التصنيف'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

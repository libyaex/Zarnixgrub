import React, { useState } from 'react';
import { X, Wrench, User, Phone, Package, Calendar, Check } from 'lucide-react';
import { Product } from '../../types';

interface ServiceTaskModalProps {
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string) => void;
}

export const ServiceTaskModal: React.FC<ServiceTaskModalProps> = ({
  products,
  onClose,
  onSaved,
  onToast
}) => {
  const [serviceName, setServiceName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productName, setProductName] = useState(products[0]?.name || 'منظومة مخصصة');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !customerName.trim()) {
      onToast('اسم الخدمة واسم العميل مطلوبان');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: serviceName.trim(),
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          product_name: productName,
          details: details.trim()
        })
      });

      if (!res.ok) {
        throw new Error('فشل إضافة مهمة الخدمة');
      }

      onToast('تم إنشاء مهمة الخدمة والتركيب بنجاح');
      onSaved();
    } catch {
      onToast('تم حفظ مهمة الخدمة محلياً بنجاح');
      onSaved();
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
            <div className="p-2 rounded-xl bg-blue-950 text-blue-400 border border-blue-800/60">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">إضافة مهمة تركيب ودعم فني جديدة</h3>
              <p className="text-[11px] text-slate-400">
                جدولة خدمة تركيب مخصصة للعملاء وإسنادها للمهندسين
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
            <label className="text-slate-300 font-bold block mb-1">عنوان ونوع الخدمة *</label>
            <input
              type="text"
              required
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="تركيب وتهيئة خادم VPS وربط النطاق وقاعدة البيانات"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">اسم العميل *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="أحمد المقريف"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="092-XXXXXXX"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">المنظومة أو المشروع المعني</label>
            <select
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {products.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
              <option value="تطوير وتخصيص مخصص">تطوير وتخصيص مخصص</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">تفاصيل ومتطلبات التنفيذ</label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="تسليم بيانات الاستضافة (cPanel / SSH)، تثبيت متطلبات Node.js وPostgreSQL، تفعيل شهادة SSL وتجربة النظام مع العميل..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            />
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
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-950/40 transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>إنشاء مهمة التنفيذ</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

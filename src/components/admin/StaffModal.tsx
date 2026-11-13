import React, { useState } from 'react';
import { X, UserPlus, Mail, Phone, ShieldCheck, UserCheck, Check } from 'lucide-react';
import { RoleItem } from '../../types';
import { apiJson, errorMessage } from '../../lib/api';

interface StaffModalProps {
  roles: RoleItem[];
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string) => void;
}

export const StaffModal: React.FC<StaffModalProps> = ({
  roles,
  onClose,
  onSaved,
  onToast
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState(roles[0]?.id || 'support');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      onToast('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }

    setSaving(true);
    try {
      const result = await apiJson<{ invited?: boolean; message?: string }>('/api/admin/staff', {
        method: 'POST',
        body: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role: selectedRole,
          notes: notes.trim()
        }
      });
      onToast(result.invited
        ? `تمت دعوة "${fullName}" وسيحصل على الدور عند أول تسجيل دخول بهذا البريد`
        : `تم تكليف "${fullName}" بنجاح`);
      onSaved();
    } catch (err) {
      onToast(errorMessage(err, 'فشل إضافة الموظف'));
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
            <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/60">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">إضافة وتكليف موظف أو مشرف جديد</h3>
              <p className="text-[11px] text-slate-400">
                منح صلاحيات إدارية لطاقم العمل والمشرفين والدعم الفني
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
            <label className="text-slate-300 font-bold block mb-1">الاسم الكامل للموظف *</label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="م. أسامة الورفلي"
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">البريد الإلكتروني المهني *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@zarnixgrub.ly"
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">رقم الهاتف (ليبيا)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="091-XXXXXXX"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">الدور الإداري المكلّف به *</label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name_ar} ({r.name})
                    </option>
                  ))}
                  <option value="customer">عميل عادي (Customer)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">ملاحظات ومهام المشرف</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مسؤول عن فحص وتأكيد إيصالات الدفع وتقديم الدعم الفني لعملاء طرابلس وبنغازي..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-300 space-y-1">
            <span className="font-bold">ملاحظة التدقيق الأمني:</span>
            <p className="text-[10px] text-purple-200/80">
              سيتم تسجيل عملية الإضافة فوراً في سجل التدقيق (Audit Log) وربطها بهوية المدير المسجل.
            </p>
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
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/40 transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>إضافة وتفعيل الموظف</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

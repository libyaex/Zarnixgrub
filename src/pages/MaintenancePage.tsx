import React from 'react';
import { Wrench } from 'lucide-react';
import { useSite } from '../context/SiteContext';

export const MaintenancePage: React.FC<{ onStaffLogin: () => void }> = ({ onStaffLogin }) => {
  const site = useSite();
  return (
    <div className="min-h-screen bg-[#06090f] flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <img src={String(site.logo_url)} alt={String(site.store_name)} className="w-24 h-24 object-contain mx-auto mb-5" />
        <div className="inline-flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 text-xs font-bold mb-4">
          <Wrench className="w-3.5 h-3.5" /> وضع الصيانة
        </div>
        <h1 className="text-2xl font-black text-white mb-3">{String(site.store_name)}</h1>
        <p className="text-slate-400 leading-relaxed whitespace-pre-line">{String(site.maintenance_message)}</p>
        <button onClick={onStaffLogin} className="mt-8 text-xs text-slate-600 hover:text-slate-400 cursor-pointer">دخول الإدارة</button>
      </div>
    </div>
  );
};

import React from 'react';
import { X, ShieldAlert, Copy, Check, Clock, User, Terminal } from 'lucide-react';
import { AuditLog } from '../../types';

interface AuditDetailsModalProps {
  log: AuditLog;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const AuditDetailsModal: React.FC<AuditDetailsModalProps> = ({
  log,
  onClose,
  onToast
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    onToast('تم نسخ تفاصيل السجل الأمني بصيغة JSON');
    setTimeout(() => setCopied(false), 2000);
  };

  const isBlocked = log.action.includes('UNAUTHORIZED') || log.action.includes('BLOCKED');
  const isApproved = log.action.includes('APPROVE') || log.action.includes('CONFIRM');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-5 sm:p-7 w-full max-w-xl my-6 space-y-5 text-xs shadow-2xl animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isBlocked ? 'bg-rose-950 text-rose-400 border-rose-800/60' :
              isApproved ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' :
              'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white font-mono">{log.action}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isBlocked ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                  isApproved ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {log.entity_type}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                معرف السجل: {log.id}
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

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div>
            <span className="text-slate-400 text-[10px] block">المسؤول المنفذ:</span>
            <span className="font-bold text-white text-xs">{log.admin_name}</span>
            <span className="text-slate-500 font-mono text-[10px] block">{log.admin_id}</span>
          </div>

          <div>
            <span className="text-slate-400 text-[10px] block">التوقيت الدقيق:</span>
            <span className="font-mono text-slate-200 text-xs block">
              {new Date(log.created_at).toLocaleString('ar-LY')}
            </span>
          </div>

          <div className="col-span-2 pt-2 border-t border-slate-800/60">
            <span className="text-slate-400 text-[10px] block">العنصر المتأثر (Target Entity):</span>
            <span className="font-mono font-bold text-cyan-400 text-xs">{log.entity_id}</span>
          </div>
        </div>

        {/* JSON Payload Details */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>بيانات الحدث المسجلة (Event Details Payload):</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ JSON'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 max-h-56 overflow-y-auto leading-relaxed">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

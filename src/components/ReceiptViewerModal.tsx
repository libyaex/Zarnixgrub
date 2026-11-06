import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Check, Ban, Download, AlertTriangle } from 'lucide-react';
import { Order } from '../types';

interface ReceiptViewerModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (orderId: string, adminNotes: string) => Promise<void>;
  onReject: (orderId: string, reason: string, adminNotes: string) => Promise<void>;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  order,
  isOpen,
  onClose,
  onApprove,
  onReject
}) => {
  const [zoom, setZoom] = useState(1);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order.payment_submission) return null;

  const sub = order.payment_submission;

  const handleApprove = async () => {
    setErrorMsg(null);
    setProcessing(true);
    try {
      await onApprove(order.id, adminNotes);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setErrorMsg('يرجى تحديد وكتابة سبب رفض الإيصال لإبلاغ المشتري');
      return;
    }
    setErrorMsg(null);
    setProcessing(true);
    try {
      await onReject(order.id, rejectionReason, adminNotes);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 my-8 space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              مراجعة إثبات التحويل المصرفي للطلب #{order.order_number}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تحقق من صحة تفاصيل الحوالة ومطابقتها مع كشف حساب المصرف
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column: Receipt image with zoom controls (Left), Data checklist (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Image & Zoom Viewer */}
          <div className="lg:col-span-7 bg-slate-950 rounded-xl border border-slate-800 p-3 flex flex-col items-center justify-between min-h-[360px]">
            <div className="w-full flex items-center justify-between px-2 pb-2 border-b border-slate-800 text-xs text-slate-400">
              <span>معاينة الإيصال</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(prev => Math.min(prev + 0.3, 2.5))}
                  className="p-1 rounded bg-slate-800 text-slate-200 hover:text-white"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(prev => Math.max(prev - 0.3, 0.7))}
                  className="p-1 rounded bg-slate-800 text-slate-200 hover:text-white"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                >
                  إعادة ضبط
                </button>
                {sub.receipt_storage_path && (
                  <a
                    href={sub.receipt_storage_path}
                    download={`receipt_${order.order_number}.png`}
                    className="p-1 rounded bg-slate-800 text-slate-200 hover:text-white"
                    title="تنزيل الإيصال"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="w-full flex-1 overflow-auto flex items-center justify-center p-2 max-h-[420px]">
              {sub.receipt_storage_path ? (
                <img
                  src={sub.receipt_storage_path}
                  alt="إيصال التحويل"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                  className="transition-transform duration-200 rounded-lg max-w-full max-h-[380px] object-contain shadow-lg"
                />
              ) : (
                <div className="text-xs text-slate-500">لا توجد صورة إيصال مرفقة</div>
              )}
            </div>
          </div>

          {/* Details & Decision Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <span className="font-bold text-slate-300 block border-b border-slate-800 pb-2">
                بيانات المعاملة المصرحة من العميل:
              </span>

              <div className="flex justify-between">
                <span className="text-slate-400">اسم المرسل:</span>
                <span className="font-bold text-white">{sub.sender_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المصرف المرسل:</span>
                <span className="text-slate-200">{sub.sender_bank || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">رقم مرجع الحوالة:</span>
                <span className="font-mono font-bold text-emerald-300">{sub.transaction_reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ المحول:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {sub.transferred_amount.toLocaleString('ar-LY')} د.ل
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ المطلوب للطلب:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {order.total_amount.toLocaleString('ar-LY')} د.ل
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">تاريخ الحوالة:</span>
                <span className="text-slate-300 font-mono">{sub.transfer_date}</span>
              </div>
              {sub.notes && (
                <div className="pt-2 border-t border-slate-800 text-slate-400">
                  <span className="block text-[11px] font-semibold text-slate-500">ملاحظات العميل:</span>
                  <p className="mt-0.5 text-slate-300 italic">{sub.notes}</p>
                </div>
              )}
            </div>

            {/* Admin notes input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ملاحظات إدارية داخلية (تدون في سجل العمليات):
              </label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="مثلاً: تمت مطابقة المبلغ مع كشف حساب مصرف الأمان رقم 102..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold text-center">
                {errorMsg}
              </div>
            )}

            {/* Reject reason sub-form if toggle active */}
            {showRejectForm ? (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>رفض إثبات التحويل وإشعار العميل:</span>
                </div>
                <textarea
                  rows={2}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="سبب الرفض (مثلاً: رقم الحوالة غير مطابق لكشف الحساب / المبلغ ناقص)..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-rose-800 text-white focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handleReject}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {processing ? 'جارٍ الرفض...' : 'تأكيد الرفض'}
                  </button>
                </div>
              </div>
            ) : (
              /* Decision Actions */
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={handleApprove}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>تأكيد وصول المبلغ واعتماد الطلب (Paid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-rose-400 border border-rose-900/40 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>رفض الإيصال وطلب إثبات جديد</span>
                </button>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

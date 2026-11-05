import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Upload, Building2, AlertCircle, ShieldCheck } from 'lucide-react';
import { PaymentAccount, Order } from '../types';

interface BankTransferModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (updatedOrder: Order) => void;
}

export const BankTransferModal: React.FC<BankTransferModalProps> = ({
  order,
  isOpen,
  onClose,
  onSubmitted
}) => {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form fields
  const [senderName, setSenderName] = useState(order.customer_name || '');
  const [senderBank, setSenderBank] = useState('مصرف الأمان');
  const [transactionRef, setTransactionRef] = useState('');
  const [transferredAmount, setTransferredAmount] = useState<number>(order.total_amount);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bank-accounts')
      .then(res => res.json())
      .then(data => {
        setAccounts(data);
        if (data.length > 0) {
          const def = data.find((a: PaymentAccount) => a.is_default) || data[0];
          setSelectedAccountId(def.id);
        }
      })
      .catch(console.error);
  }, []);

  if (!isOpen) return null;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0];

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('حجم صورة الإيصال يجب ألا يتجاوز 10 ميغابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!senderName.trim()) {
      setErrorMsg('يرجى إدخال اسم صاحب الحساب المحول منه');
      return;
    }
    if (!transactionRef.trim()) {
      setErrorMsg('يرجى إدخال رقم مرجع الحوالة المصرفية');
      return;
    }
    if (!receiptImage) {
      setErrorMsg('يرجى إرفاق صورة إيصال التحويل المصرفي');
      return;
    }
    if (Number(transferredAmount) <= 0) {
      setErrorMsg('المبلغ المحول غير صحيح');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/payments/submit-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          sender_name: senderName,
          sender_bank: senderBank,
          transaction_reference: transactionRef,
          transferred_amount: transferredAmount,
          transfer_date: transferDate,
          receipt_image: receiptImage,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إرسال إثبات التحويل');
      }

      onSubmitted(data.order);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء رفع إثبات الدفع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-8 space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">إتمام الدفع المصرفي</h3>
              <p className="text-xs text-slate-400">الطلب رقم: <span className="font-mono text-emerald-400 font-bold">{order.order_number}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount to pay banner */}
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-300 block">المبلغ المطلوب تحويله بالدينار الليبي:</span>
            <span className="text-2xl font-black text-white tabular-nums">
              {order.total_amount.toLocaleString('ar-LY')} <span className="text-sm font-normal text-slate-300">دينار ليبي</span>
            </span>
          </div>
          <span className="text-xs text-emerald-300 bg-emerald-900/60 px-3 py-1 rounded-md border border-emerald-700/50">
            العملة المعتمدة: LYD
          </span>
        </div>

        {/* Bank Account Details Card */}
        {selectedAccount && (
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">بيانات الحساب المصرفي للمتجر:</span>
              {accounts.length > 1 && (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.bank_name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400">المصرف:</span>
                <span className="font-bold text-white">{selectedAccount.bank_name}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400">اسم صاحب الحساب:</span>
                <span className="font-bold text-white">{selectedAccount.account_holder}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400">رقم الحساب:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-emerald-300">{selectedAccount.account_number}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedAccount.account_number, 'account')}
                    className="p-1 text-slate-400 hover:text-white"
                    title="نسخ رقم الحساب"
                  >
                    {copiedField === 'account' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {selectedAccount.iban && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400">الآيبان الدولي (IBAN):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-200">{selectedAccount.iban}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedAccount.iban!, 'iban')}
                      className="p-1 text-slate-400 hover:text-white"
                      title="نسخ الآيبان"
                    >
                      {copiedField === 'iban' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {selectedAccount.instructions && (
                <p className="text-[11px] text-amber-300/90 bg-amber-950/20 p-2.5 rounded-lg border border-amber-800/40">
                  {selectedAccount.instructions}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Payment Submission Form */}
        <form onSubmit={handleSubmitProof} className="space-y-4">
          <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
            نموذج إرفاق إثبات الحوالة المصرفية
          </h4>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                اسم صاحب الحساب المحول منه *
              </label>
              <input
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="الاسم الرباعي للمحول"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                المصرف المرسل منه
              </label>
              <input
                type="text"
                value={senderBank}
                onChange={(e) => setSenderBank(e.target.value)}
                placeholder="مثلاً: مصرف الأمان / مصرف الجمهورية"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                رقم مرجع الحوالة / العملية *
              </label>
              <input
                type="text"
                required
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="مثلاً: TRX-98421"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                المبلغ المحول (د.ل) *
              </label>
              <input
                type="number"
                required
                value={transferredAmount}
                onChange={(e) => setTransferredAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              تاريخ التحويل *
            </label>
            <input
              type="date"
              required
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-full sm:w-1/2 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Receipt Image Dropzone */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              صورة إيصال التحويل (لقطة شاشة أو مستند المعاملة) *
            </label>
            <div className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-4 text-center bg-slate-950/60 transition-colors">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
              {receiptImage ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={receiptImage}
                    alt="معاينة إيصال التحويل"
                    className="max-h-40 rounded-lg border border-slate-700 object-contain shadow-md"
                  />
                  <span className="text-xs text-emerald-400 font-medium">انقر لتغيير الصورة المرفقة</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Upload className="w-8 h-8 text-slate-500" />
                  <span className="text-xs font-medium text-slate-300">اضغط لرفع صورة الإيصال أو اسحبها هنا</span>
                  <span className="text-[10px] text-slate-500">PNG, JPG, JPEG أو PDF بحد أقصى 10MB</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              ملاحظات إضافية (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل ترغب في توضيحها لفريق المراجعة..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              بمجرد إرسال الإثبات، سيتولى فريق المراجعة التحقق من وصول المبلغ إلى الحساب المصرفي خلال أوقات العمل وتأكيد الطلب لتفعيل روابط التحميل المباشرة وجدولة الخدمات.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-xl shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'جارٍ الإرسال...' : 'إرسال إثبات التحويل'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

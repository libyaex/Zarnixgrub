/**
 * Payments: customers submit bank-transfer proof; staff with `approve_payments`
 * review it. The review is the ONLY path that can set an order to `paid`.
 *
 *  - The receipt must be an object the CALLER uploaded (path under their own
 *    folder) and it must really exist in storage.
 *  - Amount is compared against the order total before approval.
 *  - Approval is claimed atomically (conditional update) so two reviewers can
 *    not both approve, and entitlements are upserted (never duplicated).
 *  - Every decision is written to the audit log.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { requireAuth, requirePermission } from '../lib/auth.ts';
import { audit } from '../lib/audit.ts';
import { isOwnReceiptPath, isUuid } from '../lib/validators.ts';
import { shapeOrder } from '../lib/shape.ts';
import { RECEIPT_BUCKET, storageObjectExists } from './upload.ts';

export const paymentsRouter = Router();

/** Amount mismatch tolerance for bank transfers (LYD has no cents in practice). */
const AMOUNT_TOLERANCE = 1;
const DEFAULT_ALLOWED_DOWNLOADS = 3;

/** POST /api/payments/submit — the customer submits proof for their OWN order. */
paymentsRouter.post('/submit', requireAuth, async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const orderId = String(b.order_id ?? '');
  const senderName = typeof b.sender_name === 'string' ? b.sender_name.trim().slice(0, 120) : '';
  const reference = typeof b.transaction_reference === 'string' ? b.transaction_reference.trim().slice(0, 64) : '';
  const amount = Number(b.transferred_amount);
  const receiptPath = typeof b.receipt_storage_path === 'string' ? b.receipt_storage_path.slice(0, 300) : '';

  if (!isUuid(orderId) || !senderName || !reference || !Number.isFinite(amount) || amount <= 0 || !receiptPath) {
    res.status(400).json({ error: 'بيانات إثبات التحويل غير مكتملة' });
    return;
  }
  if (!isOwnReceiptPath(receiptPath, req.user!.id)) {
    res.status(400).json({ error: 'مسار الإيصال غير صالح' });
    return;
  }
  if (!(await storageObjectExists(RECEIPT_BUCKET, receiptPath))) {
    res.status(400).json({ error: 'لم يتم العثور على الإيصال المرفوع. أعد رفعه ثم حاول مجدداً.' });
    return;
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, total_amount, payment_status')
    .eq('id', orderId)
    .eq('user_id', req.user!.id)
    .maybeSingle();
  if (!order) {
    res.status(404).json({ error: 'لم يتم العثور على الطلب' });
    return;
  }
  if (order.payment_status !== 'unsubmitted' && order.payment_status !== 'rejected') {
    res.status(409).json({ error: 'تم إرسال إثبات دفع لهذا الطلب مسبقاً أو أنه قيد المراجعة' });
    return;
  }

  const { data: dupe } = await supabaseAdmin
    .from('payment_submissions').select('id').eq('transaction_reference', reference).maybeSingle();
  if (dupe) {
    res.status(409).json({ error: 'رقم المرجع مستخدم مسبقاً في إثبات تحويل آخر' });
    return;
  }

  // Claim the order first (conditional update) so concurrent submits cannot both pass.
  const { data: claimed } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'under_review', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .in('payment_status', ['unsubmitted', 'rejected'])
    .select('id');
  if (!claimed?.length) {
    res.status(409).json({ error: 'تم إرسال إثبات دفع لهذا الطلب مسبقاً' });
    return;
  }

  const rawDate = typeof b.transfer_date === 'string' ? b.transfer_date : '';
  const { data: submission, error } = await supabaseAdmin
    .from('payment_submissions')
    .insert({
      order_id: order.id,
      sender_name: senderName,
      sender_bank: typeof b.sender_bank === 'string' ? b.sender_bank.slice(0, 120) : null,
      transaction_reference: reference,
      transferred_amount: Math.round(amount * 100) / 100,
      transfer_date: /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10),
      receipt_storage_path: receiptPath,
      notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : null,
      status: 'submitted',
    })
    .select()
    .single();
  if (error || !submission) {
    // Roll the claim back so the customer can retry.
    await supabaseAdmin.from('orders').update({ payment_status: order.payment_status }).eq('id', order.id);
    res.status(error?.code === '23505' ? 409 : 500).json({
      error: error?.code === '23505' ? 'رقم المرجع مستخدم مسبقاً في إثبات تحويل آخر' : 'تعذر حفظ إثبات التحويل',
    });
    return;
  }

  const { data: fresh } = await supabaseAdmin
    .from('orders').select('*, order_items(*), payment_submissions(*)').eq('id', order.id).single();
  res.status(201).json({ submission, order: fresh ? shapeOrder(fresh) : undefined });
});

/** GET /api/payments — staff listing of submissions. */
paymentsRouter.get('/', requireAuth, requirePermission('approve_payments'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payment_submissions')
    .select('*, orders(order_number, total_amount, user_id)')
    .order('created_at', { ascending: false })
    .range(0, 499);
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل المدفوعات' });
    return;
  }
  res.json(data ?? []);
});

/** POST /api/payments/review { submission_id, decision, rejection_reason? } */
paymentsRouter.post('/review', requireAuth, requirePermission('approve_payments'), async (req: Request, res: Response) => {
  const submissionId = String(req.body?.submission_id ?? '');
  const decision = String(req.body?.decision ?? '');
  const reason = typeof req.body?.rejection_reason === 'string' ? req.body.rejection_reason.trim().slice(0, 500) : '';

  if (!isUuid(submissionId) || !['approve', 'reject'].includes(decision)) {
    res.status(400).json({ error: 'بيانات المراجعة غير صالحة' });
    return;
  }
  if (decision === 'reject' && !reason) {
    res.status(400).json({ error: 'سبب الرفض مطلوب' });
    return;
  }

  const { data: submission } = await supabaseAdmin
    .from('payment_submissions')
    .select('*, orders!inner(id, user_id, total_amount, payment_status)')
    .eq('id', submissionId)
    .maybeSingle();
  if (!submission) {
    res.status(404).json({ error: 'لم يتم العثور على إثبات التحويل' });
    return;
  }
  if (submission.status !== 'under_review' && submission.status !== 'submitted') {
    res.status(409).json({ error: 'تمت مراجعة هذا الإثبات مسبقاً' });
    return;
  }
  const order = submission.orders as { id: string; user_id: string; total_amount: number };
  const now = new Date().toISOString();

  if (decision === 'approve') {
    const mismatch = Math.abs(Number(submission.transferred_amount) - Number(order.total_amount));
    if (mismatch > AMOUNT_TOLERANCE) {
      res.status(422).json({
        error: `المبلغ المحوَّل (${submission.transferred_amount} د.ل) لا يطابق إجمالي الطلب (${order.total_amount} د.ل). يرجى التحقق قبل الاعتماد.`,
      });
      return;
    }

    // Atomic claim: only one reviewer can move the submission out of its pending state.
    const { data: claimed } = await supabaseAdmin
      .from('payment_submissions')
      .update({ status: 'paid', reviewed_by: req.user!.id, reviewed_at: now })
      .eq('id', submission.id)
      .in('status', ['submitted', 'under_review'])
      .select('id');
    if (!claimed?.length) {
      res.status(409).json({ error: 'تمت مراجعة هذا الإثبات للتو من مراجع آخر' });
      return;
    }

    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'paid', order_status: 'processing', updated_at: now })
      .eq('id', order.id);
    if (orderError) {
      await supabaseAdmin.from('payment_submissions').update({ status: submission.status, reviewed_by: null, reviewed_at: null }).eq('id', submission.id);
      res.status(500).json({ error: 'تعذر اعتماد الطلب' });
      return;
    }

    const { data: items } = await supabaseAdmin.from('order_items').select('product_id').eq('order_id', order.id);
    const productIds = [...new Set((items ?? []).map((i) => i.product_id as string))];
    let provisioned = 0;
    if (productIds.length) {
      const { data: files } = await supabaseAdmin
        .from('product_files').select('id, product_id')
        .in('product_id', productIds).eq('is_downloadable', true).eq('is_active', true);
      const rows = (files ?? []).map((f) => ({
        user_id: order.user_id, order_id: order.id, product_id: f.product_id,
        product_file_id: f.id, allowed_downloads: DEFAULT_ALLOWED_DOWNLOADS, is_active: true,
      }));
      if (rows.length) {
        const { error: entError } = await supabaseAdmin
          .from('download_entitlements')
          .upsert(rows, { onConflict: 'order_id,product_file_id', ignoreDuplicates: true });
        if (entError) console.error('[payments] entitlement provisioning failed:', entError.message);
        else provisioned = rows.length;
      }
    }
    await audit(req, 'approve_payment', 'payment_submission', submission.id, { order_id: order.id, amount: submission.transferred_amount, entitlements: provisioned });
    res.json({
      success: true,
      entitlements_created: provisioned,
      message: provisioned
        ? 'تم اعتماد الدفع وتفعيل حصص التحميل'
        : 'تم اعتماد الدفع. تنبيه: لا توجد ملفات مرفوعة لهذا المنتج، ارفع ملف المشروع ثم مدّد التراخيص يدوياً.',
    });
    return;
  }

  const { data: claimed } = await supabaseAdmin
    .from('payment_submissions')
    .update({ status: 'rejected', rejection_reason: reason, reviewed_by: req.user!.id, reviewed_at: now })
    .eq('id', submission.id)
    .in('status', ['submitted', 'under_review'])
    .select('id');
  if (!claimed?.length) {
    res.status(409).json({ error: 'تمت مراجعة هذا الإثبات للتو من مراجع آخر' });
    return;
  }
  const { error: orderError } = await supabaseAdmin
    .from('orders').update({ payment_status: 'rejected', updated_at: now }).eq('id', order.id);
  if (orderError) {
    res.status(500).json({ error: 'تعذر رفض الطلب' });
    return;
  }
  await audit(req, 'reject_payment', 'payment_submission', submission.id, { order_id: order.id, reason });
  res.json({ success: true, message: 'تم رفض الدفعة وإرجاع الطلب للعميل' });
});

/**
 * Phase 4 — Payments endpoints backed by Supabase.
 *
 * Fixes:
 * - Review requires the `approve_payments` permission (owner/admin/payment_manager).
 * - Receipt amount is compared against the order total before marking paid.
 * - Duplicate bank transfer references are rejected (DB unique index too).
 * - Orders can never flip to `paid` outside the review flow.
 */
import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, requirePermission } from '../lib/auth';

export const paymentsRouter = Router();

/** Amount mismatch tolerance for bank transfers (LYD has no cents in practice). */
const AMOUNT_TOLERANCE = 1;

/**
 * POST /api/payments/submit — authenticated customer submits transfer proof
 * for their OWN order only.
 */
paymentsRouter.post('/submit', requireAuth, async (req: Request, res: Response) => {
  const orderId = String(req.body?.order_id ?? '');
  const senderName = typeof req.body?.sender_name === 'string' ? req.body.sender_name.trim().slice(0, 120) : '';
  const transactionReference =
    typeof req.body?.transaction_reference === 'string'
      ? req.body.transaction_reference.trim().slice(0, 64)
      : '';
  const transferredAmount = Number(req.body?.transferred_amount);
  const receiptStoragePath =
    typeof req.body?.receipt_storage_path === 'string'
      ? req.body.receipt_storage_path.slice(0, 300)
      : '';

  if (!orderId || !senderName || !transactionReference || !Number.isFinite(transferredAmount) || !receiptStoragePath) {
    res.status(400).json({ error: 'بيانات إثبات التحويل غير مكتملة' });
    return;
  }

  // The order must belong to the authenticated user and be unpaid.
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, user_id, total_amount, payment_status')
    .eq('id', orderId)
    .eq('user_id', req.user!.id)
    .single();
  if (orderError || !order) {
    res.status(404).json({ error: 'لم يتم العثور على الطلب' });
    return;
  }
  if (order.payment_status !== 'unsubmitted' && order.payment_status !== 'rejected') {
    res.status(409).json({ error: 'تم إرسال إثبات دفع لهذا الطلب مسبقاً أو أنه قيد المراجعة' });
    return;
  }

  // Duplicate reference check (also enforced by a DB unique index).
  const { data: dupe } = await supabaseAdmin
    .from('payment_submissions')
    .select('id')
    .eq('transaction_reference', transactionReference)
    .maybeSingle();
  if (dupe) {
    res.status(409).json({ error: 'رقم المرجع مستخدم مسبقاً في إثبات تحويل آخر' });
    return;
  }

  const { data: submission, error: submitError } = await supabaseAdmin
    .from('payment_submissions')
    .insert({
      order_id: order.id,
      sender_name: senderName,
      sender_bank: typeof req.body?.sender_bank === 'string' ? req.body.sender_bank.slice(0, 120) : null,
      transaction_reference: transactionReference,
      transferred_amount: transferredAmount,
      transfer_date: typeof req.body?.transfer_date === 'string' ? req.body.transfer_date : new Date().toISOString(),
      receipt_storage_path: receiptStoragePath,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 500) : null,
      status: 'under_review',
    })
    .select()
    .single();
  if (submitError || !submission) {
    res.status(500).json({ error: 'تعذر حفظ إثبات التحويل' });
    return;
  }

  const { error: orderUpdateError } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'under_review', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('payment_status', 'unsubmitted');
  if (orderUpdateError) {
    res.status(500).json({ error: 'تعذر تحديث حالة الطلب' });
    return;
  }

  res.status(201).json({ submission });
});

/** GET /api/payments — admin listing of submissions under review. */
paymentsRouter.get('/', requireAuth, requirePermission('approve_payments'), async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payment_submissions')
    .select('*, orders(order_number, total_amount, user_id, customer_name)')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'تعذر تحميل المدفوعات' });
    return;
  }
  res.json(data ?? []);
});

/**
 * POST /api/payments/review — permission-guarded approval/rejection.
 * The ONLY path that can set an order's payment_status to `paid`.
 */
paymentsRouter.post(
  '/review',
  requireAuth,
  requirePermission('approve_payments'),
  async (req: Request, res: Response) => {
    const submissionId = String(req.body?.submission_id ?? '');
    const decision = String(req.body?.decision ?? '');
    const rejectionReason =
      typeof req.body?.rejection_reason === 'string' ? req.body.rejection_reason.slice(0, 500) : null;

    if (!submissionId || !['approve', 'reject'].includes(decision)) {
      res.status(400).json({ error: 'بيانات المراجعة غير صالحة' });
      return;
    }
    if (decision === 'reject' && !rejectionReason) {
      res.status(400).json({ error: 'سبب الرفض مطلوب' });
      return;
    }

    const { data: submission, error: subError } = await supabaseAdmin
      .from('payment_submissions')
      .select('*, orders!inner(id, user_id, total_amount, payment_status)')
      .eq('id', submissionId)
      .single();
    if (subError || !submission) {
      res.status(404).json({ error: 'لم يتم العثور على إثبات التحويل' });
      return;
    }
    if (submission.status !== 'under_review' && submission.status !== 'submitted') {
      res.status(409).json({ error: 'تمت مراجعة هذا الإثبات مسبقاً' });
      return;
    }

    const order = submission.orders as { id: string; user_id: string; total_amount: number };

    if (decision === 'approve') {
      const mismatch = Math.abs(Number(submission.transferred_amount) - Number(order.total_amount));
      if (mismatch > AMOUNT_TOLERANCE) {
        res.status(422).json({
          error: `المبلغ المحوَّل (${submission.transferred_amount} د.ل) لا يطابق إجمالي الطلب (${order.total_amount} د.ل). يرجى التحقق قبل الاعتماد.`,
        });
        return;
      }

      const { error: approveError } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid', order_status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (approveError) {
        res.status(500).json({ error: 'تعذر اعتماد الطلب' });
        return;
      }

      const { error: subUpdateError } = await supabaseAdmin
        .from('payment_submissions')
        .update({
          status: 'paid',
          reviewed_by: req.user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id);
      if (subUpdateError) {
        res.status(500).json({ error: 'تعذر تحديث حالة الإثبات' });
        return;
      }

      // Provision download entitlements for each digital item in the order.
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('product_id')
        .eq('order_id', order.id);
      for (const item of items ?? []) {
        const { data: files } = await supabaseAdmin
          .from('product_files')
          .select('id, file_name, file_size, version, is_downloadable, is_active')
          .eq('product_id', item.product_id)
          .eq('is_downloadable', true)
          .eq('is_active', true);
        for (const file of files ?? []) {
          await supabaseAdmin.from('download_entitlements').insert({
            user_id: order.user_id,
            order_id: order.id,
            product_id: item.product_id,
            product_file_id: file.id,
            allowed_downloads: 3,
            is_active: true,
          });
        }
      }

      res.json({ success: true, message: 'تم اعتماد الدفع وتفعيل حصص التحميل' });
      return;
    }

    // Rejection path
    const { error: rejectOrderError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', order.id);
    if (rejectOrderError) {
      res.status(500).json({ error: 'تعذر رفض الطلب' });
      return;
    }
    const { error: rejectSubError } = await supabaseAdmin
      .from('payment_submissions')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        reviewed_by: req.user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id);
    if (rejectSubError) {
      res.status(500).json({ error: 'تعذر تحديث حالة الإثبات' });
      return;
    }
    res.json({ success: true, message: 'تم رفض الدفعة وإرجاع الطلب للعميل' });
  }
);

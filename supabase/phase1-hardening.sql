-- =============================================================================
-- Phase 1 — Schema hardening & migration notes (NIZAR DIGITAL / Zarnixgrub)
-- المرحلة 1 — تحصين المخطط وملاحظات الترحيل
--
-- هذا الملف يُنفَّذ بعد schema.sql الأساسي في SQL Editor في Supabase.
-- It must run AFTER the base supabase/schema.sql.
--
-- الهدف / Goal:
--   1) توحيد الأدوار مع الواجهة والخادم (owner بدل الأدوار المتضاربة).
--   2) دعم صلاحيات دقيقة في قاعدة البيانات (roles + role_permissions).
--   3) منع تكرار رقم مرجع الحوالة (unique).
--   4) تحقق مبلغ الإيصال مقابل إجمالي الطلب (constraint).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) جدول الأدوار المخصصة في قاعدة البيانات
--    Custom RBAC roles stored in the database (server reads from here,
--    the browser can never choose a role).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,            -- e.g. 'order_reviewer'
  name_ar TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- صلاحيات الدور / role permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  UNIQUE (role_id, permission_key)
);

-- البيانات الافتراضية / Seed system roles mirroring server/lib/auth.ts
INSERT INTO public.roles (id, name, name_ar, is_system, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner',   'المالك (Owner)',   TRUE, '#a855f7'),
  ('00000000-0000-0000-0000-000000000002', 'admin',   'مدير النظام (Admin)', TRUE, '#3b82f6'),
  ('00000000-0000-0000-0000-000000000003', 'product_manager', 'مدير المنتجات', TRUE, '#10b981'),
  ('00000000-0000-0000-0000-000000000004', 'payment_manager', 'مدير المدفوعات', TRUE, '#f59e0b'),
  ('00000000-0000-0000-0000-000000000005', 'support_manager', 'مدير الدعم', TRUE, '#06b6d4')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2) منع تكرار رقم مرجع الحوالة لكل حساب بنكي
--    Prevent duplicate bank transfer references per account.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_submissions_reference
  ON public.payment_submissions (transaction_reference);

-- -----------------------------------------------------------------------------
-- 3) سجل تدقيق إداري بأصل موثّق
--    Audit log rows now record the acting admin id from verified JWT.
-- -----------------------------------------------------------------------------
-- audit_logs.admin_id should reference profiles(id), not a free-text name.
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_admin_fk
  FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 4) تنبيه مهم حول التحقق من المبلغ
--    Amount verification against order total is enforced in the server
--    route (payments review) — comparing payment_submissions.transferred_amount
--    with orders.total_amount — because Postgres constraints cannot join
--    between the two rows at insert time. Do NOT trust browser amounts.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 5) ملاحظات التشغيل / Deployment notes
--    - Set these in Vercel Project Settings → Environment Variables:
--        SUPABASE_URL, VITE_SUPABASE_URL,
--        VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
--    - Never commit SUPABASE_SERVICE_ROLE_KEY to the repository.
-- -----------------------------------------------------------------------------

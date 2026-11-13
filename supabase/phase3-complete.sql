-- =============================================================================
-- Phase 3 — Completion migration (idempotent; safe to re-run)
-- Run AFTER schema.sql, phase1-hardening.sql and phase2-auto-provision.sql.
-- =============================================================================

-- 1) Custom roles ------------------------------------------------------------
-- profiles.role stays the user_role enum (RLS keeps depending on it). A staff
-- member with a CUSTOM role keeps role='customer' at the database level (least
-- privilege for RLS) and points to roles(id) here; the API resolves the
-- effective role + permissions from roles/role_permissions.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- 2) Staff invitations -------------------------------------------------------
-- The dashboard can pre-assign a role to an email that has not signed in yet.
-- The role is applied automatically on that person's first verified sign-in.
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  notes TEXT,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_invites_open_email
  ON public.staff_invites (lower(email)) WHERE accepted_at IS NULL;

-- 3) Manual service tasks (walk-in customers without an order) ---------------
ALTER TABLE public.service_tasks ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.service_tasks ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.service_tasks ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.service_tasks ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.service_tasks ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.service_tasks ADD COLUMN IF NOT EXISTS product_name TEXT;

-- 4) Integrity & performance -------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_files_path
  ON public.product_files (product_id, storage_path);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entitlement_order_file
  ON public.download_entitlements (order_id, product_file_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON public.download_entitlements (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_order ON public.payment_submissions (order_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);

-- 5) Atomic coupon redemption (no lost updates under concurrency) -------------
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated INT;
BEGIN
  UPDATE public.coupons
     SET used_count = used_count + 1
   WHERE code = upper(p_code) AND is_active AND used_count < max_uses;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_coupon(TEXT) FROM PUBLIC, anon, authenticated;

-- 6) Row Level Security for new tables (API uses the service role) -----------
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 7) Private storage buckets -------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('project_files', 'project_files', FALSE), ('payment_receipts', 'payment_receipts', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- 8) Default permissions for the built-in staff roles (shown in the dashboard)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r
JOIN (VALUES
  ('admin','manage_products'),('admin','manage_orders'),('admin','approve_payments'),
  ('admin','manage_downloads'),('admin','manage_services'),('admin','manage_coupons'),
  ('admin','manage_banks'),('admin','manage_users'),('admin','view_financial_analytics'),
  ('admin','manage_settings'),('admin','view_audit_logs'),
  ('product_manager','manage_products'),('product_manager','manage_downloads'),
  ('payment_manager','approve_payments'),('payment_manager','manage_banks'),('payment_manager','manage_orders'),
  ('support_manager','manage_orders'),('support_manager','manage_services'),
  ('support_manager','manage_downloads'),('support_manager','manage_users')
) AS p(role_name, key) ON p.role_name = r.name
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- 9) Product columns the storefront already uses but the schema lacked --------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS demo_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code_repository TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 10) Public bucket for storefront images (covers / gallery). Private files stay private.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

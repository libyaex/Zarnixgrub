-- =============================================================================
-- Phase 1 — Safe, repeatable schema hardening
-- Run after `schema.sql` in Supabase SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  UNIQUE (role_id, permission_key)
);

INSERT INTO public.roles (id, name, name_ar, is_system, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner', 'المالك (Owner)', TRUE, '#a855f7'),
  ('00000000-0000-0000-0000-000000000002', 'admin', 'مدير النظام (Admin)', TRUE, '#3b82f6'),
  ('00000000-0000-0000-0000-000000000003', 'product_manager', 'مدير المنتجات', TRUE, '#10b981'),
  ('00000000-0000-0000-0000-000000000004', 'payment_manager', 'مدير المدفوعات', TRUE, '#f59e0b'),
  ('00000000-0000-0000-0000-000000000005', 'support_manager', 'مدير الدعم', TRUE, '#06b6d4')
ON CONFLICT (name) DO NOTHING;

-- Ensure the profile role enum contains every value required by the app.
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Enforce uniqueness for non-empty transfer references; empty legacy values
-- do not prevent adding the index (verify/resolve duplicates before running).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_submissions_reference
  ON public.payment_submissions (transaction_reference)
  WHERE transaction_reference IS NOT NULL AND transaction_reference <> '';

-- Avoid imposing an incompatible FK on an existing audit log schema here.
-- The verified actor is recorded by application code using profiles.id.

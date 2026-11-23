-- =============================================================================
-- Phase 5 — Payment methods: OnePay (account number) and LYPay (IBAN) next to
-- ordinary bank transfers. Idempotent; run after phase4.
-- =============================================================================

ALTER TABLE public.payment_accounts
  ADD COLUMN IF NOT EXISTS method_type TEXT NOT NULL DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_accounts_method_type_check') THEN
    ALTER TABLE public.payment_accounts
      ADD CONSTRAINT payment_accounts_method_type_check
      CHECK (method_type IN ('bank_transfer', 'onepay', 'lypay', 'other'));
  END IF;
END $$;

-- LYPay accounts are identified by IBAN only, so the account number can be empty.
ALTER TABLE public.payment_accounts ALTER COLUMN account_number DROP NOT NULL;

-- At most one default account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_accounts_single_default
  ON public.payment_accounts (is_default) WHERE is_default;

-- Which method/account the customer actually paid with (shown to the reviewer).
ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES public.payment_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

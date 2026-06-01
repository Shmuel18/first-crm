-- =============================================================================
-- Migration 114: "fee paid" flag on case_financials (admin block)
-- =============================================================================
-- Per Kaufman: in the admin block, mark that the client paid the agreed fee,
-- with the payment date. Lives on the manager-only case_financials table
-- (RLS is_admin, migration 025), so it inherits the same access gate as
-- fee_amount, and the existing audit trigger captures changes automatically.
-- =============================================================================

ALTER TABLE public.case_financials
  ADD COLUMN IF NOT EXISTS fee_paid BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.case_financials
  ADD COLUMN IF NOT EXISTS fee_paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.case_financials.fee_paid IS
  'Whether the client has paid the agreed fee (manager-marked).';
COMMENT ON COLUMN public.case_financials.fee_paid_at IS
  'When fee_paid was last set to true — stamped by the app on check.';

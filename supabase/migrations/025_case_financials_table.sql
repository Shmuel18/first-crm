-- =============================================================================
-- Migration 025: Separate case_financials table (#1)
-- =============================================================================
-- Closes the column-level access gap on cases.fee_amount + cases.expected_income.
-- Postgres RLS is row-level, so any user able to SELECT a case row could
-- pull the financial columns from the Supabase client regardless of UI
-- hiding. Moving them to a dedicated table with is_admin()-gated RLS makes
-- the access boundary enforceable at the DB.
--
-- This migration is non-trivial: it backfills + drops columns + reshapes
-- audit. App-layer changes (cases.service, create-case, update-case,
-- case detail page) ship in the same commit.
-- Dependencies: 006 (cases), 011 (is_admin), 012/013 (audit_log_change)
-- =============================================================================

-- =============================================================================
-- 1. Create case_financials (1:1 with cases)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.case_financials (
  case_id UUID PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  fee_amount NUMERIC,
  expected_income NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- =============================================================================
-- 2. Backfill from cases (before we drop the columns)
-- =============================================================================
INSERT INTO public.case_financials (case_id, fee_amount, expected_income)
SELECT id, fee_amount, expected_income
FROM public.cases
WHERE fee_amount IS NOT NULL OR expected_income IS NOT NULL
ON CONFLICT (case_id) DO NOTHING;

-- =============================================================================
-- 3. Drop the original columns from cases
-- =============================================================================
ALTER TABLE public.cases DROP COLUMN IF EXISTS fee_amount;
ALTER TABLE public.cases DROP COLUMN IF EXISTS expected_income;

-- =============================================================================
-- 4. updated_at trigger
-- =============================================================================
CREATE TRIGGER trg_case_financials_updated_at
  BEFORE UPDATE ON public.case_financials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. RLS — admin only (per spec 3.6.5 "manager only")
-- =============================================================================
ALTER TABLE public.case_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_financials_select" ON public.case_financials
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "case_financials_modify" ON public.case_financials
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- 6. Audit trigger — captures fee/expected changes for compliance
-- =============================================================================
-- Note: audit_log RLS is admin-only (migration 022), so the captured values
-- only flow to viewers who can see them anyway. The strip-on-cases logic in
-- audit_log_change becomes a no-op once the columns are gone, which is fine.
CREATE TRIGGER trg_audit_case_financials
  AFTER INSERT OR UPDATE OR DELETE ON public.case_financials
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

COMMENT ON TABLE public.case_financials IS
  'Manager-only financial data per case. Separated from cases because PG RLS is row-level, not column-level - the only enforceable column boundary is a separate table.';

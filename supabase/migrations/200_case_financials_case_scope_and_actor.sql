-- =============================================================================
-- Migration 200: case_financials cross-case hardening (security review ISS-01 +
--                ISS-23) — scope the manager-only fee table to the row's CASE,
--                not just the office-wide view_case_fee permission.
-- =============================================================================
-- Security review (2026-06-19) finding ISS-01 (High-impact IDOR): the final-state
-- RLS on public.case_financials (holds fee_amount + expected_income) was gated
-- ONLY on has_permission('view_case_fee') with NO can_view_case/can_edit_case
-- predicate (set in migration 027 #17, never re-tightened). Every sibling
-- per-case financial table binds to the case row (incomes/obligations mig 039/190,
-- expenses/properties mig 156/179/192, scenarios mig 195) — case_financials
-- slipped the mig-039 sweep. Because view_case_fee is admin-CONFIGURABLE (mig 117
-- only set the manager-only DEFAULT and had to retroactively revoke it from
-- senior_advisor), the moment a manager grants it to a non-admin that user can
-- read/write fee + expected_income for ANY case via a direct PostgREST call
-- (RLS evaluated only the office-wide boolean).
--
-- Fix:
--   1. case_financials RLS: SELECT now requires can_view_case(case_id); writes
--      split into INSERT/UPDATE gated by can_edit_case(case_id) — mirrors the
--      canonical pattern in mig 039/192. No DELETE policy (direct deletes stay
--      default-denied like every business table since mig 022; the cases FK
--      ON DELETE CASCADE is executed by the table owner during the SECURITY
--      DEFINER purge and is NOT subject to RLS).
--   2. upsert_case_financials (SECURITY INVOKER): fold in the can_edit_case gate
--      so a direct RPC call fails loudly (not on the write RLS), ADD the
--      auth.uid() = p_user_id actor assertion (ISS-23 attribution forgery — the
--      same pattern mig 199 applied to set_primary_bank), and pin search_path.
--
-- SAFE BY CONSTRUCTION: out-of-the-box only the manager holds view_case_fee, and
-- the manager has edit_any_case (so can_edit_case is always TRUE for them) and
-- view_all_cases — the happy path is unchanged. This only REMOVES the cross-case
-- delta that appears once view_case_fee is granted to a non-admin. The upsert's
-- happy-path caller (updateCaseFeeAmountAction) already passes auth.uid() as
-- p_user_id, so the actor assertion never trips a legitimate call.
--
-- Idempotent (DROP+CREATE POLICY / CREATE OR REPLACE). Deps: 025, 027, 117, 147.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Re-scope case_financials RLS to the row's case
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "case_financials_select" ON public.case_financials;
DROP POLICY IF EXISTS "case_financials_modify" ON public.case_financials;
DROP POLICY IF EXISTS "case_financials_insert" ON public.case_financials;
DROP POLICY IF EXISTS "case_financials_update" ON public.case_financials;

CREATE POLICY "case_financials_select" ON public.case_financials
  FOR SELECT TO authenticated
  USING (
    public.has_permission('view_case_fee')
    AND public.can_view_case(case_id)
  );

CREATE POLICY "case_financials_insert" ON public.case_financials
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('view_case_fee')
    AND public.can_edit_case(case_id)
  );

CREATE POLICY "case_financials_update" ON public.case_financials
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('view_case_fee')
    AND public.can_edit_case(case_id)
  )
  WITH CHECK (
    public.has_permission('view_case_fee')
    AND public.can_edit_case(case_id)
  );

-- -----------------------------------------------------------------------------
-- 2. upsert_case_financials — case-edit gate + actor assertion + search_path
--    (body is migration 027 #5 verbatim, with the three guards added on top)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_case_financials(
  p_case_id UUID,
  p_fee_amount NUMERIC,
  p_expected_income NUMERIC,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- ISS-23: attribution integrity — the caller cannot stamp another user's id
  -- into created_by/updated_by (mirrors set_primary_bank, migration 199).
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'upsert_case_financials: actor mismatch' USING ERRCODE = '42501';
  END IF;

  -- Permission check upfront: callers without view_case_fee silently skip
  -- (UI hides the fields, so a form submission with values is benign noise).
  IF NOT public.has_permission('view_case_fee') THEN
    RETURN FALSE;
  END IF;

  -- ISS-01: fee data is PER-CASE. The office-wide view_case_fee permission is
  -- necessary but NOT sufficient — the caller must also be able to EDIT this
  -- specific case. (INVOKER means the write below is already gated by
  -- case_financials_insert/update; this explicit guard makes a direct PostgREST
  -- RPC call fail loudly with 42501 instead of on the write RLS.)
  IF NOT public.can_edit_case(p_case_id) THEN
    RAISE EXCEPTION 'upsert_case_financials: not authorized to edit this case'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.case_financials (case_id, fee_amount, expected_income, created_by, updated_by)
  VALUES (p_case_id, p_fee_amount, p_expected_income, p_user_id, p_user_id)
  ON CONFLICT (case_id) DO UPDATE SET
    fee_amount = EXCLUDED.fee_amount,
    expected_income = EXCLUDED.expected_income,
    updated_by = EXCLUDED.updated_by;

  RETURN TRUE;
END;
$$;

INSERT INTO public.schema_version (version) VALUES (200) ON CONFLICT DO NOTHING;

-- =============================================================================
-- Migration 210: collections — advance_agreed flag + filtered overview RPC
-- =============================================================================
-- Adds `advance_agreed` (boolean, default FALSE) to case_financials so advisors
-- can mark that an upfront advance was agreed with the client, even before it
-- has been paid. The global /collections dashboard then filters to ONLY show
-- cases where there is something to collect:
--
--   1. advance_agreed = TRUE  — an advance was arranged
--   2. expenses  > 0          — office expenses to charge to the client
--   3. status = 'execution'   — mortgage is in ביצוע (fee is due)
--
-- This replaces the previous "show all active cases" behaviour.
-- =============================================================================

-- ---- New column on case_financials ------------------------------------------
ALTER TABLE public.case_financials
  ADD COLUMN IF NOT EXISTS advance_agreed BOOLEAN NOT NULL DEFAULT FALSE;

-- ---- Refresh collections_overview() -----------------------------------------
-- DROP first — CREATE OR REPLACE cannot change RETURNS TABLE columns (postgres
-- limitation; same fix applied in migration 208).
DROP FUNCTION IF EXISTS public.collections_overview();
CREATE FUNCTION public.collections_overview()
RETURNS TABLE (
  case_id             UUID,
  case_number         TEXT,
  assigned_advisor_id UUID,
  case_status         TEXT,
  fee_amount          NUMERIC,
  advance_agreed      BOOLEAN,
  collected           NUMERIC,
  expenses            NUMERIC,
  payment_count       BIGINT,
  last_payment_on     DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('view_collections') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.case_number,
    c.assigned_advisor_id,
    c.status,
    cf.fee_amount,
    COALESCE(cf.advance_agreed, FALSE),
    COALESCE(p.collected,  0)::numeric,
    COALESCE(e.expenses,   0)::numeric,
    COALESCE(p.payment_count, 0)::bigint,
    p.last_payment_on
  FROM public.cases c
  LEFT JOIN public.case_financials cf ON cf.case_id = c.id
  LEFT JOIN (
    SELECT case_id,
           SUM(amount)   AS collected,
           COUNT(*)      AS payment_count,
           MAX(paid_on)  AS last_payment_on
      FROM public.case_fee_payments
     WHERE deleted_at IS NULL
     GROUP BY case_id
  ) p ON p.case_id = c.id
  LEFT JOIN (
    SELECT case_id, SUM(amount) AS expenses
      FROM public.case_expenses
     WHERE deleted_at IS NULL
     GROUP BY case_id
  ) e ON e.case_id = c.id
  WHERE c.deleted_at  IS NULL
    AND c.is_archived = FALSE
    -- Only cases where there is something to collect:
    AND (
      COALESCE(cf.advance_agreed, FALSE) = TRUE   -- advance arranged
      OR COALESCE(e.expenses, 0) > 0              -- office expenses to bill
      OR c.status = 'execution'                   -- ביצוע — fee is due
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.collections_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collections_overview() TO authenticated;

INSERT INTO public.schema_version (version) VALUES (210) ON CONFLICT DO NOTHING;

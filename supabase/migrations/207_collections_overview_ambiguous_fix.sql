-- =============================================================================
-- Migration 207: fix collections_overview() — "column reference case_id is
-- ambiguous"
-- =============================================================================
-- The migration-206 body had unqualified `case_id` inside the two aggregate
-- subqueries (SELECT case_id ... GROUP BY case_id). In a plpgsql RETURNS TABLE
-- function the OUT column `case_id` is an in-scope variable, so Postgres can't
-- tell the column from the variable → every call RAISEs 42704-style ambiguity
-- at runtime. The global /collections dashboard's getCollectionsOverview()
-- swallows that error and returns [], so the page showed "no cases" + all zeros
-- even though cases exist. (A standalone SELECT works — the clash only exists
-- inside the function.)
--
-- Fix: alias the subquery tables and qualify every column reference. Body is
-- otherwise byte-identical to 206 (same auth gate, same shape, same grants).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.collections_overview()
RETURNS TABLE (
  case_id            UUID,
  case_number        TEXT,
  assigned_advisor_id UUID,
  fee_amount         NUMERIC,
  collected          NUMERIC,
  expenses           NUMERIC,
  payment_count      BIGINT,
  last_payment_on    DATE
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
    cf.fee_amount,
    COALESCE(p.collected, 0)::numeric,
    COALESCE(e.expenses, 0)::numeric,
    COALESCE(p.payment_count, 0)::bigint,
    p.last_payment_on
  FROM public.cases c
  LEFT JOIN public.case_financials cf ON cf.case_id = c.id
  LEFT JOIN (
    SELECT fp.case_id        AS cid,
           SUM(fp.amount)    AS collected,
           COUNT(*)          AS payment_count,
           MAX(fp.paid_on)   AS last_payment_on
      FROM public.case_fee_payments fp
     WHERE fp.deleted_at IS NULL
     GROUP BY fp.case_id
  ) p ON p.cid = c.id
  LEFT JOIN (
    SELECT ex.case_id     AS cid,
           SUM(ex.amount) AS expenses
      FROM public.case_expenses ex
     WHERE ex.deleted_at IS NULL
     GROUP BY ex.case_id
  ) e ON e.cid = c.id
  WHERE c.deleted_at IS NULL
    AND c.is_archived = FALSE;
END;
$fn$;

REVOKE ALL ON FUNCTION public.collections_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collections_overview() TO authenticated;

INSERT INTO public.schema_version (version) VALUES (207) ON CONFLICT DO NOTHING;

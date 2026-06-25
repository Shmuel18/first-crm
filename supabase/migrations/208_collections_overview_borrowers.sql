-- =============================================================================
-- Migration 208: collections_overview() returns borrower names
-- =============================================================================
-- The global /collections dashboard identifies each row by case number; the
-- office wants the borrowers' names instead. Add an aggregated `borrowers`
-- column (all borrowers on the case, primary first, comma-joined). It comes
-- through this SECURITY DEFINER RPC so a "ממונה גבייה" (view_collections without
-- broad case access) still sees who the payment is for — consistent with the
-- aggregate fee already exposed here. assigned_advisor_id stays in the result
-- (harmless) even though the UI drops the advisor column.
--
-- Body otherwise identical to migration 207 (same auth gate, same qualified
-- subqueries, same grants). DROP first — adding a column changes the return
-- type, which CREATE OR REPLACE can't do. Runs in the migration's transaction,
-- so there's no window where the function is missing.
-- =============================================================================
DROP FUNCTION IF EXISTS public.collections_overview();

CREATE OR REPLACE FUNCTION public.collections_overview()
RETURNS TABLE (
  case_id            UUID,
  case_number        TEXT,
  borrowers          TEXT,
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
    (
      SELECT STRING_AGG(
               TRIM(BOTH ' ' FROM b.first_name || ' ' || COALESCE(b.last_name, '')),
               ', ' ORDER BY cb.is_primary DESC, b.first_name
             )
        FROM public.case_borrowers cb
        JOIN public.borrowers b ON b.id = cb.borrower_id AND b.deleted_at IS NULL
       WHERE cb.case_id = c.id
    ) AS borrowers,
    c.assigned_advisor_id,
    cf.fee_amount,
    COALESCE(p.collected, 0)::numeric,
    COALESCE(e.expenses, 0)::numeric,
    COALESCE(p.payment_count, 0)::bigint,
    p.last_payment_on
  FROM public.cases c
  LEFT JOIN public.case_financials cf ON cf.case_id = c.id
  LEFT JOIN (
    SELECT fp.case_id      AS cid,
           SUM(fp.amount)  AS collected,
           COUNT(*)        AS payment_count,
           MAX(fp.paid_on) AS last_payment_on
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

INSERT INTO public.schema_version (version) VALUES (208) ON CONFLICT DO NOTHING;

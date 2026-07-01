-- =============================================================================
-- Migration 211: fix collections_overview() — status_id join + borrowers col
-- =============================================================================
-- Migration 210 introduced two bugs:
--   1. Used `c.status = 'execution'` — cases uses status_id (FK), not status.
--      The RPC compiled but failed at call time ("column status does not exist").
--   2. Dropped the `borrowers` column that migration 208 added (correlated
--      subquery aggregating borrower names per case).
-- This migration fixes both while preserving the 210 additions (advance_agreed,
-- case_status, WHERE filter for relevant-cases-only).
-- =============================================================================
DROP FUNCTION IF EXISTS public.collections_overview();

CREATE FUNCTION public.collections_overview()
RETURNS TABLE (
  case_id             UUID,
  case_number         TEXT,
  borrowers           TEXT,
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
    -- Borrower names, primary first (added mig 208, preserved here)
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
    cs.key AS case_status,
    cf.fee_amount,
    COALESCE(cf.advance_agreed, FALSE),
    COALESCE(p.collected,  0)::numeric,
    COALESCE(e.expenses,   0)::numeric,
    COALESCE(p.payment_count, 0)::bigint,
    p.last_payment_on
  FROM public.cases c
  LEFT JOIN public.case_statuses cs ON cs.id = c.status_id
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
  WHERE c.deleted_at  IS NULL
    AND c.is_archived = FALSE
    AND (
      COALESCE(cf.advance_agreed, FALSE) = TRUE
      OR COALESCE(e.expenses,     0)     > 0
      OR cs.key = 'execution'
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.collections_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collections_overview() TO authenticated;

INSERT INTO public.schema_version (version) VALUES (211) ON CONFLICT DO NOTHING;

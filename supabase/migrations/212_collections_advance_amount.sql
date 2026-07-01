-- =============================================================================
-- Migration 212: case_financials.advance_amount — replaces boolean advance_agreed
-- =============================================================================
-- Migration 210 added advance_agreed (boolean). This replaces the UX with a
-- numeric amount field: advance_amount > 0 means the advance was agreed AND
-- indicates how much. advance_agreed is kept for backward compatibility but
-- is now derived (set in tandem by the TS action).
-- =============================================================================
ALTER TABLE public.case_financials
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(15, 2);

-- Refresh collections_overview() to return advance_amount + filter on it.
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
  advance_amount      NUMERIC,
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
    cf.advance_amount,
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
      COALESCE(cf.advance_amount, 0) > 0
      OR COALESCE(e.expenses,     0) > 0
      OR cs.key = 'execution'
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.collections_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collections_overview() TO authenticated;

INSERT INTO public.schema_version (version) VALUES (212) ON CONFLICT DO NOTHING;

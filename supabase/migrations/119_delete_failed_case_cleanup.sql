-- =============================================================================
-- Migration 119: delete_failed_case — compensating cleanup for create-case (DB-3)
-- =============================================================================
-- createCaseAction (features/cases/actions/create-case.ts) inserts the case row
-- (PostgREST, which applies all column defaults), THEN upserts case_financials
-- in a SEPARATE request. If the financials write fails after the case row has
-- committed, the case is left orphaned (no financials) and a user retry creates
-- a DUPLICATE case (no idempotency on create).
--
-- A true single-transaction RPC was considered, but the existing
-- create_case_with_financials (migration 055) is STALE — it lists 9 case columns
-- while CaseFormShape now has 17, so using it would silently drop 8 fields on
-- create. A fresh atomic RPC would have to enumerate every case column and would
-- drift again. Instead, this keeps the proven PostgREST insert and adds a
-- compensating cleanup: on a financials failure the action removes the orphan,
-- so the retry creates exactly one clean case. Same user-facing guarantee
-- (no orphan, no duplicate), future-proof (no column list to maintain).
--
-- SECURITY DEFINER so it can hard-delete despite the caller possibly lacking
-- delete_case — but the WHERE clause makes it safe: it removes ONLY a case that
-- is the caller's own, was created in the last 10 minutes, and has NO borrowers
-- and NO financials (i.e. a genuine just-failed create, never a real case).
--
-- NOTE: migration 055's create_case_with_financials + save_borrower_for_case are
-- dead/stale; consider dropping them in a follow-up to remove the footgun.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_failed_case(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_deleted BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'delete_failed_case: no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'delete_failed_case: missing create_case permission' USING ERRCODE = '42501';
  END IF;

  -- Remove only a genuine just-failed-create orphan: caller's own, very recent,
  -- and with no borrowers and no financials. A real case fails at least one.
  DELETE FROM public.cases c
   WHERE c.id = p_case_id
     AND c.created_by = v_actor
     AND c.created_at > now() - interval '10 minutes'
     AND NOT EXISTS (SELECT 1 FROM public.case_borrowers cb WHERE cb.case_id = c.id)
     AND NOT EXISTS (SELECT 1 FROM public.case_financials cf WHERE cf.case_id = c.id);

  v_deleted := FOUND;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_failed_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_failed_case(UUID) TO authenticated;

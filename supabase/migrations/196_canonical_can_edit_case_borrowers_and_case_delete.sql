-- =============================================================================
-- Migration 196: canonicalize case_borrowers writes + soft_delete_case on
--                public.can_edit_case (Theme A-2 — closes the R17/R18 sweep gaps)
-- =============================================================================
-- The R8-R11 canonicalization (migs 190/192/195) repointed borrower/income/
-- obligation/bank/expense/document/scenario writes at can_edit_case, but the
-- Round 17/18 DB review found two case-scoped write paths still on the LEGACY
-- guard ("has_permission('edit_any_case') OR (edit_own_case AND assigned_advisor_id
-- = auth.uid())", which excludes associated advisors, migs 146/147):
--   * case_borrowers UPDATE/DELETE RLS (mig 024) — updateBorrowerRoleAction +
--     removeBorrowerFromCaseAction do DIRECT writes gated by these policies, so an
--     associated advisor (admitted by the action's userCanEditCase) hits a 0-row
--     RLS no-match and gets a false 'unauthorized' / 'not_found' (AUTH-01).
--   * soft_delete_case RPC (mig 077) — recycle-bin delete returns FALSE for an
--     associated advisor who holds delete_case, so the delete silently no-ops (RPC-1).
--
-- Fix: repoint both at can_edit_case (a SUPERSET of the legacy check — only WIDENS
-- to associated advisors, never grants a user who lacked edit authority). case_borrowers
-- INSERT canonicalized too for symmetry (it's RPC-only in practice — SECURITY DEFINER
-- RPCs bypass RLS — so harmless). soft_delete_case keeps its delete_case gate and
-- still RETURNs FALSE on no-authority (preserves the action's 'unauthorized' contract,
-- so can_edit_case boolean is used, NOT the raising _assert_*). Idempotent. Deps: 024, 077, 147.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. case_borrowers INSERT / UPDATE / DELETE  (was mig 024)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "case_borrowers_insert" ON public.case_borrowers;
CREATE POLICY "case_borrowers_insert" ON public.case_borrowers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_case(case_id));

DROP POLICY IF EXISTS "case_borrowers_update" ON public.case_borrowers;
CREATE POLICY "case_borrowers_update" ON public.case_borrowers
  FOR UPDATE TO authenticated
  USING (public.can_edit_case(case_id))
  WITH CHECK (public.can_edit_case(case_id));

DROP POLICY IF EXISTS "case_borrowers_delete" ON public.case_borrowers;
CREATE POLICY "case_borrowers_delete" ON public.case_borrowers
  FOR DELETE TO authenticated
  USING (public.can_edit_case(case_id));

-- -----------------------------------------------------------------------------
-- 2. soft_delete_case RPC  (was mig 077) — canonical guard, same FALSE-on-deny contract
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_case(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission('delete_case') THEN
    RAISE EXCEPTION 'missing delete_case permission' USING ERRCODE = '42501';
  END IF;

  -- Canonical case-edit guard (admin / responsible / associated advisor). Returns
  -- FALSE (not RAISE) so delete-case.ts keeps surfacing 'unauthorized' unchanged.
  IF NOT public.can_edit_case(p_case_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.cases
     SET deleted_at = now(),
         updated_by = v_actor
   WHERE id = p_case_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

INSERT INTO public.schema_version (version) VALUES (196) ON CONFLICT DO NOTHING;

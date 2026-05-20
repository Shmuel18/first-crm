-- =============================================================================
-- Migration 039: make child-table read access explicitly case-scoped
-- =============================================================================
-- Audit finding F1 (defense-in-depth).
--
-- The SELECT policies on borrowers / borrower_incomes / borrower_obligations /
-- documents / case_banks / case_borrowers / stage_durations only checked that
-- the parent case row EXISTS (and is not soft-deleted). They were scoped to the
-- caller's cases ONLY because the nested `SELECT ... FROM public.cases` re-applied
-- the cases_select policy transitively. That is correct today, but it is implicit
-- and fragile: any future change that loosens cases_select (or a SECURITY DEFINER
-- view over cases) would silently turn these into a mass PII / financial leak.
--
-- This migration introduces public.can_view_case(uuid), which RE-STATES the
-- cases_select scope explicitly, and rewrites each child SELECT policy to use it.
--
-- SAFETY: the helper ANDs the explicit scope onto the same `EXISTS(cases ...)`
-- check, so each policy can only ever match the SAME rows or FEWER than before —
-- it cannot widen access. The function is SECURITY INVOKER, so cases RLS still
-- applies on top as a backstop.
--
-- !!! REQUIRES VERIFICATION ON A NON-PROD DATABASE BEFORE DEPLOY !!!
-- Run the two-advisor IDOR test: as advisor B (view_own_cases only), confirm
-- SELECT on borrowers / case_borrowers / case_banks / documents returns ZERO
-- rows belonging to advisor A's cases, and that advisor B still sees their own.

-- -----------------------------------------------------------------------------
-- Canonical "can the current user read this case?" — mirrors cases_select (011).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_case(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.id = p_case_id
      AND c.deleted_at IS NULL
      AND (
        public.has_permission('view_all_cases')
        OR (public.has_permission('view_own_cases') AND c.assigned_advisor_id = auth.uid())
        OR (c.is_archived = TRUE AND public.has_permission('view_archived_cases'))
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- case_borrowers (was 024) / case_banks (was 022)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "case_borrowers_select" ON public.case_borrowers;
CREATE POLICY "case_borrowers_select" ON public.case_borrowers
  FOR SELECT TO authenticated
  USING (public.can_view_case(case_id));

DROP POLICY IF EXISTS "case_banks_select" ON public.case_banks;
CREATE POLICY "case_banks_select" ON public.case_banks
  FOR SELECT TO authenticated
  USING (public.can_view_case(case_id));

-- -----------------------------------------------------------------------------
-- borrowers (was 011) — visible if linked to a case the caller can view
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "borrowers_select" ON public.borrowers;
CREATE POLICY "borrowers_select" ON public.borrowers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.case_borrowers cb
      WHERE cb.borrower_id = borrowers.id
        AND public.can_view_case(cb.case_id)
    )
  );

-- -----------------------------------------------------------------------------
-- borrower_incomes / borrower_obligations (was 011) — permission + case access
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "incomes_select" ON public.borrower_incomes;
CREATE POLICY "incomes_select" ON public.borrower_incomes
  FOR SELECT TO authenticated
  USING (
    public.has_permission('view_case_incomes')
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_view_case(cb.case_id)
    )
  );

DROP POLICY IF EXISTS "obligations_select" ON public.borrower_obligations;
CREATE POLICY "obligations_select" ON public.borrower_obligations
  FOR SELECT TO authenticated
  USING (
    public.has_permission('view_case_obligations')
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_view_case(cb.case_id)
    )
  );

-- -----------------------------------------------------------------------------
-- documents (was 011) — permission + case access
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('view_case_documents')
    AND public.can_view_case(case_id)
  );

-- -----------------------------------------------------------------------------
-- stage_durations (was 011) — case progress timing
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "stage_durations_select" ON public.stage_durations;
CREATE POLICY "stage_durations_select" ON public.stage_durations
  FOR SELECT TO authenticated
  USING (public.can_view_case(case_id));

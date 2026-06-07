-- =============================================================================
-- Migration 147: extend case VIEW + EDIT access to associated advisors
-- =============================================================================
-- Builds on 146. Everywhere a case is gated on "responsible advisor = me"
-- (assigned_advisor_id = auth.uid()) we now ALSO allow "associated advisor = me"
-- (public.is_case_associated_advisor). Touched in one place each:
--   * cases_select        (read policy, mig 011)
--   * cases_update        (edit policy, mig 011)
--   * can_view_case()     (child-table read helper, mig 039 → all child tables)
--   * can_edit_case()     (child-table edit helper, mig 106)
--   * _assert_can_edit_case() (RPC edit guard, mig 099)
--
-- SAFE BY CONSTRUCTION: every change only ADDS an OR-branch, widening access. No
-- existing clause is removed or tightened, so a regression here can at most fail
-- to grant the associated advisor — it can never lock out responsible / admin /
-- view_all users. Reproduces each definition verbatim from its source migration
-- with the single associated-advisor branch added.
--
-- Idempotent (DROP+CREATE policy / CREATE OR REPLACE function). Deps: 146.
-- =============================================================================

-- --- cases read: own = responsible OR associated --------------------------------
DROP POLICY IF EXISTS "cases_select" ON public.cases;
CREATE POLICY "cases_select" ON public.cases FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('view_all_cases')
      OR (
        public.has_permission('view_own_cases')
        AND (assigned_advisor_id = auth.uid() OR public.is_case_associated_advisor(id))
      )
      OR (is_archived = TRUE AND public.has_permission('view_archived_cases'))
    )
  );

-- --- cases edit: own = responsible OR associated --------------------------------
DROP POLICY IF EXISTS "cases_update" ON public.cases;
CREATE POLICY "cases_update" ON public.cases FOR UPDATE TO authenticated
  USING (
    public.has_permission('edit_any_case')
    OR (
      public.has_permission('edit_own_case')
      AND (assigned_advisor_id = auth.uid() OR public.is_case_associated_advisor(id))
    )
  )
  WITH CHECK (
    public.has_permission('edit_any_case')
    OR (
      public.has_permission('edit_own_case')
      AND (assigned_advisor_id = auth.uid() OR public.is_case_associated_advisor(id))
    )
  );

-- --- child-table read helper (mig 039): propagates to documents / incomes /
--     obligations / expenses / banks / comments / checklist / scenarios / storage
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
        OR (
          public.has_permission('view_own_cases')
          AND (c.assigned_advisor_id = auth.uid() OR public.is_case_associated_advisor(c.id))
        )
        OR (c.is_archived = TRUE AND public.has_permission('view_archived_cases'))
      )
  );
$$;

-- --- child-table edit helper (mig 106) -----------------------------------------
CREATE OR REPLACE FUNCTION public.can_edit_case(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.cases c
     WHERE c.id = p_case_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (
           public.has_permission('edit_own_case')
           AND (c.assigned_advisor_id = auth.uid() OR public.is_case_associated_advisor(c.id))
         )
       )
  );
$$;

-- --- RPC edit guard (mig 099) --------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_can_edit_case(p_case_id UUID)
RETURNS VOID
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
  IF NOT EXISTS (
    SELECT 1 FROM public.cases c
     WHERE c.id = p_case_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (
           public.has_permission('edit_own_case')
           AND (c.assigned_advisor_id = v_actor OR public.is_case_associated_advisor(c.id))
         )
       )
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this case' USING ERRCODE = '42501';
  END IF;
END;
$fn$;

INSERT INTO public.schema_version (version) VALUES (147) ON CONFLICT DO NOTHING;

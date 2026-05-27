-- =============================================================================
-- Migration 081: case_expenses table + soft-delete RPC
-- =============================================================================
-- New section in the admin block tracks office-side expenses per case:
-- date + amount + free-text description. The intent is light bookkeeping —
-- "I paid the appraiser 1,200 ₪ on the 15th" — not full accounting. So:
--   - 3 user-visible columns (date / amount / description)
--   - amount is NUMERIC(15,2) like other money columns
--   - description is plain TEXT (no rich-text), capped at 1000 chars
--     via the UI (no DB constraint to keep imports flexible)
--
-- Follows the same soft-delete pattern as borrower_incomes /
-- borrower_obligations (migration 076): no physical DELETE allowed, the
-- soft_delete_case_expense RPC flips deleted_at + deleted_by.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  expense_date  DATE,
  amount        NUMERIC(15, 2),
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES public.profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES public.profiles(id),
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_case_expenses_case
  ON public.case_expenses(case_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_case_expenses_updated_at
  BEFORE UPDATE ON public.case_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_expenses ENABLE ROW LEVEL SECURITY;

-- SELECT — anyone who can view the parent case AND row isn't soft-deleted.
DROP POLICY IF EXISTS "case_expenses_select" ON public.case_expenses;
CREATE POLICY "case_expenses_select" ON public.case_expenses
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_expenses.case_id
         AND c.deleted_at IS NULL
         AND public.can_view_case(c.id)
    )
  );

-- INSERT — anyone who can edit the parent case. WITH CHECK gates the new
-- row (must be associated to a case the actor controls and not already
-- soft-deleted at creation time).
DROP POLICY IF EXISTS "case_expenses_insert" ON public.case_expenses;
CREATE POLICY "case_expenses_insert" ON public.case_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_expenses.case_id
         AND c.deleted_at IS NULL
         AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

-- UPDATE — both sides of the policy check edit permission. Same shape as
-- obligations_update in migration 076.
DROP POLICY IF EXISTS "case_expenses_update" ON public.case_expenses;
CREATE POLICY "case_expenses_update" ON public.case_expenses
  FOR UPDATE TO authenticated
  USING (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_expenses.case_id
         AND c.deleted_at IS NULL
         AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  )
  WITH CHECK (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_expenses.case_id
         AND c.deleted_at IS NULL
         AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

-- No DELETE policy — soft-delete only via the RPC below.

CREATE OR REPLACE FUNCTION public.soft_delete_case_expense(
  p_case_id    UUID,
  p_expense_id UUID
)
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

  IF NOT EXISTS (
    SELECT 1
      FROM public.case_expenses e
      JOIN public.cases c ON c.id = e.case_id
     WHERE e.id = p_expense_id
       AND e.case_id = p_case_id
       AND e.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = v_actor)
       )
  ) THEN
    RAISE EXCEPTION 'not authorized for this case expense' USING ERRCODE = '42501';
  END IF;

  UPDATE public.case_expenses
     SET deleted_at = now(),
         deleted_by = v_actor,
         updated_by = v_actor
   WHERE id = p_expense_id
     AND case_id = p_case_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_case_expense(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_case_expense(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.case_expenses IS
  'Office-side expenses incurred while handling a case (appraisal fees, courier, etc.). Light bookkeeping — see migration 081.';

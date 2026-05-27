-- =============================================================================
-- Migration 078: borrower financial soft-delete RPCs
-- =============================================================================
-- Direct PostgREST UPDATE on borrower_incomes / borrower_obligations is easy
-- to trip with RLS edge cases. These SECURITY DEFINER RPCs keep the operation
-- narrow: explicit case id, row id, permission check, borrower-on-case check,
-- then a soft-delete update.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_borrower_income(
  p_case_id UUID,
  p_income_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_borrower_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  SELECT borrower_id INTO v_borrower_id
    FROM public.borrower_incomes
   WHERE id = p_income_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.case_borrowers cb
      JOIN public.cases c ON c.id = cb.case_id
     WHERE cb.case_id = p_case_id
       AND cb.borrower_id = v_borrower_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = v_actor)
       )
  ) THEN
    RAISE EXCEPTION 'not authorized for this case income' USING ERRCODE = '42501';
  END IF;

  UPDATE public.borrower_incomes
     SET deleted_at = now(),
         deleted_by = v_actor,
         updated_by = v_actor
   WHERE id = p_income_id
     AND borrower_id = v_borrower_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.soft_delete_borrower_obligation(
  p_case_id UUID,
  p_obligation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_borrower_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  SELECT borrower_id INTO v_borrower_id
    FROM public.borrower_obligations
   WHERE id = p_obligation_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.case_borrowers cb
      JOIN public.cases c ON c.id = cb.case_id
     WHERE cb.case_id = p_case_id
       AND cb.borrower_id = v_borrower_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = v_actor)
       )
  ) THEN
    RAISE EXCEPTION 'not authorized for this case obligation' USING ERRCODE = '42501';
  END IF;

  UPDATE public.borrower_obligations
     SET deleted_at = now(),
         deleted_by = v_actor,
         updated_by = v_actor
   WHERE id = p_obligation_id
     AND borrower_id = v_borrower_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_borrower_income(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_borrower_obligation(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.soft_delete_borrower_income(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_borrower_obligation(UUID, UUID) TO authenticated;

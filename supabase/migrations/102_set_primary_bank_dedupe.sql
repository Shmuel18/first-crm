-- =============================================================================
-- Migration 102: set_primary_bank robust against duplicate (case_id, bank_id)
-- =============================================================================
-- Symptom: "השמירה נכשלה" on the dashboard bank cell; prod logs showed
--   [setPrimaryBank] rpc failed { code: '23505' }  (uq_case_banks_active).
--
-- Root cause: addCaseBankAction INSERTed a fresh row when a bank that had been
-- soft-deleted was re-added, leaving TWO rows for the same (case_id, bank_id) —
-- one active, one soft-deleted. The reactivate UPDATE in set_primary_bank
-- (migration 041) matched BOTH and flipped both to deleted_at = NULL, producing
-- two active rows → uq_case_banks_active violation (23505).
--
-- Fix here: (a) one-time cleanup of the orphan duplicates, and (b) make the RPC
-- delete any soft-deleted duplicate link BEFORE the reactivate so it can never
-- create two active rows. addCaseBankAction is fixed separately (TS) to
-- reactivate instead of insert, closing the source of new duplicates.
-- =============================================================================

-- (a) One-time cleanup: drop soft-deleted links that duplicate an active link
--     for the same (case_id, bank_id) — exactly the orphans that trip 23505.
DELETE FROM public.case_banks d
WHERE d.deleted_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.case_banks a
     WHERE a.case_id = d.case_id
       AND a.bank_id = d.bank_id
       AND a.deleted_at IS NULL
  );

-- (b) Robust RPC: clear primary → drop soft-deleted dup links → reactivate/insert.
CREATE OR REPLACE FUNCTION public.set_primary_bank(
  p_case_id UUID,
  p_bank_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Clear any current primary
  UPDATE public.case_banks
    SET is_primary = FALSE,
        updated_by = p_user_id
    WHERE case_id = p_case_id AND is_primary = TRUE;

  IF p_bank_id IS NULL THEN
    RETURN;
  END IF;

  -- Remove any soft-deleted duplicate link for this (case, bank) so the
  -- reactivate below can never produce two active rows (the 23505 cause).
  DELETE FROM public.case_banks
    WHERE case_id = p_case_id AND bank_id = p_bank_id AND deleted_at IS NOT NULL;

  -- Reactivate + promote the (now single) link, or insert a fresh one.
  UPDATE public.case_banks
    SET is_primary = TRUE,
        deleted_at = NULL,
        updated_by = p_user_id
    WHERE case_id = p_case_id AND bank_id = p_bank_id;

  IF NOT FOUND THEN
    INSERT INTO public.case_banks (case_id, bank_id, is_primary, created_by, updated_by)
    VALUES (p_case_id, p_bank_id, TRUE, p_user_id, p_user_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_primary_bank(UUID, UUID, UUID) TO authenticated;

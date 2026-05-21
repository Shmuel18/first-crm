-- =============================================================================
-- Migration 041: set_primary_bank must not leave a soft-deleted row primary
-- =============================================================================
-- The "update existing" UPDATE matched (case_id, bank_id) with no deleted_at
-- filter, so re-selecting a previously-removed bank flipped is_primary=TRUE on a
-- row whose deleted_at was still set — a deleted-but-primary orphan.
--
-- Fix: when the bank row already exists (active OR soft-deleted), REACTIVATE it
-- (clear deleted_at) and make it primary. This both removes the orphan and
-- avoids colliding with the partial unique index on (case_id, bank_id) that a
-- fresh INSERT would hit. A bank never linked before still inserts.

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

  -- Reactivate + set primary if the link exists (active or soft-deleted)
  UPDATE public.case_banks
    SET is_primary = TRUE,
        deleted_at = NULL,
        updated_by = p_user_id
    WHERE case_id = p_case_id AND bank_id = p_bank_id;

  -- Otherwise create it
  IF NOT FOUND THEN
    INSERT INTO public.case_banks (case_id, bank_id, is_primary, created_by, updated_by)
    VALUES (p_case_id, p_bank_id, TRUE, p_user_id, p_user_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_primary_bank(UUID, UUID, UUID) TO authenticated;

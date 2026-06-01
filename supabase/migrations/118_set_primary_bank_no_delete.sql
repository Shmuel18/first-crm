-- =============================================================================
-- Migration 103: set_primary_bank without DELETE under SECURITY INVOKER
-- =============================================================================
-- Migration 102 made the RPC robust against duplicate active/soft-deleted bank
-- links by deleting the soft-deleted duplicate before reactivation. That is not
-- compatible with the app's no-hard-delete posture and can fail for normal
-- authenticated users because case_banks intentionally has no DELETE policy.
--
-- This version keeps SECURITY INVOKER + RLS, performs no DELETE, and updates
-- exactly one row:
--   1. if an active link already exists, promote that row.
--   2. otherwise reactivate a single soft-deleted link.
--   3. otherwise insert a new link.
-- Soft-deleted duplicates may remain soft-deleted; they do not violate the
-- active partial unique index and no longer get reactivated together.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_primary_bank(
  p_case_id UUID,
  p_bank_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  target_id UUID;
BEGIN
  -- Clear current active primary rows only. Soft-deleted rows should stay
  -- invisible and untouched.
  UPDATE public.case_banks
    SET is_primary = FALSE,
        updated_by = p_user_id
    WHERE case_id = p_case_id
      AND is_primary = TRUE
      AND deleted_at IS NULL;

  IF p_bank_id IS NULL THEN
    RETURN;
  END IF;

  -- Prefer an existing active link. This avoids touching any soft-deleted
  -- duplicate and cannot trip uq_case_banks_active.
  SELECT id INTO target_id
    FROM public.case_banks
   WHERE case_id = p_case_id
     AND bank_id = p_bank_id
     AND deleted_at IS NULL
   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
   LIMIT 1;

  IF target_id IS NOT NULL THEN
    UPDATE public.case_banks
      SET is_primary = TRUE,
          updated_by = p_user_id
      WHERE id = target_id;
    RETURN;
  END IF;

  -- No active link exists. Reactivate one soft-deleted link if present.
  SELECT id INTO target_id
    FROM public.case_banks
   WHERE case_id = p_case_id
     AND bank_id = p_bank_id
     AND deleted_at IS NOT NULL
   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
   LIMIT 1;

  IF target_id IS NOT NULL THEN
    UPDATE public.case_banks
      SET is_primary = TRUE,
          deleted_at = NULL,
          updated_by = p_user_id
      WHERE id = target_id;
    RETURN;
  END IF;

  INSERT INTO public.case_banks (case_id, bank_id, is_primary, created_by, updated_by)
  VALUES (p_case_id, p_bank_id, TRUE, p_user_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_primary_bank(UUID, UUID, UUID) TO authenticated;

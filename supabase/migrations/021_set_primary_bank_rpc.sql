-- =============================================================================
-- Migration 021: set_primary_bank RPC (transaction-safe primary swap)
-- =============================================================================
-- Purpose: setPrimaryBankAction previously did two separate UPDATE/INSERT calls
--          with a window between them where the case had no primary bank. A
--          concurrent reader could see the inconsistent state, and a failure
--          mid-flight left the case without a primary at all (silent).
--
-- This RPC performs both operations in a single statement (atomic per Postgres
-- function semantics) so the case always has exactly the right primary.
-- Dependencies: 006_cases.sql (cases + case_banks), 011_rls_policies.sql
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
BEGIN
  -- Clear existing primary
  UPDATE public.case_banks
    SET is_primary = FALSE,
        updated_by = p_user_id
    WHERE case_id = p_case_id AND is_primary = TRUE;

  -- Nothing to set, we're done
  IF p_bank_id IS NULL THEN
    RETURN;
  END IF;

  -- Try update first (bank already linked to case)
  UPDATE public.case_banks
    SET is_primary = TRUE,
        updated_by = p_user_id
    WHERE case_id = p_case_id AND bank_id = p_bank_id;

  -- If no row was updated, insert
  IF NOT FOUND THEN
    INSERT INTO public.case_banks (case_id, bank_id, is_primary, created_by, updated_by)
    VALUES (p_case_id, p_bank_id, TRUE, p_user_id, p_user_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_primary_bank(UUID, UUID, UUID) TO authenticated;

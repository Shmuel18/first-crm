-- =============================================================================
-- Migration 055: Transactional save_borrower_for_case + create_case_with_financials
-- =============================================================================
-- The TS-side save flow (borrowers.service.ts saveBorrowerForCase, and
-- cases.actions.create-case + the financials upsert) runs 2-3 separate
-- statements with no transaction boundary. Partial failures produce:
--   - Orphan borrower rows (INSERT succeeded, junction failed)
--   - Diverging primary borrower (junction says one, cases.primary_borrower_id
--     points to another)
--   - Cases without financials (case INSERTed, fees RPC failed)
--
-- Two RPCs wrap each flow atomically. The TS callers swap their multi-step
-- flow for a single supabase.rpc(...) call once these are applied. Wrapping
-- with SECURITY INVOKER preserves the existing RLS posture.
--
-- These RPCs are written to coexist with the current TS code — the existing
-- callsites still work until you flip them to use these RPCs in a follow-up
-- code change.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- save_borrower_for_case: upsert a borrower + link it to the case + (optional)
-- promote it to primary. Atomic. Replaces the 2-3 separate statements in
-- features/borrowers/services/borrowers.service.ts saveBorrowerForCase.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_borrower_for_case(
  p_case_id UUID,
  p_borrower_id UUID,            -- NULL = create new; non-null = update existing
  p_first_name TEXT,
  p_last_name TEXT,
  p_national_id TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_birth_date DATE,
  p_is_primary BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_borrower_id UUID;
  v_actor UUID := auth.uid();
BEGIN
  IF p_case_id IS NULL THEN
    RAISE EXCEPTION 'save_borrower_for_case: p_case_id is required';
  END IF;

  IF p_borrower_id IS NULL THEN
    -- New borrower. Prefer an existing row with the same national_id over
    -- creating a duplicate (matches the 053 unique constraint intent).
    IF p_national_id IS NOT NULL THEN
      SELECT id INTO v_borrower_id
        FROM public.borrowers
       WHERE national_id = p_national_id AND deleted_at IS NULL
       LIMIT 1;
    END IF;
    IF v_borrower_id IS NULL THEN
      INSERT INTO public.borrowers (
        first_name, last_name, national_id, phone, email, birth_date,
        created_by, updated_by
      ) VALUES (
        p_first_name, p_last_name, p_national_id, p_phone, p_email, p_birth_date,
        v_actor, v_actor
      )
      RETURNING id INTO v_borrower_id;
    ELSE
      -- Reusing an existing borrower — refresh contact fields (the lead may
      -- have a fresher phone/email than the historical record).
      UPDATE public.borrowers
         SET first_name = COALESCE(p_first_name, first_name),
             last_name = COALESCE(p_last_name, last_name),
             phone = COALESCE(p_phone, phone),
             email = COALESCE(p_email, email),
             birth_date = COALESCE(p_birth_date, birth_date),
             updated_by = v_actor
       WHERE id = v_borrower_id;
    END IF;
  ELSE
    -- Update existing.
    v_borrower_id := p_borrower_id;
    UPDATE public.borrowers
       SET first_name = p_first_name,
           last_name = p_last_name,
           national_id = p_national_id,
           phone = p_phone,
           email = p_email,
           birth_date = p_birth_date,
           updated_by = v_actor
     WHERE id = v_borrower_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'save_borrower_for_case: borrower % not found or deleted', v_borrower_id;
    END IF;
  END IF;

  -- Link to the case (idempotent: ON CONFLICT keeps existing is_primary
  -- unless we're explicitly promoting).
  INSERT INTO public.case_borrowers (case_id, borrower_id, is_primary)
  VALUES (p_case_id, v_borrower_id, COALESCE(p_is_primary, FALSE))
  ON CONFLICT (case_id, borrower_id) DO UPDATE
    SET is_primary = COALESCE(EXCLUDED.is_primary, public.case_borrowers.is_primary);

  -- When promoting to primary, demote everyone else on the same case. The
  -- partial UNIQUE index (uq_case_borrowers_one_primary, migration 024)
  -- would otherwise raise on the INSERT — race-safe because we're inside
  -- the implicit transaction of the function.
  IF p_is_primary THEN
    UPDATE public.case_borrowers
       SET is_primary = FALSE
     WHERE case_id = p_case_id
       AND borrower_id <> v_borrower_id
       AND is_primary = TRUE;

    UPDATE public.cases
       SET primary_borrower_id = v_borrower_id,
           updated_by = v_actor
     WHERE id = p_case_id;
  END IF;

  RETURN v_borrower_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_borrower_for_case(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- create_case_with_financials: case INSERT + financials upsert in one txn.
-- Replaces the two-step flow in features/cases/actions/create-case.ts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_case_with_financials(
  p_status_id UUID,
  p_assigned_advisor_id UUID,
  p_case_type_primary_id UUID,
  p_case_type_secondary_id UUID,
  p_property_value NUMERIC,
  p_equity NUMERIC,
  p_requested_mortgage_amount NUMERIC,
  p_request_details TEXT,
  p_referrer_name TEXT,
  p_fee_amount NUMERIC,
  p_expected_income NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_case_id UUID;
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'create_case_with_financials: no auth context';
  END IF;

  INSERT INTO public.cases (
    status_id, assigned_advisor_id, case_type_primary_id, case_type_secondary_id,
    property_value, equity, requested_mortgage_amount,
    request_details, referrer_name,
    created_by, updated_by
  ) VALUES (
    p_status_id, p_assigned_advisor_id, p_case_type_primary_id, p_case_type_secondary_id,
    p_property_value, p_equity, p_requested_mortgage_amount,
    p_request_details, p_referrer_name,
    v_actor, v_actor
  )
  RETURNING id INTO v_case_id;

  -- Manager-only fields. RLS on case_financials gates whether the caller
  -- can see them; the INSERT runs as the caller (SECURITY INVOKER) so a
  -- non-manager trying to set fee_amount gets rejected naturally.
  IF p_fee_amount IS NOT NULL OR p_expected_income IS NOT NULL THEN
    INSERT INTO public.case_financials (case_id, fee_amount, expected_income)
    VALUES (v_case_id, p_fee_amount, p_expected_income);
  END IF;

  RETURN v_case_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_case_with_financials(
  UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC
) TO authenticated;

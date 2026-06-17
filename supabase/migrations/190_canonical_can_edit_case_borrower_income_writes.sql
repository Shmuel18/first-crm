-- =============================================================================
-- Migration 190: canonicalize borrower + income/obligation write authorization
--                on public.can_edit_case / public._assert_can_edit_case (R8)
-- =============================================================================
-- Round-8 review found the DB write-authorization for borrower + financial rows
-- still used the LEGACY check `assigned_advisor_id = auth.uid() OR edit_any_case`
-- (migrations 064/065/076/078/123). That predates associated advisors (mig 146/147),
-- so it:
--   1. EXCLUDES an associated advisor who legitimately has can_edit_case, and
--   2. is NOT the single canonical guard, so each path can drift.
--
-- Worse, the inline "+ add borrower" path (addEmptyBorrowerAction) did a DIRECT
-- INSERT into public.borrowers, which borrowers_modify (mig 064) restricts to
-- edit_any_case — so a non-admin advisor on their OWN case was blocked at the DB
-- (broken core flow). This migration:
--   * Re-points update_borrower_in_case + save_borrower_for_case_full +
--     soft_delete_borrower_income/obligation at _assert_can_edit_case.
--   * Adds add_empty_borrower_to_case(): an ATOMIC SECURITY DEFINER RPC so the
--     borrower row + junction + primary sync commit or roll back together, and
--     non-admin advisors (incl. associated) can add a borrower to a case they
--     can edit (replaces the 3-statement direct-write TS flow).
--   * Re-points the borrower_incomes / borrower_obligations INSERT+UPDATE RLS
--     policies at public.can_edit_case (so associated advisors can edit income/
--     obligations consistently with the rest of the case).
--
-- SAFE BY CONSTRUCTION: can_edit_case / _assert_can_edit_case are a SUPERSET of
-- the legacy check (edit_any_case OR (edit_own_case AND (assigned OR associated))),
-- so this only WIDENS to associated advisors + admins/responsible exactly as
-- before — it never grants a user who lacked edit authority. Idempotent
-- (CREATE OR REPLACE / DROP+CREATE POLICY). Deps: 064, 065, 076, 078, 123, 147.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. update_borrower_in_case — canonical guard (was mig 076)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_borrower_in_case(
  p_case_id UUID,
  p_borrower_id UUID,
  p_patch JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_safe_patch JSONB;
  v_current public.borrowers%ROWTYPE;
  v_next public.borrowers%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- Canonical case-edit guard (edit_any OR edit_own AND assigned/associated).
  PERFORM public._assert_can_edit_case(p_case_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.case_borrowers
     WHERE case_id = p_case_id AND borrower_id = p_borrower_id
  ) THEN
    RAISE EXCEPTION 'borrower not on this case' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current
    FROM public.borrowers
   WHERE id = p_borrower_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'borrower % not found or deleted', p_borrower_id USING ERRCODE = 'P0002';
  END IF;

  v_safe_patch := p_patch
    - 'id' - 'created_at' - 'created_by' - 'updated_at' - 'updated_by' - 'deleted_at'
    - 'metadata';

  IF jsonb_typeof(v_safe_patch) <> 'object' OR v_safe_patch = '{}'::jsonb THEN
    RETURN FALSE;
  END IF;

  v_safe_patch := v_safe_patch
    || jsonb_build_object(
         'updated_by', v_actor::text,
         'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MSOF')
       );

  v_next := jsonb_populate_record(v_current, v_safe_patch);

  UPDATE public.borrowers
     SET first_name = v_next.first_name,
         last_name = v_next.last_name,
         national_id = v_next.national_id,
         id_issue_date = v_next.id_issue_date,
         id_expiry_date = v_next.id_expiry_date,
         birth_date = v_next.birth_date,
         gender = v_next.gender,
         marital_status = v_next.marital_status,
         children_count = v_next.children_count,
         citizenship = v_next.citizenship,
         additional_citizenships = v_next.additional_citizenships,
         residency_type = v_next.residency_type,
         preferred_language = v_next.preferred_language,
         phone = v_next.phone,
         landline_phone = v_next.landline_phone,
         email = v_next.email,
         address = v_next.address,
         city = v_next.city,
         employment_status = v_next.employment_status,
         employer_name = v_next.employer_name,
         credit_rating = v_next.credit_rating,
         owns_other_property = v_next.owns_other_property,
         related_to_sellers = v_next.related_to_sellers,
         notes = v_next.notes,
         relationship_in_case = v_next.relationship_in_case,
         updated_by = v_actor,
         updated_at = now()
   WHERE id = p_borrower_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.update_borrower_in_case(UUID, UUID, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. save_borrower_for_case_full — canonical guard (was mig 123, keeps the
--    optimistic-lock p_expected_version contract)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_borrower_for_case_full(
  p_case_id UUID,
  p_borrower_id UUID,
  p_fields JSONB,
  p_role TEXT,
  p_is_primary BOOLEAN,
  p_expected_version BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_borrower_id UUID;
  v_safe_fields JSONB;
  v_national_id TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF p_case_id IS NULL THEN
    RAISE EXCEPTION 'p_case_id is required' USING ERRCODE = '22023';
  END IF;

  -- Canonical case-edit guard (was: assigned_advisor_id = actor OR edit_any_case).
  PERFORM public._assert_can_edit_case(p_case_id);

  v_safe_fields := COALESCE(p_fields, '{}'::jsonb)
    - 'id' - 'created_at' - 'created_by' - 'updated_at' - 'updated_by'
    - 'deleted_at' - 'metadata';

  IF jsonb_typeof(v_safe_fields) <> 'object' THEN
    RAISE EXCEPTION 'p_fields must be a JSON object' USING ERRCODE = '22023';
  END IF;

  v_safe_fields := v_safe_fields
    || jsonb_build_object(
         'updated_by', v_actor::text,
         'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MSOF')
       );

  v_national_id := v_safe_fields ->> 'national_id';

  IF p_borrower_id IS NULL THEN
    IF v_national_id IS NOT NULL AND length(v_national_id) > 0 THEN
      SELECT id INTO v_borrower_id
        FROM public.borrowers
       WHERE national_id = v_national_id AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_borrower_id IS NULL THEN
      INSERT INTO public.borrowers (created_by, updated_by)
      VALUES (v_actor, v_actor)
      RETURNING id INTO v_borrower_id;
    END IF;
  ELSE
    v_borrower_id := p_borrower_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.case_borrowers
       WHERE case_id = p_case_id AND borrower_id = v_borrower_id
    ) THEN
      RAISE EXCEPTION 'borrower not on this case' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.borrowers AS b
     SET first_name = p.first_name,
         last_name = p.last_name,
         national_id = p.national_id,
         id_issue_date = p.id_issue_date,
         id_expiry_date = p.id_expiry_date,
         birth_date = p.birth_date,
         gender = p.gender,
         marital_status = p.marital_status,
         children_count = p.children_count,
         citizenship = p.citizenship,
         additional_citizenships = p.additional_citizenships,
         residency_type = p.residency_type,
         preferred_language = p.preferred_language,
         phone = p.phone,
         landline_phone = p.landline_phone,
         email = p.email,
         address = p.address,
         city = p.city,
         employment_status = p.employment_status,
         employer_name = p.employer_name,
         credit_rating = p.credit_rating,
         owns_other_property = p.owns_other_property,
         related_to_sellers = p.related_to_sellers,
         notes = p.notes,
         relationship_in_case = p.relationship_in_case,
         updated_by = p.updated_by,
         updated_at = p.updated_at
    FROM jsonb_populate_record(b, v_safe_fields) AS p
   WHERE b.id = v_borrower_id
     AND (p_expected_version IS NULL OR b.version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'borrower modified concurrently' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
  VALUES (
    p_case_id,
    v_borrower_id,
    COALESCE(p_role, 'borrower'),
    COALESCE(p_is_primary, FALSE)
  )
  ON CONFLICT (case_id, borrower_id) DO UPDATE
    SET role_in_case = EXCLUDED.role_in_case,
        is_primary = EXCLUDED.is_primary;

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
$fn$;

GRANT EXECUTE ON FUNCTION public.save_borrower_for_case_full(UUID, UUID, JSONB, TEXT, BOOLEAN, BIGINT)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. add_empty_borrower_to_case — NEW atomic RPC for the inline "+ add borrower"
--    Replaces addEmptyBorrowerAction's 3 direct writes (which were RLS-blocked
--    for non-admins by borrowers_modify and non-atomic on partial failure).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_empty_borrower_to_case(p_case_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_borrower_id UUID;
  v_is_primary BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- Canonical case-edit guard (admin / responsible / associated advisor).
  PERFORM public._assert_can_edit_case(p_case_id);

  -- First borrower on the case becomes primary. The partial unique index
  -- uq_case_borrowers_one_primary (mig 024) still enforces one-primary-per-case.
  v_is_primary := NOT EXISTS (
    SELECT 1 FROM public.case_borrowers WHERE case_id = p_case_id
  );

  INSERT INTO public.borrowers (created_by, updated_by)
  VALUES (v_actor, v_actor)
  RETURNING id INTO v_borrower_id;

  -- A failure here rolls back the borrower insert too (single function txn) —
  -- no orphan borrower row can be left behind.
  INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
  VALUES (p_case_id, v_borrower_id, 'borrower', v_is_primary);

  IF v_is_primary THEN
    UPDATE public.cases
       SET primary_borrower_id = v_borrower_id,
           updated_by = v_actor
     WHERE id = p_case_id;
  END IF;

  RETURN v_borrower_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.add_empty_borrower_to_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_empty_borrower_to_case(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. soft_delete_borrower_income / _obligation — canonical guard (was mig 078)
-- -----------------------------------------------------------------------------
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

  PERFORM public._assert_can_edit_case(p_case_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.case_borrowers
     WHERE case_id = p_case_id AND borrower_id = v_borrower_id
  ) THEN
    RAISE EXCEPTION 'income borrower not on this case' USING ERRCODE = '42501';
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

  PERFORM public._assert_can_edit_case(p_case_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.case_borrowers
     WHERE case_id = p_case_id AND borrower_id = v_borrower_id
  ) THEN
    RAISE EXCEPTION 'obligation borrower not on this case' USING ERRCODE = '42501';
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

-- -----------------------------------------------------------------------------
-- 5. borrower_incomes / borrower_obligations INSERT+UPDATE policies — canonical
--    public.can_edit_case (was mig 076's assigned_advisor_id check). can_edit_case
--    already encapsulates (edit_any OR edit_own AND assigned/associated) + the
--    case-not-deleted check, so the redundant cases join + perm prefix are dropped.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "incomes_insert" ON public.borrower_incomes;
CREATE POLICY "incomes_insert" ON public.borrower_incomes
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_edit_case(cb.case_id)
    )
  );

DROP POLICY IF EXISTS "incomes_update" ON public.borrower_incomes;
CREATE POLICY "incomes_update" ON public.borrower_incomes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_edit_case(cb.case_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_edit_case(cb.case_id)
    )
  );

DROP POLICY IF EXISTS "obligations_insert" ON public.borrower_obligations;
CREATE POLICY "obligations_insert" ON public.borrower_obligations
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_edit_case(cb.case_id)
    )
  );

DROP POLICY IF EXISTS "obligations_update" ON public.borrower_obligations;
CREATE POLICY "obligations_update" ON public.borrower_obligations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_edit_case(cb.case_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_edit_case(cb.case_id)
    )
  );

INSERT INTO public.schema_version (version) VALUES (190) ON CONFLICT DO NOTHING;

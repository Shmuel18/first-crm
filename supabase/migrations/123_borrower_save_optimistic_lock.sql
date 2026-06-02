-- =============================================================================
-- Migration 123: optimistic locking for the borrower form (DB-2)
-- =============================================================================
-- The full case edit form already round-trips `cases.version` and pins it in
-- the UPDATE WHERE (migration 056 + updateCaseAction) so a concurrent save hits
-- 0 rows instead of silently winning. The borrower form had NO such guard:
-- save_borrower_for_case_full (migration 065) did a blind last-write-wins UPDATE,
-- so two advisors editing the same borrower silently clobbered each other.
--
-- This re-creates the RPC with a nullable p_expected_version. When provided (the
-- borrower edit form now round-trips borrowers.version), the UPDATE is pinned to
-- that version and a mismatch raises 40001 (serialization_failure), which the
-- service maps to a 'conflict' the form surfaces as "reload, someone changed
-- this". NULL (new-borrower insert, or any legacy 5-arg caller via the DEFAULT)
-- keeps the prior behaviour — fully backward-compatible.
--
-- DROP+CREATE because adding a parameter changes the function signature (a plain
-- CREATE OR REPLACE would create a second overload instead of replacing).
-- =============================================================================

DROP FUNCTION IF EXISTS public.save_borrower_for_case_full(UUID, UUID, JSONB, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.save_borrower_for_case_full(
  p_case_id UUID,
  p_borrower_id UUID,            -- NULL = insert new; non-null = update existing
  p_fields JSONB,               -- all editable borrowers columns
  p_role TEXT,                  -- 'borrower' | 'guarantor'
  p_is_primary BOOLEAN,
  p_expected_version BIGINT DEFAULT NULL  -- optimistic lock; NULL = skip the check
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

  -- Scope check: caller must be able to edit p_case_id (mirrors 064's gate).
  IF NOT EXISTS (
    SELECT 1 FROM public.cases
     WHERE id = p_case_id AND deleted_at IS NULL
       AND (assigned_advisor_id = v_actor OR public.has_permission('edit_any_case'))
  ) THEN
    RAISE EXCEPTION 'not authorized for this case' USING ERRCODE = '42501';
  END IF;

  -- Strip server-controlled + privileged columns. metadata stays admin-only
  -- (parallel to update_borrower_in_case + the profiles.metadata trigger).
  v_safe_fields := COALESCE(p_fields, '{}'::jsonb)
    - 'id' - 'created_at' - 'created_by' - 'updated_at' - 'updated_by'
    - 'deleted_at' - 'metadata';

  IF jsonb_typeof(v_safe_fields) <> 'object' THEN
    RAISE EXCEPTION 'p_fields must be a JSON object' USING ERRCODE = '22023';
  END IF;

  -- Stamp updated_by / updated_at server-side regardless of input.
  v_safe_fields := v_safe_fields
    || jsonb_build_object(
         'updated_by', v_actor::text,
         'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MSOF')
       );

  v_national_id := v_safe_fields ->> 'national_id';

  IF p_borrower_id IS NULL THEN
    -- ---- INSERT path -------------------------------------------------------
    -- Reuse-by-national_id matches 053's intent — a duplicate national_id
    -- would violate the unique constraint anyway, and reusing the row keeps
    -- audit history linked to one entity instead of fragmenting.
    IF v_national_id IS NOT NULL AND length(v_national_id) > 0 THEN
      SELECT id INTO v_borrower_id
        FROM public.borrowers
       WHERE national_id = v_national_id AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_borrower_id IS NULL THEN
      -- Genuine new borrower. created_by + updated_by stamped here (the
      -- v_safe_fields merge above only set updated_*).
      INSERT INTO public.borrowers (created_by, updated_by)
      VALUES (v_actor, v_actor)
      RETURNING id INTO v_borrower_id;
    END IF;
  ELSE
    -- ---- UPDATE path -------------------------------------------------------
    v_borrower_id := p_borrower_id;
    -- Scope check: the supplied borrower must already be linked to p_case_id.
    IF NOT EXISTS (
      SELECT 1 FROM public.case_borrowers
       WHERE case_id = p_case_id AND borrower_id = v_borrower_id
    ) THEN
      RAISE EXCEPTION 'borrower not on this case' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Apply the JSONB patch using jsonb_populate_record for per-column type
  -- safety. Same pattern as update_borrower_in_case (migration 064). The
  -- version predicate is the optimistic lock: when p_expected_version is set
  -- (edit of an existing borrower), a concurrent bump makes this match 0 rows.
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

  -- 0 rows here with a pinned version = a concurrent writer bumped it first.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'borrower modified concurrently' USING ERRCODE = '40001';
  END IF;

  -- ---- Junction upsert -----------------------------------------------------
  -- The case_borrowers table has its own per-verb RLS (migration 024) that
  -- allows edit when can_view_case + can_edit_case — passes here since we
  -- already proved that at the scope check above.
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

  -- If promoting this borrower to primary, demote any other primary on the
  -- same case and sync cases.primary_borrower_id. This atomic pair prevents
  -- the "junction says A is primary, cases.primary_borrower_id is B" drift
  -- that the previous 3-statement TS flow could leave behind on partial failure.
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

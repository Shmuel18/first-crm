-- =============================================================================
-- Migration 065: save_borrower_for_case_full — JSONB-based companion to 064
-- =============================================================================
-- Migration 064 made direct INSERT/UPDATE on borrowers admin-only and added
-- update_borrower_in_case (JSONB patch) + tightened save_borrower_for_case
-- (7 hard-coded fields). The full-form save flow
-- (features/borrowers/services/borrowers.service.ts saveBorrowerForCase)
-- writes ~25 borrower columns plus a junction row plus the optional
-- cases.primary_borrower_id sync — far more than the typed RPC's signature.
--
-- Without this RPC, non-admin advisors would lose the ability to add a
-- new borrower to a case via the full borrower form (the RLS layer now
-- denies their direct INSERT). This migration plugs that gap with a single
-- transactional, scope-checked RPC that handles all three operations.
--
-- Defense-in-depth: the action layer (save-borrower.ts) already checks
-- userCanEditCase before calling. This RPC re-checks at the DB layer so
-- a future REST caller (POST /rpc/save_borrower_for_case_full from a
-- compromised session) is refused even if action-layer checks are bypassed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_borrower_for_case_full(
  p_case_id UUID,
  p_borrower_id UUID,            -- NULL = insert new; non-null = update existing
  p_fields JSONB,                -- all editable borrowers columns
  p_role TEXT,                   -- 'borrower' | 'guarantor'
  p_is_primary BOOLEAN
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
  -- safety. Same pattern as update_borrower_in_case (migration 064).
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
   WHERE b.id = v_borrower_id;

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

GRANT EXECUTE ON FUNCTION public.save_borrower_for_case_full(UUID, UUID, JSONB, TEXT, BOOLEAN)
  TO authenticated;

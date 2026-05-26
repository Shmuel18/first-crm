-- =============================================================================
-- Migration 074: create_case_draft transactional RPC
-- =============================================================================
-- Backs the new /cases/new draft flow: the form lives client-side until the
-- user clicks "save", at which point everything is committed atomically.
-- Without a single RPC the TS layer would have to fire N+2 round-trips
-- (cases insert, then per-borrower insert + case_borrowers link) — a partial
-- failure would leak orphan borrower rows.
--
-- Scope (matches the product decision):
--   * Editable in draft: borrowers array + request_details (rich text).
--   * Everything else (status, types, property values, financials, …) stays
--     at column default. The new case lands as a 'lead' status by default;
--     advisor edits the rest inline on the detail page after redirect.
--
-- Validation on the TS side (CaseDraftSchema):
--   * ≥1 borrower with first_name + last_name.
--   * Other borrower fields optional (matches BorrowerFormSchema).
--
-- Validation here is defense-in-depth: the RPC RAISEs on missing required
-- bits so a malformed REST call can't sneak a half-row through.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_case_draft(
  p_request_details TEXT,
  p_borrowers JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_case_id UUID;
  v_status_id UUID;
  v_first_borrower_id UUID;
  v_borrower_id UUID;
  v_borrower JSONB;
  v_borrower_idx INT := 0;
  v_first_name TEXT;
  v_last_name TEXT;
  v_national_id TEXT;
  v_role TEXT;
BEGIN
  -- 1. Auth + permission gating (RLS bypass via SECURITY DEFINER, so we MUST
  -- gate explicitly here — never rely on the RLS policy reaching this code).
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'missing create_case permission' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate borrowers array shape.
  IF p_borrowers IS NULL OR jsonb_typeof(p_borrowers) <> 'array' THEN
    RAISE EXCEPTION 'p_borrowers must be a JSONB array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_borrowers) < 1 THEN
    RAISE EXCEPTION 'at least one borrower required' USING ERRCODE = '22023';
  END IF;

  -- 3. Lookup default status (ליד / lead). All new cases enter here; advisor
  -- promotes them down the funnel inline on the detail page.
  SELECT id INTO v_status_id
    FROM public.case_statuses
   WHERE key = 'lead'
   LIMIT 1;

  IF v_status_id IS NULL THEN
    RAISE EXCEPTION 'lead status row missing — seed data not loaded';
  END IF;

  -- 4. Insert the case row. case_number auto-generates via the table default
  -- trigger (generate_case_number, see migration 006).
  INSERT INTO public.cases (
    status_id,
    request_details,
    created_by,
    updated_by
  ) VALUES (
    v_status_id,
    p_request_details,
    v_actor,
    v_actor
  )
  RETURNING id INTO v_case_id;

  -- 5. Insert borrowers + junction rows. The first borrower in the array is
  -- the "primary" — that's just an ordering choice, the UX layer presents
  -- borrowers as #1 / #2 / … with no semantic "primary" label.
  FOR v_borrower IN SELECT * FROM jsonb_array_elements(p_borrowers)
  LOOP
    v_borrower_idx := v_borrower_idx + 1;

    -- Required fields enforced here too (TS layer also validates; this is
    -- the last line of defense against a bypass).
    v_first_name := NULLIF(TRIM(COALESCE(v_borrower->>'first_name', '')), '');
    v_last_name := NULLIF(TRIM(COALESCE(v_borrower->>'last_name', '')), '');

    IF v_first_name IS NULL OR v_last_name IS NULL THEN
      RAISE EXCEPTION 'borrower % missing first_name or last_name', v_borrower_idx
        USING ERRCODE = '22023';
    END IF;

    v_national_id := NULLIF(v_borrower->>'national_id', '');
    v_role := COALESCE(v_borrower->>'role_in_case', 'borrower');

    IF v_role NOT IN ('borrower', 'guarantor') THEN
      RAISE EXCEPTION 'borrower % has invalid role_in_case: %', v_borrower_idx, v_role
        USING ERRCODE = '22023';
    END IF;

    -- Reuse existing borrower if national_id matches (migration 053 + 055
    -- precedent — avoids duplicate borrower rows when an existing client
    -- opens a second case).
    v_borrower_id := NULL;
    IF v_national_id IS NOT NULL THEN
      SELECT id INTO v_borrower_id
        FROM public.borrowers
       WHERE national_id = v_national_id AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_borrower_id IS NULL THEN
      -- New borrower. Pull every optional field through with COALESCE/NULLIF
      -- so empty strings become NULL (the form submits "" for unfilled
      -- inputs, the DB columns are typed TEXT/DATE/etc.).
      INSERT INTO public.borrowers (
        first_name,
        last_name,
        national_id,
        id_issue_date,
        id_expiry_date,
        gender,
        phone,
        landline_phone,
        email,
        preferred_language,
        birth_date,
        marital_status,
        children_count,
        relationship_in_case,
        address,
        city,
        citizenship,
        additional_citizenships,
        residency_type,
        employment_status,
        employer_name,
        credit_rating,
        owns_other_property,
        related_to_sellers,
        notes,
        created_by,
        updated_by
      ) VALUES (
        v_first_name,
        v_last_name,
        v_national_id,
        NULLIF(v_borrower->>'id_issue_date', '')::DATE,
        NULLIF(v_borrower->>'id_expiry_date', '')::DATE,
        NULLIF(v_borrower->>'gender', ''),
        NULLIF(v_borrower->>'phone', ''),
        NULLIF(v_borrower->>'landline_phone', ''),
        NULLIF(v_borrower->>'email', ''),
        NULLIF(v_borrower->>'preferred_language', ''),
        NULLIF(v_borrower->>'birth_date', '')::DATE,
        NULLIF(v_borrower->>'marital_status', ''),
        NULLIF(v_borrower->>'children_count', '')::INT,
        NULLIF(v_borrower->>'relationship_in_case', ''),
        NULLIF(v_borrower->>'address', ''),
        NULLIF(v_borrower->>'city', ''),
        NULLIF(v_borrower->>'citizenship', ''),
        NULLIF(v_borrower->>'additional_citizenships', ''),
        NULLIF(v_borrower->>'residency_type', ''),
        NULLIF(v_borrower->>'employment_status', ''),
        NULLIF(v_borrower->>'employer_name', ''),
        NULLIF(v_borrower->>'credit_rating', ''),
        CASE
          WHEN v_borrower->>'owns_other_property' = 'true' THEN TRUE
          WHEN v_borrower->>'owns_other_property' = 'false' THEN FALSE
          ELSE NULL
        END,
        CASE
          WHEN v_borrower->>'related_to_sellers' = 'true' THEN TRUE
          WHEN v_borrower->>'related_to_sellers' = 'false' THEN FALSE
          ELSE NULL
        END,
        NULLIF(v_borrower->>'notes', ''),
        v_actor,
        v_actor
      )
      RETURNING id INTO v_borrower_id;
    ELSE
      -- Existing borrower (national_id match). Refresh contact fields only,
      -- per migration 055 precedent — never overwrite name from an already
      -- known record (the on-file spelling stays canonical).
      UPDATE public.borrowers
         SET phone = COALESCE(NULLIF(v_borrower->>'phone', ''), phone),
             email = COALESCE(NULLIF(v_borrower->>'email', ''), email),
             birth_date = COALESCE(NULLIF(v_borrower->>'birth_date', '')::DATE, birth_date),
             updated_by = v_actor
       WHERE id = v_borrower_id;
    END IF;

    -- 6. Link to the case. First borrower gets is_primary=TRUE (it's the
    -- one shown in dashboard "client name" column). uq_case_borrowers_one_primary
    -- (migration 024) would block multiple primaries — we enforce one here
    -- by only setting TRUE on idx=1.
    INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
    VALUES (v_case_id, v_borrower_id, v_role, v_borrower_idx = 1)
    ON CONFLICT (case_id, borrower_id) DO NOTHING;

    IF v_borrower_idx = 1 THEN
      v_first_borrower_id := v_borrower_id;
    END IF;
  END LOOP;

  -- 7. Mirror primary_borrower_id on the case row (kept in sync with
  -- case_borrowers.is_primary; see migration 055 for the same pattern).
  UPDATE public.cases
     SET primary_borrower_id = v_first_borrower_id,
         updated_by = v_actor
   WHERE id = v_case_id;

  RETURN v_case_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_case_draft(TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_case_draft IS
  'Transactional save for /cases/new draft flow. Inserts cases + borrowers + case_borrowers in one txn. Defaults status_id to "lead". See migration 074 header for the full scope.';

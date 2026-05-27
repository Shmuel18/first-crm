-- =============================================================================
-- Migration 086: Drop the 'lead' case status + retarget the draft RPC
-- =============================================================================
-- Background:
--   * Pre-cases (leads) already live in a dedicated `leads` table with its
--     own pipeline; convert_lead_to_case (migration 031) lands the new case
--     on `case_opened`, not `lead`. The `lead` row I added in migration 083
--     was only there so create_case_draft (migration 074 + 085) could find
--     its default — it was never a real product stage.
--   * Keeping `lead` in case_statuses just bloats the status picker on the
--     case detail page with a stage that semantically belongs elsewhere.
--
-- This migration:
--   1. Re-maps any cases / stage_durations / case_type_documents that point
--      to the `lead` row → `case_opened` (or NULL for the doc-requirement
--      config, where "no specific stage" is a valid value).
--   2. Drops the `lead` row from case_statuses.
--   3. Replaces create_case_draft with a version that looks up `case_opened`
--      instead of `lead`, and adds the foreign_residence_country column
--      added in 084 to the borrower INSERT. Supersedes the short-lived 085
--      (now squashed in here) — that file was removed since 086 replays its
--      entire RPC body anyway.
-- Dependencies: 074 (RPC v1), 082 (palette + remove pre_approval),
--               083 (lead row insert), 084 (foreign_residence_country col).
-- =============================================================================

-- 1a. Cases pointing at lead → case_opened.
UPDATE public.cases
SET status_id = (SELECT id FROM public.case_statuses WHERE key = 'case_opened')
WHERE status_id = (SELECT id FROM public.case_statuses WHERE key = 'lead');

-- 1b. Stage-duration history rows (same reason as migration 082 step 1b —
--     stage_durations.status_id has a FK that blocks the DELETE).
UPDATE public.stage_durations
SET status_id = (SELECT id FROM public.case_statuses WHERE key = 'case_opened')
WHERE status_id = (SELECT id FROM public.case_statuses WHERE key = 'lead');

-- 1c. case_type_documents config — clear "required at lead stage" entries.
UPDATE public.case_type_documents
SET required_at_stage_id = NULL
WHERE required_at_stage_id = (SELECT id FROM public.case_statuses WHERE key = 'lead');

-- 2. Drop the row.
DELETE FROM public.case_statuses WHERE key = 'lead';

-- 3. Replace the RPC. Full body so applying this migration on a DB that
--    skipped 085 still produces the right shape (foreign_residence_country
--    included). Only change vs v2: the status lookup uses 'case_opened'.
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
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'missing create_case permission' USING ERRCODE = '42501';
  END IF;

  IF p_borrowers IS NULL OR jsonb_typeof(p_borrowers) <> 'array' THEN
    RAISE EXCEPTION 'p_borrowers must be a JSONB array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_borrowers) < 1 THEN
    RAISE EXCEPTION 'at least one borrower required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_status_id
    FROM public.case_statuses
   WHERE key = 'case_opened'
   LIMIT 1;

  IF v_status_id IS NULL THEN
    RAISE EXCEPTION 'case_opened status row missing — seed data not loaded';
  END IF;

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

  FOR v_borrower IN SELECT * FROM jsonb_array_elements(p_borrowers)
  LOOP
    v_borrower_idx := v_borrower_idx + 1;

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

    v_borrower_id := NULL;
    IF v_national_id IS NOT NULL THEN
      SELECT id INTO v_borrower_id
        FROM public.borrowers
       WHERE national_id = v_national_id AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_borrower_id IS NULL THEN
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
        foreign_residence_country,
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
        NULLIF(v_borrower->>'foreign_residence_country', ''),
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
      UPDATE public.borrowers
         SET phone = COALESCE(NULLIF(v_borrower->>'phone', ''), phone),
             email = COALESCE(NULLIF(v_borrower->>'email', ''), email),
             birth_date = COALESCE(NULLIF(v_borrower->>'birth_date', '')::DATE, birth_date),
             updated_by = v_actor
       WHERE id = v_borrower_id;
    END IF;

    INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
    VALUES (v_case_id, v_borrower_id, v_role, v_borrower_idx = 1)
    ON CONFLICT (case_id, borrower_id) DO NOTHING;

    IF v_borrower_idx = 1 THEN
      v_first_borrower_id := v_borrower_id;
    END IF;
  END LOOP;

  UPDATE public.cases
     SET primary_borrower_id = v_first_borrower_id,
         updated_by = v_actor
   WHERE id = v_case_id;

  RETURN v_case_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_case_draft(TEXT, JSONB) TO authenticated;

-- =============================================================================
-- Migration 092: Re-apply create_case_draft status lookup
-- =============================================================================
-- Production still returned the v074 error:
--   "lead status row missing -- seed data not loaded"
--
-- Migrations 083/086 are recorded as applied, but the live function body still
-- looked up the removed `lead` case_status. Re-applying the full RPC body as a
-- forward migration is safer than repairing migration history.
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
    RAISE EXCEPTION 'case_opened status row missing -- seed data not loaded';
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

COMMENT ON FUNCTION public.create_case_draft(TEXT, JSONB) IS
  'Creates a case draft with borrowers atomically; default status is case_opened.';

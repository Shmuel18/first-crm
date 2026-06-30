-- =============================================================================
-- Migration 209: copy-per-case borrower model (Phase 1 — DB).
-- =============================================================================
-- Moves borrowers from SHARED-IDENTITY (one row per national_id, reused across
-- cases) to COPY-PER-CASE (each case owns its own borrower row = an independent
-- snapshot). Financials (borrower_incomes / borrower_obligations) FK only to
-- borrower_id, so a fresh borrower row per case is automatically isolated — no
-- financial-schema change. This also fixes two latent bugs: editing a shared
-- income mutated other cases, and RLS exposed a shared borrower's incomes to any
-- case viewer.
--
-- See docs/COPY_PER_CASE_PLAN.md. Everything below runs in ONE transaction (the
-- migration runner wraps the file), so a failure rolls back cleanly.
--
-- Order matters:
--   1. Drop the unique national_id index (so duplicates become legal).
--   2. Split existing shared borrowers into per-case copies.
--   3. Rewrite the reuse RPCs to ALWAYS INSERT (never reuse by national_id).
--   4. Add the snapshot helper + wire it into create_case_draft.
--   5. Revoke the legacy unguarded RPC.
--
-- Deferred to a follow-up (safe to leave restrictive): import_cases still blocks
-- a re-import of an existing national_id (national_id_exists) — it never creates
-- wrong data, just stays conservative.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop the global-singleton constraint; keep a plain index for search.
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_borrowers_national_id;

CREATE INDEX IF NOT EXISTS idx_borrowers_national_id
  ON public.borrowers (national_id)
  WHERE national_id IS NOT NULL AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Split existing shared borrowers. For each borrower on >1 case, the EARLIEST
--    case keeps the original row; every later case gets its own clone (borrower +
--    active incomes/obligations), with that case's references repointed to it.
-- -----------------------------------------------------------------------------
DO $split$
DECLARE
  v_shared   UUID;
  v_canon    UUID;
  v_case     UUID;
  v_copy     UUID;
BEGIN
  FOR v_shared IN
    SELECT borrower_id
      FROM public.case_borrowers
     GROUP BY borrower_id
    HAVING count(DISTINCT case_id) > 1
  LOOP
    -- canonical (earliest) case keeps the original borrower row
    SELECT cb.case_id INTO v_canon
      FROM public.case_borrowers cb
      JOIN public.cases c ON c.id = cb.case_id
     WHERE cb.borrower_id = v_shared
     ORDER BY c.created_at ASC, cb.case_id ASC
     LIMIT 1;

    FOR v_case IN
      SELECT cb.case_id
        FROM public.case_borrowers cb
        JOIN public.cases c ON c.id = cb.case_id
       WHERE cb.borrower_id = v_shared
         AND cb.case_id <> v_canon
       ORDER BY c.created_at ASC, cb.case_id ASC
    LOOP
      -- clone the borrower (all personal columns; new id, version resets to 1)
      INSERT INTO public.borrowers (
        first_name, last_name, national_id, id_issue_date, id_expiry_date, birth_date,
        gender, marital_status, children_count, relationship_in_case, phone, landline_phone,
        email, preferred_language, address, city, citizenship, additional_citizenships,
        residency_type, foreign_residence_country, employment_status, employer_name,
        credit_rating, owns_other_property, related_to_sellers, notes, metadata,
        created_by, updated_by
      )
      SELECT
        first_name, last_name, national_id, id_issue_date, id_expiry_date, birth_date,
        gender, marital_status, children_count, relationship_in_case, phone, landline_phone,
        email, preferred_language, address, city, citizenship, additional_citizenships,
        residency_type, foreign_residence_country, employment_status, employer_name,
        credit_rating, owns_other_property, related_to_sellers, notes, metadata,
        created_by, updated_by
      FROM public.borrowers
      WHERE id = v_shared
      RETURNING id INTO v_copy;

      -- clone active incomes + obligations onto the copy
      INSERT INTO public.borrower_incomes (
        borrower_id, income_type_id, amount_monthly, source_name, tenure_months,
        employment_start_date, is_primary, notes, metadata, created_by, updated_by
      )
      SELECT v_copy, income_type_id, amount_monthly, source_name, tenure_months,
        employment_start_date, is_primary, notes, metadata, created_by, updated_by
      FROM public.borrower_incomes
      WHERE borrower_id = v_shared AND deleted_at IS NULL;

      INSERT INTO public.borrower_obligations (
        borrower_id, loan_amount, monthly_payment, months_remaining, end_date,
        lender, description, metadata, created_by, updated_by
      )
      SELECT v_copy, loan_amount, monthly_payment, months_remaining, end_date,
        lender, description, metadata, created_by, updated_by
      FROM public.borrower_obligations
      WHERE borrower_id = v_shared AND deleted_at IS NULL;

      -- repoint THIS case's references to the copy
      UPDATE public.case_borrowers
         SET borrower_id = v_copy
       WHERE case_id = v_case AND borrower_id = v_shared;

      UPDATE public.cases
         SET primary_borrower_id = v_copy
       WHERE id = v_case AND primary_borrower_id = v_shared;

      UPDATE public.documents
         SET borrower_id = v_copy
       WHERE case_id = v_case AND borrower_id = v_shared;

      UPDATE public.mortgage_scenarios
         SET primary_borrower_id = v_copy
       WHERE case_id = v_case AND primary_borrower_id = v_shared;
    END LOOP;
  END LOOP;

  -- post-condition: no borrower may remain on more than one case
  IF EXISTS (
    SELECT 1 FROM public.case_borrowers
     GROUP BY borrower_id HAVING count(DISTINCT case_id) > 1
  ) THEN
    RAISE EXCEPTION 'copy-per-case split incomplete: a borrower is still on multiple cases';
  END IF;
END
$split$;

-- -----------------------------------------------------------------------------
-- 3. snapshot_borrower_financials — copy a source borrower's active incomes /
--    obligations onto a freshly-created destination borrower. INTERNAL ONLY
--    (called by create_case_draft inside its DEFINER context — NOT granted to
--    authenticated). The source-access check stops snapshotting a borrower the
--    caller can't see. If ever exposed standalone, ALSO assert _assert_can_edit_case
--    on the destination case (see ISS-02, migration 201).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snapshot_borrower_financials(
  p_source_borrower_id UUID,
  p_dest_borrower_id UUID,
  p_copy_incomes BOOLEAN,
  p_copy_obligations BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $snap$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF p_source_borrower_id IS NULL OR p_dest_borrower_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT (COALESCE(p_copy_incomes, FALSE) OR COALESCE(p_copy_obligations, FALSE)) THEN
    RETURN;
  END IF;

  -- the caller may only snapshot from a borrower they can already SEE
  IF NOT public._caller_can_access_borrower(p_source_borrower_id) THEN
    RAISE EXCEPTION 'source borrower not accessible to the caller' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_copy_incomes, FALSE) THEN
    INSERT INTO public.borrower_incomes (
      borrower_id, income_type_id, amount_monthly, source_name, tenure_months,
      employment_start_date, is_primary, notes, metadata, created_by, updated_by
    )
    SELECT p_dest_borrower_id, income_type_id, amount_monthly, source_name, tenure_months,
      employment_start_date, is_primary, notes,
      COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('imported', true),
      v_actor, v_actor
    FROM public.borrower_incomes
    WHERE borrower_id = p_source_borrower_id AND deleted_at IS NULL;
  END IF;

  IF COALESCE(p_copy_obligations, FALSE) THEN
    INSERT INTO public.borrower_obligations (
      borrower_id, loan_amount, monthly_payment, months_remaining, end_date,
      lender, description, metadata, created_by, updated_by
    )
    SELECT p_dest_borrower_id, loan_amount, monthly_payment, months_remaining, end_date,
      lender, description,
      COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('imported', true),
      v_actor, v_actor
    FROM public.borrower_obligations
    WHERE borrower_id = p_source_borrower_id AND deleted_at IS NULL;
  END IF;
END;
$snap$;

REVOKE ALL ON FUNCTION public.snapshot_borrower_financials(UUID, UUID, BOOLEAN, BOOLEAN) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 4. save_borrower_for_case_full — drop the national_id reuse branch.
--    p_borrower_id IS NULL now ALWAYS inserts a fresh row. The update-existing
--    branch (p_borrower_id IS NOT NULL) + its "borrower on this case" check stay.
--    (Body verbatim from migration 201 with only that branch changed.)
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
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF p_case_id IS NULL THEN
    RAISE EXCEPTION 'p_case_id is required' USING ERRCODE = '22023';
  END IF;

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

  -- Copy-per-case: a new borrower is ALWAYS a fresh row (no national_id reuse).
  IF p_borrower_id IS NULL THEN
    INSERT INTO public.borrowers (created_by, updated_by)
    VALUES (v_actor, v_actor)
    RETURNING id INTO v_borrower_id;
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
-- 5. create_case_draft — drop the per-borrower national_id reuse + overwrite;
--    ALWAYS insert a fresh borrower. Adds optional per-borrower source_borrower_id
--    + copy_incomes / copy_obligations to snapshot a returning client's financials.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_case_draft(
  p_request_details TEXT,
  p_borrowers JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn2$
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
  v_source_borrower_id UUID;
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

    IF v_role NOT IN ('borrower', 'guarantor', 'rights_owner', 'mortgaging_borrower') THEN
      RAISE EXCEPTION 'borrower % has invalid role_in_case: %', v_borrower_idx, v_role
        USING ERRCODE = '22023';
    END IF;

    -- Copy-per-case: every borrower is a fresh row (no national_id reuse).
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

    INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
    VALUES (v_case_id, v_borrower_id, v_role, v_borrower_idx = 1)
    ON CONFLICT (case_id, borrower_id) DO NOTHING;

    -- Optional financial snapshot from the chosen returning-client source.
    v_source_borrower_id := NULLIF(v_borrower->>'source_borrower_id', '')::UUID;
    IF v_source_borrower_id IS NOT NULL THEN
      PERFORM public.snapshot_borrower_financials(
        v_source_borrower_id,
        v_borrower_id,
        COALESCE(v_borrower->>'copy_incomes', '') = 'true',
        COALESCE(v_borrower->>'copy_obligations', '') = 'true'
      );
    END IF;

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
$fn2$;

GRANT EXECUTE ON FUNCTION public.create_case_draft(TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_case_draft(TEXT, JSONB) IS
  'Creates a case draft with borrowers atomically (copy-per-case: each borrower is a fresh row, no national_id reuse). Optional per-borrower source_borrower_id + copy_incomes/copy_obligations snapshots a returning client''s financials (migration 209).';

-- -----------------------------------------------------------------------------
-- 6. convert_lead_to_case — drop the national_id reuse in both paths; always
--    INSERT a fresh borrower. (Body verbatim from migration 201 with the two
--    dedup SELECT/guard/IF blocks replaced by unconditional INSERTs.)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_lead_to_case(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn3$
DECLARE
  v_lead RECORD;
  v_case_id UUID;
  v_borrower_id UUID;
  v_first_borrower_id UUID;
  v_status_id UUID;
  v_actor UUID := auth.uid();
  v_payload JSONB;
  v_borrower JSONB;
  v_idx INT := 0;
  v_national_id TEXT;
  v_owns_other TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'convert_lead_to_case: no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'convert_lead_to_case: missing create_case permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'convert_lead_to_case: lead % not found', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_permission('view_all_leads')
    OR (public.has_permission('view_own_leads') AND v_lead.assigned_to = v_actor)
  ) THEN
    RAISE EXCEPTION 'convert_lead_to_case: not authorized for lead %', p_lead_id USING ERRCODE = '42501';
  END IF;

  IF v_lead.status IS NOT NULL AND v_lead.status <> 'active' THEN
    RAISE EXCEPTION 'convert_lead_to_case: lead % is not active (status=%)',
      p_lead_id, v_lead.status USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_status_id FROM public.case_statuses WHERE key = 'case_opened' LIMIT 1;
  IF v_status_id IS NULL THEN
    RAISE EXCEPTION 'convert_lead_to_case: case_opened status row missing — seed data not loaded';
  END IF;

  v_payload := v_lead.metadata -> 'payload';

  IF v_payload IS NOT NULL
     AND jsonb_typeof(v_payload) = 'object'
     AND jsonb_typeof(v_payload -> 'borrowers') = 'array'
     AND jsonb_array_length(v_payload -> 'borrowers') >= 1
  THEN
    -- ========== RICH PATH: web-intake lead — import the questionnaire ==========
    v_owns_other := v_payload ->> 'owns_other_property';

    INSERT INTO public.cases (
      status_id, property_value, requested_mortgage_amount, equity, city,
      request_details, created_by, updated_by
    ) VALUES (
      v_status_id,
      NULLIF(v_payload ->> 'property_value', '')::NUMERIC,
      NULLIF(v_payload ->> 'requested_mortgage_amount', '')::NUMERIC,
      NULLIF(v_payload ->> 'equity', '')::NUMERIC,
      NULLIF(v_payload ->> 'property_city', ''),
      NULLIF(v_payload ->> 'request_details', ''),
      v_actor, v_actor
    )
    RETURNING id INTO v_case_id;

    FOR v_borrower IN SELECT * FROM jsonb_array_elements(v_payload -> 'borrowers')
    LOOP
      v_idx := v_idx + 1;
      v_national_id := NULLIF(v_borrower ->> 'national_id', '');

      -- Copy-per-case: always a fresh borrower row (no national_id reuse).
      INSERT INTO public.borrowers (
        first_name, last_name, national_id, gender, phone, email,
        preferred_language, birth_date, marital_status, children_count,
        address, city, citizenship, residency_type, foreign_residence_country,
        employment_status, employer_name, owns_other_property, related_to_sellers,
        created_by, updated_by
      ) VALUES (
        NULLIF(TRIM(COALESCE(v_borrower ->> 'first_name', '')), ''),
        NULLIF(TRIM(COALESCE(v_borrower ->> 'last_name', '')), ''),
        v_national_id,
        NULLIF(v_borrower ->> 'gender', ''),
        NULLIF(v_borrower ->> 'phone', ''),
        NULLIF(v_borrower ->> 'email', ''),
        NULLIF(v_borrower ->> 'preferred_language', ''),
        NULLIF(v_borrower ->> 'birth_date', '')::DATE,
        NULLIF(v_borrower ->> 'marital_status', ''),
        NULLIF(v_borrower ->> 'children_count', '')::INT,
        NULLIF(v_borrower ->> 'address', ''),
        NULLIF(v_borrower ->> 'city', ''),
        NULLIF(v_borrower ->> 'citizenship', ''),
        NULLIF(v_borrower ->> 'residency_type', ''),
        NULLIF(v_borrower ->> 'foreign_residence_country', ''),
        NULLIF(v_borrower ->> 'employment_status', ''),
        NULLIF(v_borrower ->> 'employer_name', ''),
        CASE WHEN v_owns_other = 'true' THEN TRUE
             WHEN v_owns_other = 'false' THEN FALSE ELSE NULL END,
        CASE WHEN v_borrower ->> 'related_to_sellers' = 'true' THEN TRUE
             WHEN v_borrower ->> 'related_to_sellers' = 'false' THEN FALSE ELSE NULL END,
        v_actor, v_actor
      )
      RETURNING id INTO v_borrower_id;

      INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
      VALUES (v_case_id, v_borrower_id, 'borrower', v_idx = 1)
      ON CONFLICT (case_id, borrower_id) DO NOTHING;

      IF NULLIF(v_borrower ->> 'monthly_income', '') IS NOT NULL
         OR NULLIF(v_borrower ->> 'employment_start_date', '') IS NOT NULL THEN
        INSERT INTO public.borrower_incomes (
          borrower_id, amount_monthly, employment_start_date, source_name,
          is_primary, created_by, updated_by
        ) VALUES (
          v_borrower_id,
          NULLIF(v_borrower ->> 'monthly_income', '')::NUMERIC,
          NULLIF(v_borrower ->> 'employment_start_date', '')::DATE,
          NULLIF(v_borrower ->> 'employer_name', ''),
          v_idx = 1,
          v_actor, v_actor
        );
      END IF;

      IF v_idx = 1 THEN
        v_first_borrower_id := v_borrower_id;
      END IF;
    END LOOP;

    UPDATE public.cases
       SET primary_borrower_id = v_first_borrower_id, updated_by = v_actor
     WHERE id = v_case_id;

  ELSE
    -- ========== SIMPLE PATH: manual lead ==========
    -- Copy-per-case: always a fresh borrower row (no national_id reuse).
    INSERT INTO public.borrowers (
      first_name, last_name, national_id, phone, email, created_by, updated_by
    ) VALUES (
      v_lead.first_name, v_lead.last_name, v_lead.national_id,
      v_lead.phone, v_lead.email, v_actor, v_actor
    )
    RETURNING id INTO v_borrower_id;

    INSERT INTO public.cases (
      primary_borrower_id, status_id, created_by, updated_by
    ) VALUES (
      v_borrower_id, v_status_id, v_actor, v_actor
    )
    RETURNING id INTO v_case_id;

    INSERT INTO public.case_borrowers (case_id, borrower_id, is_primary)
    VALUES (v_case_id, v_borrower_id, TRUE)
    ON CONFLICT (case_id, borrower_id) DO NOTHING;
  END IF;

  UPDATE public.leads
     SET status = 'converted',
         converted_to_case_id = v_case_id,
         converted_at = now(),
         updated_by = v_actor
   WHERE id = p_lead_id;

  RETURN v_case_id;
END;
$fn3$;

REVOKE ALL ON FUNCTION public.convert_lead_to_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_case(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Revoke the legacy unguarded RPC (mig 064). It is superseded by
--    save_borrower_for_case_full and still carried an unguarded national_id reuse
--    path (an open ISS-02 IDOR). Owner decision 2026-06-30: revoke, don't fix.
-- -----------------------------------------------------------------------------
DO $rev$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.save_borrower_for_case(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN)
    FROM authenticated;
EXCEPTION WHEN undefined_function THEN
  NULL;
END
$rev$;

-- -----------------------------------------------------------------------------
INSERT INTO public.schema_version (version) VALUES (209) ON CONFLICT DO NOTHING;

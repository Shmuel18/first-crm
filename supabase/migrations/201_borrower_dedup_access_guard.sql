-- =============================================================================
-- Migration 201: close the cross-case borrower-PII IDOR (security review ISS-02,
--                HIGH) in the three SECURITY DEFINER borrower-write RPCs.
-- =============================================================================
-- Security review (2026-06-19) finding ISS-02: create_case_draft (mig 142),
-- save_borrower_for_case_full (mig 190) and convert_lead_to_case (mig 152) all
-- deduplicate borrowers by a GLOBAL national_id lookup
--   SELECT id FROM public.borrowers WHERE national_id = <caller input> AND deleted_at IS NULL
-- which BYPASSES RLS inside the DEFINER context. The matched borrower (possibly
-- another advisor's client) is then linked to the CALLER's case via
-- case_borrowers, after which borrowers_select / incomes_select / obligations_select
-- (scoped via can_view_case on the now-linked case) expose the victim's full PII,
-- and create_case_draft additionally overwrites their phone/email/birth_date.
-- Any authenticated advisor with create_case/create_lead who knows a 9-digit
-- national ID could harvest or tamper with a stranger's record. The dedicated
-- returning-client lookup (searchReturningBorrowers) is deliberately RLS-scoped +
-- rate-limited to prevent exactly this; these RPCs were the unguarded back door.
--
-- national_id carries a partial UNIQUE index (uq_borrowers_national_id, mig 053),
-- so "just create a fresh row" is impossible — the dedup is structurally required.
-- Fix: reuse a national_id-matched borrower ONLY when the caller can already SEE
-- that person (they are on at least one case the caller can_view). Otherwise
-- RAISE 42501 — fail closed. This preserves the legitimate returning-client flow
-- (the advisor found them precisely because they had access) while blocking the
-- cross-tenant harvest/tamper. Once a reuse is allowed (no NEW disclosure), the
-- caller is editing a borrower on their OWN editable case, so the existing
-- overwrite stays within authorization.
--
-- 42501 is the SQLSTATE the action layer already maps to a translated
-- 'unauthorized' (borrowers.service.ts, convert-lead.ts; save-case-draft.ts
-- gains the mapping in this change set), so no new user-facing strings are needed.
--
-- Idempotent (CREATE OR REPLACE). Bodies are reproduced VERBATIM from migs 190 /
-- 142 / 152 with only the guard block inserted at each dedup site. Deps: 053,
-- 142, 147 (can_view_case), 152, 190.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper: can the calling user already SEE this borrower?
--    TRUE iff the borrower is on at least one case the caller can_view. DEFINER
--    so it reads every case_borrowers link regardless of that table's RLS, then
--    gates each linked case on can_view_case (which keys off auth.uid() — the
--    real caller, even inside a DEFINER function).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._caller_can_access_borrower(p_borrower_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.case_borrowers cb
     WHERE cb.borrower_id = p_borrower_id
       AND public.can_view_case(cb.case_id)
  );
$$;

REVOKE ALL ON FUNCTION public._caller_can_access_borrower(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._caller_can_access_borrower(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 1. save_borrower_for_case_full — guard the national_id reuse branch
--    (body verbatim from mig 190; guard added between the dedup SELECT and the
--     INSERT-or-error decision)
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

    -- ISS-02 cross-case PII guard: a national_id match may resolve to ANOTHER
    -- advisor's borrower. Only reuse it when the caller can already SEE that
    -- person — otherwise refuse, so the global dedup can't harvest/tamper a
    -- stranger's PII.
    IF v_borrower_id IS NOT NULL
       AND NOT public._caller_can_access_borrower(v_borrower_id) THEN
      RAISE EXCEPTION 'borrower with this national_id is not accessible to the caller'
        USING ERRCODE = '42501';
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
-- 2. create_case_draft — guard the national_id reuse branch
--    (body verbatim from mig 142; guard added between the dedup SELECT and the
--     INSERT/ELSE-overwrite decision, so an inaccessible match is refused before
--     it can be linked OR have its contact fields overwritten)
-- -----------------------------------------------------------------------------
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

    IF v_role NOT IN ('borrower', 'guarantor', 'rights_owner', 'mortgaging_borrower') THEN
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

    -- ISS-02 cross-case PII guard: refuse a national_id match the caller cannot
    -- already SEE, before it is linked to this case OR has its contact fields
    -- overwritten below. (A match created earlier in THIS draft is already on
    -- v_case_id, which the caller can view as its creator/responsible advisor.)
    IF v_borrower_id IS NOT NULL
       AND NOT public._caller_can_access_borrower(v_borrower_id) THEN
      RAISE EXCEPTION 'borrower with this national_id is not accessible to the caller'
        USING ERRCODE = '42501';
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
  'Creates a case draft with borrowers atomically; default status is case_opened. role_in_case accepts all 4 values (migration 142). national_id reuse is gated on caller access (migration 201, ISS-02).';

-- -----------------------------------------------------------------------------
-- 3. convert_lead_to_case — guard BOTH national_id reuse branches (rich + simple)
--    (body verbatim from mig 152; a guard added after each dedup SELECT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_lead_to_case(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- IDOR guard: only convert a lead you are allowed to SEE (mirrors leads_select).
  IF NOT (
    public.has_permission('view_all_leads')
    OR (public.has_permission('view_own_leads') AND v_lead.assigned_to = v_actor)
  ) THEN
    RAISE EXCEPTION 'convert_lead_to_case: not authorized for lead %', p_lead_id USING ERRCODE = '42501';
  END IF;

  -- Status guard (migration 033): only "active" leads convert.
  IF v_lead.status IS NOT NULL AND v_lead.status <> 'active' THEN
    RAISE EXCEPTION 'convert_lead_to_case: lead % is not active (status=%)',
      p_lead_id, v_lead.status USING ERRCODE = '22023';
  END IF;

  -- New cases open on 'case_opened' (the 'lead' status was dropped in 086).
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

      -- Reuse an existing borrower by national_id (returning client).
      v_borrower_id := NULL;
      IF v_national_id IS NOT NULL THEN
        SELECT id INTO v_borrower_id
          FROM public.borrowers
         WHERE national_id = v_national_id AND deleted_at IS NULL
         LIMIT 1;
      END IF;

      -- ISS-02 cross-case PII guard: refuse a national_id match the converting
      -- staff member cannot already SEE (a malicious lead could carry a victim's
      -- national_id to harvest their borrower record on convert).
      IF v_borrower_id IS NOT NULL
         AND NOT public._caller_can_access_borrower(v_borrower_id) THEN
        RAISE EXCEPTION 'borrower with this national_id is not accessible to the caller'
          USING ERRCODE = '42501';
      END IF;

      IF v_borrower_id IS NULL THEN
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
      END IF;

      INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
      VALUES (v_case_id, v_borrower_id, 'borrower', v_idx = 1)
      ON CONFLICT (case_id, borrower_id) DO NOTHING;

      -- Income snapshot from the questionnaire (one row per borrower who gave one).
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
    -- ========== SIMPLE PATH: manual lead — byte-identical to migration 124 ====
    IF v_lead.national_id IS NOT NULL THEN
      SELECT id INTO v_borrower_id
        FROM public.borrowers
       WHERE national_id = v_lead.national_id
         AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    -- ISS-02 cross-case PII guard (simple path): same refusal for a lead whose
    -- top-level national_id matches a borrower the converting staff can't see.
    IF v_borrower_id IS NOT NULL
       AND NOT public._caller_can_access_borrower(v_borrower_id) THEN
      RAISE EXCEPTION 'borrower with this national_id is not accessible to the caller'
        USING ERRCODE = '42501';
    END IF;

    IF v_borrower_id IS NULL THEN
      INSERT INTO public.borrowers (
        first_name, last_name, national_id, phone, email, created_by, updated_by
      ) VALUES (
        v_lead.first_name, v_lead.last_name, v_lead.national_id,
        v_lead.phone, v_lead.email, v_actor, v_actor
      )
      RETURNING id INTO v_borrower_id;
    END IF;

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
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_case(UUID) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (201) ON CONFLICT DO NOTHING;

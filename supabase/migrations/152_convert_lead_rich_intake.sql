-- =============================================================================
-- Migration 152: lead→case conversion imports the full public-intake payload
-- =============================================================================
-- A lead created by the public /check questionnaire (migration 151) carries the
-- WHOLE questionnaire in leads.metadata->'payload' (every borrower, property,
-- income, the story). The convert RPC (migration 124) only ever lifted the lead's
-- top-level contact columns into a single primary borrower, so converting a web
-- lead threw away borrower #2, all the personal/employment detail, the property
-- figures and the incomes — the office had to re-key it from the metadata blob.
--
-- This adds a RICH branch: when metadata->'payload' is a valid intake object,
-- create the case WITH its property/financial fields and loop every payload
-- borrower (full personal + employment fields, national_id dedup) + an income
-- row per borrower that reported one. Manual leads (no payload) take the SIMPLE
-- branch, which is BYTE-IDENTICAL to migration 124 — existing conversions are
-- unchanged. Field names/casts mirror the proven create_case_draft RPC (142).
--
-- Signature unchanged → no code/deploy change; the existing convert-lead action
-- just gets richer output. Idempotent (CREATE OR REPLACE). The rich path only
-- triggers for FUTURE web-intake leads, so installing this never touches existing
-- data. Dependencies: 124 (prior body), 142 (borrower-insert pattern),
-- 151 (payload shape), 143 (schema_version).
-- =============================================================================

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

INSERT INTO public.schema_version (version) VALUES (152) ON CONFLICT DO NOTHING;

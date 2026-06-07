-- =============================================================================
-- Migration 151: public client-intake questionnaire -> lead
-- =============================================================================
-- The public onboarding questionnaire at /check is filled by PROSPECTS with no
-- account (Supabase role = `anon`). It must create a lead so the office sees it
-- in the existing /leads pipeline ("becomes a lead"), WITHOUT opening the core
-- `leads` table to broad anonymous INSERT.
--
-- Pattern (same as convert_lead_to_case / create_case_draft): a SECURITY DEFINER
-- RPC is the ONLY door. It runs as the function owner, so it bypasses the
-- leads_insert RLS (which requires authenticated + create_lead) in a single,
-- auditable, input-validated entry point. The TS server action rate-limits by IP
-- and screens a honeypot BEFORE calling this; the RPC still re-checks shape
-- because it is anon-callable and must not trust its caller.
--
-- The full questionnaire (every borrower, property, income, the free-text story)
-- is stored verbatim in leads.metadata->'payload' so nothing the prospect typed
-- is lost; the top-level lead columns get the primary borrower's contact details
-- so the lead is immediately searchable/usable.
--
-- Idempotent (CREATE OR REPLACE). Dependencies: 005 (leads), 083/086 lead status,
-- 143 (schema_version).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_public_intake(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrowers jsonb;
  v_primary   jsonb;
  v_first     text;
  v_last      text;
  v_phone     text;
  v_email     text;
  v_nat_id    text;
  v_lead_id   uuid;
BEGIN
  -- Defense-in-depth: the action validated with Zod, but anon can call this RPC
  -- directly, so refuse anything that is not a sane, bounded JSON object.
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'submit_public_intake: payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  -- Cap raw size so a hostile caller cannot stuff arbitrarily large blobs into
  -- the leads table through the anon door. ~64KB is far above any real form.
  IF length(p_payload::text) > 65536 THEN
    RAISE EXCEPTION 'submit_public_intake: payload too large'
      USING ERRCODE = '22023';
  END IF;

  v_borrowers := p_payload -> 'borrowers';
  IF v_borrowers IS NULL
     OR jsonb_typeof(v_borrowers) <> 'array'
     OR jsonb_array_length(v_borrowers) < 1
     OR jsonb_array_length(v_borrowers) > 4 THEN
    RAISE EXCEPTION 'submit_public_intake: between 1 and 4 borrowers required'
      USING ERRCODE = '22023';
  END IF;

  -- Primary borrower = first element. Lift the columns the leads table holds so
  -- the lead is usable on its own; the rest lives in metadata.
  v_primary := v_borrowers -> 0;
  v_first  := NULLIF(btrim(v_primary ->> 'first_name'), '');
  v_last   := NULLIF(btrim(v_primary ->> 'last_name'), '');
  v_phone  := NULLIF(btrim(v_primary ->> 'phone'), '');
  v_email  := NULLIF(btrim(v_primary ->> 'email'), '');
  v_nat_id := NULLIF(btrim(v_primary ->> 'national_id'), '');

  IF v_first IS NULL THEN
    RAISE EXCEPTION 'submit_public_intake: primary borrower first_name required'
      USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'submit_public_intake: a phone or email is required'
      USING ERRCODE = '22023';
  END IF;

  -- created_by / assigned_to stay NULL: there is no acting user. status defaults
  -- to 'active' so it shows in the leads list right away.
  INSERT INTO public.leads (
    first_name, last_name, phone, email, national_id, notes,
    assigned_to, created_by, updated_by, metadata
  ) VALUES (
    v_first, v_last, v_phone, v_email, v_nat_id,
    NULLIF(btrim(p_payload ->> 'request_details'), ''),
    NULL, NULL, NULL,
    jsonb_build_object(
      'source', 'public_intake',
      'submitted_at', now(),
      'payload', p_payload
    )
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

-- anon = the role a logged-out prospect's request runs as. authenticated kept so
-- a staff member previewing the public form also works.
REVOKE ALL ON FUNCTION public.submit_public_intake(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_intake(jsonb) TO anon, authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (151) ON CONFLICT DO NOTHING;

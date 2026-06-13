-- =============================================================================
-- Migration 175: record the correct legal basis per intake source (R4-legal-2)
-- =============================================================================
-- The landing contact form (web_contact) has NO consent checkbox — only a
-- passive submit-time notice — yet it was routed through submit_public_intake,
-- which UNCONDITIONALLY wrote a first-class affirmative consent record
-- (metadata.consent.agreed = true with a policy_version). That over-asserts a
-- consent the prospect never explicitly gave.
--
-- Fix: a new p_source param tells the RPC the basis:
--   - 'public_intake' (/check): UNCHANGED — requires payload consent = true and
--     writes metadata.consent { agreed:true, policy_version, recorded_at, ip,
--     locale }. The explicit /check consent stays exactly as-is.
--   - 'web_contact'  (landing): does NOT require/keep an affirmative consent.
--     Writes an accurate metadata.privacy_notice { policy_version, recorded_at,
--     source, ip, locale } and STRIPS the synthesized `consent` flag from the
--     stored payload, so no agreed=true is persisted anywhere.
-- metadata.source is set to the basis ('public_intake' | 'web_contact') so the
-- leads list can tell a contact-form lead from a questionnaire (R4-xcut-1).
--
-- Signature change (added p_source) → drop the 3-arg overload and recreate, then
-- re-apply the migration-166 service_role lockdown for the new signature.
--
-- Idempotent. Dependencies: 154 (prior body), 166 (lockdown), 005, 028, 143.
-- =============================================================================

DROP FUNCTION IF EXISTS public.submit_public_intake(jsonb, text, text);

CREATE OR REPLACE FUNCTION public.submit_public_intake(
  p_payload        jsonb,
  p_policy_version text DEFAULT NULL,
  p_ip             text DEFAULT NULL,
  p_source         text DEFAULT 'public_intake'
)
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
  -- Normalize the basis: anything other than 'web_contact' is the default
  -- affirmative-consent questionnaire path.
  v_source        text := CASE WHEN p_source = 'web_contact' THEN 'web_contact' ELSE 'public_intake' END;
  v_basis         jsonb;
  v_stored_payload jsonb;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'submit_public_intake: payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF length(p_payload::text) > 65536 THEN
    RAISE EXCEPTION 'submit_public_intake: payload too large'
      USING ERRCODE = '22023';
  END IF;

  -- Affirmative consent is mandatory and DB-enforced ONLY for the /check
  -- questionnaire. web_contact is submitted under a passive notice (recorded as
  -- a privacy_notice below), so it does not carry an explicit consent.
  IF v_source = 'public_intake' AND (p_payload ->> 'consent') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'submit_public_intake: privacy consent is required'
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

  -- Basis record + stored payload differ by source. web_contact gets an honest
  -- privacy_notice (no agreed=true) and the synthesized consent flag is removed
  -- from the stored payload; /check keeps its affirmative consent record verbatim.
  IF v_source = 'web_contact' THEN
    v_basis := jsonb_build_object(
      'privacy_notice', jsonb_build_object(
        'policy_version', p_policy_version,
        'recorded_at', now(),
        'source', 'web_contact',
        'ip', p_ip,
        'locale', p_payload ->> 'locale'
      )
    );
    v_stored_payload := p_payload - 'consent';
  ELSE
    v_basis := jsonb_build_object(
      'consent', jsonb_build_object(
        'agreed', true,
        'policy_version', p_policy_version,
        'recorded_at', now(),
        'ip', p_ip,
        'locale', p_payload ->> 'locale'
      )
    );
    v_stored_payload := p_payload;
  END IF;

  INSERT INTO public.leads (
    first_name, last_name, phone, email, national_id, notes,
    assigned_to, created_by, updated_by, metadata
  ) VALUES (
    v_first, v_last, v_phone, v_email, v_nat_id,
    NULLIF(btrim(p_payload ->> 'request_details'), ''),
    NULL, NULL, NULL,
    jsonb_build_object(
      'source', v_source,
      'submitted_at', now(),
      'payload', v_stored_payload
    ) || v_basis
  )
  RETURNING id INTO v_lead_id;

  -- Bell every active admin so a web lead never sits unseen (migration 153).
  INSERT INTO public.notifications (user_id, type, data)
  SELECT p.id, 'web_lead',
         jsonb_build_object(
           'leadName',
           NULLIF(btrim(coalesce(v_first, '') || ' ' || coalesce(v_last, '')), '')
         )
    FROM public.profiles p
    JOIN public.roles rr ON rr.id = p.role_id
   WHERE rr.key = 'admin' AND p.is_active = TRUE AND p.deleted_at IS NULL;

  RETURN v_lead_id;
END;
$$;

-- Re-apply the migration-166 lockdown for the new 4-arg signature: server-side
-- (service_role admin client) only; never anon/authenticated.
REVOKE ALL ON FUNCTION public.submit_public_intake(jsonb, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_intake(jsonb, text, text, text) TO service_role;

INSERT INTO public.schema_version (version) VALUES (175) ON CONFLICT DO NOTHING;

-- =============================================================================
-- Migration 154: record privacy-consent on a public-intake lead
-- =============================================================================
-- The /check questionnaire (151) already REQUIRES the prospect to tick a privacy
-- consent box (Zod consent: literal(true)) and the boolean rode along buried in
-- metadata.payload. That is not a defensible CONSENT RECORD: it lacks the policy
-- VERSION the prospect agreed to (the policy can change — see privacy policy §12),
-- an explicit recorded-at, and the originating IP. This migration upgrades the
-- submit RPC to:
--   1. Refuse a submission whose payload does not carry consent = true. The form
--      already enforces it, but anon can call this RPC directly, so the DB must
--      enforce it too (defense-in-depth, same posture as the other shape checks).
--   2. Write a first-class metadata.consent record:
--      { agreed, policy_version, recorded_at, ip, locale }.
-- The signature gains two trusted, server-supplied params (policy version + IP)
-- that the TS action passes; the 1-arg function from 151/153 is therefore dropped
-- and recreated. The body is otherwise migration 153 verbatim (lead insert +
-- admin 'web_lead' bell).
--
-- Idempotent. Dependencies: 153 (prior RPC body + notification type), 005 (leads),
-- 028 (notifications), 143 (schema_version).
-- =============================================================================

-- Signature change (added params) → drop the old overload so a 1-arg call can
-- never be ambiguous, then recreate.
DROP FUNCTION IF EXISTS public.submit_public_intake(jsonb);

CREATE OR REPLACE FUNCTION public.submit_public_intake(
  p_payload        jsonb,
  p_policy_version text DEFAULT NULL,
  p_ip             text DEFAULT NULL
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
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'submit_public_intake: payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF length(p_payload::text) > 65536 THEN
    RAISE EXCEPTION 'submit_public_intake: payload too large'
      USING ERRCODE = '22023';
  END IF;

  -- Consent is mandatory and DB-enforced. The form requires it, but anon can call
  -- this RPC directly, so a submission without an explicit consent = true is
  -- refused here too.
  IF (p_payload ->> 'consent') IS DISTINCT FROM 'true' THEN
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

  -- created_by / assigned_to stay NULL: there is no acting user. status defaults
  -- to 'active' so it shows in the leads list right away. The consent record is a
  -- sibling of payload so it is queryable without parsing the whole questionnaire.
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
      'consent', jsonb_build_object(
        'agreed', true,
        'policy_version', p_policy_version,
        'recorded_at', now(),
        'ip', p_ip,
        'locale', p_payload ->> 'locale'
      ),
      'payload', p_payload
    )
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

REVOKE ALL ON FUNCTION public.submit_public_intake(jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_intake(jsonb, text, text) TO anon, authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (154) ON CONFLICT DO NOTHING;

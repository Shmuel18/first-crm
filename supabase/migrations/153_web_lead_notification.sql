-- =============================================================================
-- Migration 153: bell notification to the office on a new public-intake lead
-- =============================================================================
-- A lead from the /check questionnaire (migration 151) landed silently in the
-- leads list — nobody knew until they happened to look. This adds an in-app bell
-- alert ('web_lead') to every active admin the moment a web lead is created,
-- mirroring the backup_stale pattern (migration 128). The submit RPC is the
-- creation point, so it raises the notifications there (SECURITY DEFINER → it can
-- write the locked-down notifications table directly).
--
-- Idempotent. Dependencies: 028 (notifications), 128/144 (type CHECK + admin
-- recipient pattern), 151 (submit_public_intake body), 143 (schema_version).
-- =============================================================================

-- 1) Allow the new notification type (re-state the FULL current set from mig 144).
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'task_completed',
    'case_status_overdue',
    'task_reminder',
    'case_mention',
    'task_mention',
    'backup_stale',
    'erasure_stale',
    'web_lead'
  ));

-- 2) Re-create submit_public_intake (mig 151 body) + the admin notification.
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
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'submit_public_intake: payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

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

  -- Bell every active admin so a web lead never sits unseen.
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

REVOKE ALL ON FUNCTION public.submit_public_intake(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_intake(jsonb) TO anon, authenticated;

INSERT INTO public.schema_version (version) VALUES (153) ON CONFLICT DO NOTHING;

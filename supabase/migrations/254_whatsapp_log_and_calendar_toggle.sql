-- 254 — WhatsApp sends in the case history + a separate calendar-reminder email toggle.
--
-- 1. client_email_log learns a channel. A WhatsApp send opens the advisor's own
--    WhatsApp with the text ready; the system cannot see whether they then
--    pressed send, so the row records what it DOES know: who opened a send to
--    whom, when, and with what text. The feed words it as "opened a WhatsApp
--    send", not "sent". Covers client messages, document requests and the new
--    'professional_message' (appraiser / lawyer / insurance agent, mig 252).
--    WhatsApp rows carry recipient_phone instead of recipient_email.
--
-- 2. notification_preferences.email_calendar_reminder — calendar reminders
--    (mig 253) got their own email switch instead of riding the task-reminder
--    one. save_notification_settings gains the param (DEFAULT TRUE, so the
--    client deployed before this migration keeps working); the old 6-arg
--    overload is dropped so PostgREST never sees an ambiguous call (same as 161).

-- -----------------------------------------------------------------------------
-- 1. Channel on the send log
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_email_log
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

ALTER TABLE public.client_email_log
  ALTER COLUMN recipient_email DROP NOT NULL;

ALTER TABLE public.client_email_log
  DROP CONSTRAINT IF EXISTS client_email_log_channel_check;
ALTER TABLE public.client_email_log
  ADD CONSTRAINT client_email_log_channel_check
  CHECK (
    (channel = 'email' AND recipient_email IS NOT NULL)
    OR (channel = 'whatsapp' AND recipient_phone IS NOT NULL)
  );

ALTER TABLE public.client_email_log
  DROP CONSTRAINT IF EXISTS client_email_log_kind_check;
ALTER TABLE public.client_email_log
  ADD CONSTRAINT client_email_log_kind_check
  CHECK (kind IN ('advisor_message', 'document_request', 'agreement_sign_request', 'professional_message'));

COMMENT ON COLUMN public.client_email_log.channel IS
  'email = sent by the server; whatsapp = a WhatsApp send the advisor OPENED '
  '(wa.me) — the system cannot confirm it was sent. Migration 254.';

-- -----------------------------------------------------------------------------
-- 2. Calendar-reminder email toggle
-- -----------------------------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_calendar_reminder BOOLEAN NOT NULL DEFAULT TRUE;

DROP FUNCTION IF EXISTS public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE FUNCTION public.save_notification_settings(
  p_email_task_assigned BOOLEAN,
  p_email_task_completed BOOLEAN,
  p_sla JSONB DEFAULT NULL,
  p_email_mentions BOOLEAN DEFAULT TRUE,
  p_email_task_reminder BOOLEAN DEFAULT TRUE,
  p_email_case_status_overdue BOOLEAN DEFAULT TRUE,
  p_email_calendar_reminder BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_existing JSONB;
  v_merged JSONB;
  v_clear_keys TEXT[];
  v_set_patch JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- ── 1. Email preferences (everyone) ──────────────────────────────────
  INSERT INTO public.notification_preferences (
    user_id, email_task_assigned, email_task_completed,
    email_mentions, email_task_reminder, email_case_status_overdue,
    email_calendar_reminder
  ) VALUES (
    v_actor, p_email_task_assigned, p_email_task_completed,
    p_email_mentions, p_email_task_reminder, p_email_case_status_overdue,
    p_email_calendar_reminder
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email_task_assigned = EXCLUDED.email_task_assigned,
        email_task_completed = EXCLUDED.email_task_completed,
        email_mentions = EXCLUDED.email_mentions,
        email_task_reminder = EXCLUDED.email_task_reminder,
        email_case_status_overdue = EXCLUDED.email_case_status_overdue,
        email_calendar_reminder = EXCLUDED.email_calendar_reminder,
        updated_at = now();

  -- ── 2. SLA thresholds (admin only) — unchanged from migration 071 ────
  IF p_sla IS NOT NULL THEN
    v_is_admin := public.is_admin();
    IF NOT v_is_admin THEN
      RETURN;
    END IF;

    IF jsonb_typeof(p_sla) <> 'object' THEN
      RAISE EXCEPTION 'p_sla must be a JSON object' USING ERRCODE = '22023';
    END IF;

    SELECT sla_status_thresholds INTO v_existing
      FROM public.office_settings
     WHERE id = 1
     FOR UPDATE;

    v_clear_keys := ARRAY(
      SELECT k FROM jsonb_each(p_sla) AS x(k, v) WHERE v = 'null'::jsonb
    );
    v_set_patch := jsonb_strip_nulls(p_sla);
    v_merged := (COALESCE(v_existing, '{}'::jsonb) - v_clear_keys) || v_set_patch;

    UPDATE public.office_settings
       SET sla_status_thresholds = v_merged,
           updated_by = v_actor
     WHERE id = 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'office_settings id=1 row missing' USING ERRCODE = 'P0002';
    END IF;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN)
  TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (254) ON CONFLICT DO NOTHING;

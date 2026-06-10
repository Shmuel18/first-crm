-- =============================================================================
-- Migration 161: email mirrors for mention / reminder / SLA notifications
-- =============================================================================
-- The bell already covers case_mention, task_mention, task_reminder and
-- case_status_overdue; this adds per-user EMAIL toggles for them (defaulting
-- on, like the existing task_assigned/completed pair). The actual sending
-- rides the notifications-insert webhook (/api/push/dispatch).
--
-- save_notification_settings gains the three new params. The old 3-param
-- overload is DROPPED (not kept alongside) — PostgREST would otherwise see an
-- ambiguous call for the currently-deployed 3-arg client. The new params
-- carry DEFAULT TRUE so that same deployed client keeps working until the
-- code deploy lands.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_mentions BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_task_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_case_status_overdue BOOLEAN NOT NULL DEFAULT TRUE;

DROP FUNCTION IF EXISTS public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB);

CREATE FUNCTION public.save_notification_settings(
  p_email_task_assigned BOOLEAN,
  p_email_task_completed BOOLEAN,
  p_sla JSONB DEFAULT NULL,
  p_email_mentions BOOLEAN DEFAULT TRUE,
  p_email_task_reminder BOOLEAN DEFAULT TRUE,
  p_email_case_status_overdue BOOLEAN DEFAULT TRUE
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
    email_mentions, email_task_reminder, email_case_status_overdue
  ) VALUES (
    v_actor, p_email_task_assigned, p_email_task_completed,
    p_email_mentions, p_email_task_reminder, p_email_case_status_overdue
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email_task_assigned = EXCLUDED.email_task_assigned,
        email_task_completed = EXCLUDED.email_task_completed,
        email_mentions = EXCLUDED.email_mentions,
        email_task_reminder = EXCLUDED.email_task_reminder,
        email_case_status_overdue = EXCLUDED.email_case_status_overdue,
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

REVOKE ALL ON FUNCTION public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN)
  TO authenticated;

INSERT INTO public.schema_version (version) VALUES (161) ON CONFLICT DO NOTHING;

-- 255 — tell the owner when someone records an office expense on a case.
--
-- Kaufman (2026-10-29): whenever anyone enters an expense in a case's מנהלה
-- block, he wants to know — in the bell and by email. An expense row is
-- created EMPTY and filled inline (create-empty-expense → update-expense-field),
-- so the alert fires when the AMOUNT is first set, not on the blank insert;
-- later edits of the same expense stay quiet. A database trigger, so every
-- write path (inline edit, future import, AI action) is covered.
--
-- Recipients: every active owner (profiles.is_owner, migs 240–242) except the
-- person who entered it. The email rides the existing notifications-insert
-- webhook mirror, behind a new per-user switch (email_expense_added).

-- -----------------------------------------------------------------------------
-- 1. Bell kind
-- -----------------------------------------------------------------------------
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
    'web_lead',
    'task_comment',
    'ai_digest',
    'calendar_reminder',
    'expense_added'
  ));

-- -----------------------------------------------------------------------------
-- 2. The trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_expense_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := COALESCE(NEW.updated_by, NEW.created_by);
  v_actor_name TEXT;
BEGIN
  IF NEW.amount IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.amount IS NOT NULL THEN
    RETURN NULL; -- an edit of an expense already reported
  END IF;

  SELECT NULLIF(btrim(concat_ws(' ', first_name, last_name)), '')
    INTO v_actor_name
    FROM public.profiles
   WHERE id = v_actor;

  INSERT INTO public.notifications (user_id, actor_id, type, case_id, data)
  SELECT p.id,
         v_actor,
         'expense_added',
         NEW.case_id,
         jsonb_build_object(
           'amount', NEW.amount,
           'description', NEW.description,
           'actorName', v_actor_name,
           'caseLabel', public.notification_case_label(NEW.case_id)
         )
    FROM public.profiles p
   WHERE p.is_owner = TRUE
     AND COALESCE(p.is_active, TRUE)
     AND p.id IS DISTINCT FROM v_actor;

  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_expense_added() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_case_expenses_notify_added ON public.case_expenses;
CREATE TRIGGER trg_case_expenses_notify_added
  AFTER INSERT OR UPDATE OF amount ON public.case_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_expense_added();

-- -----------------------------------------------------------------------------
-- 3. Email switch (same pattern as 254)
-- -----------------------------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_expense_added BOOLEAN NOT NULL DEFAULT TRUE;

DROP FUNCTION IF EXISTS public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE FUNCTION public.save_notification_settings(
  p_email_task_assigned BOOLEAN,
  p_email_task_completed BOOLEAN,
  p_sla JSONB DEFAULT NULL,
  p_email_mentions BOOLEAN DEFAULT TRUE,
  p_email_task_reminder BOOLEAN DEFAULT TRUE,
  p_email_case_status_overdue BOOLEAN DEFAULT TRUE,
  p_email_calendar_reminder BOOLEAN DEFAULT TRUE,
  p_email_expense_added BOOLEAN DEFAULT TRUE
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
    email_calendar_reminder, email_expense_added
  ) VALUES (
    v_actor, p_email_task_assigned, p_email_task_completed,
    p_email_mentions, p_email_task_reminder, p_email_case_status_overdue,
    p_email_calendar_reminder, p_email_expense_added
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email_task_assigned = EXCLUDED.email_task_assigned,
        email_task_completed = EXCLUDED.email_task_completed,
        email_mentions = EXCLUDED.email_mentions,
        email_task_reminder = EXCLUDED.email_task_reminder,
        email_case_status_overdue = EXCLUDED.email_case_status_overdue,
        email_calendar_reminder = EXCLUDED.email_calendar_reminder,
        email_expense_added = EXCLUDED.email_expense_added,
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

REVOKE ALL ON FUNCTION public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN)
  TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (255) ON CONFLICT DO NOTHING;

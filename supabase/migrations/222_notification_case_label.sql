-- =============================================================================
-- Migration 222: every case-linked notification carries WHICH CLIENT it's about
-- =============================================================================
-- Client feedback (27.7.2026): "לא רואים על איזה תיק מדובר … צריך שיהיה רשום על
-- איזה לקוח מדובר" — a mention/comment notification (bell + its email mirror)
-- showed only the actor, the task title and a body preview. With ~80 open cases
-- the recipient can't tell which client is being discussed without opening the
-- app and hunting for the task.
--
-- Migration 181 already solved this for ONE kind (task_completed) by snapshotting
-- a `caseLabel` — "#<case_number> · <primary borrower>" — into the notification's
-- data payload. This migration extends the same snapshot to every remaining
-- case-linked kind produced by a trigger:
--   * task_assigned          (notify_task_change, all three insert branches)
--   * case_mention           (notify_case_comment_mentions)
--   * task_mention           (notify_task_comment_mentions)
--   * task_comment           (notify_task_comment_assignee)
-- task_reminder + case_status_overdue are produced in TypeScript (the crons) and
-- get the same field there.
--
-- The label expression is factored out of mig 181 into a helper,
-- notification_case_label(), so the four triggers stay in sync. It is deliberately
-- NOT granted to `authenticated` — it is a trigger-internal helper, and exposing
-- it over PostgREST would hand any signed-in user a case-number → client-name
-- oracle for arbitrary case ids.
--
-- Privacy note: the label rides the same row as the task title + comment preview,
-- and the recipient set is unchanged — mig 194 already gates mention rows on
-- can_view_case_for / can_view_task_for, and a task recipient is by construction
-- the task's assignee/assigner/creator (or holds view_all_cases). So this adds
-- no new recipient, only context they are already entitled to.
--
-- Trigger bodies are reproduced VERBATIM from their current definitions — 218
-- (notify_task_change), 194 (both mention triggers), 185 (comment→assignee) —
-- with only the caseLabel addition. Do NOT rebase onto older copies.
-- Idempotent (CREATE OR REPLACE). Deps: 218, 194, 185, 181, 143 (schema_version).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Shared label helper — "#1042 · יעקב כהן" (NULL case id / unknown case → NULL)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_case_label(p_case_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '#' || c.case_number ||
         COALESCE(
           ' · ' || NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), ''),
           ''
         )
    FROM public.cases c
    LEFT JOIN public.borrowers b ON b.id = c.primary_borrower_id
   WHERE c.id = p_case_id;
$$;

-- Trigger-internal only: no PostgREST surface (see header).
REVOKE ALL ON FUNCTION public.notification_case_label(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.notification_case_label(UUID) IS
  'Notification context label "#<case_number> · <primary borrower>" (mig 222). Internal to the notification triggers — intentionally not granted to authenticated.';

-- -----------------------------------------------------------------------------
-- 2. Task bell notifications — add caseLabel to the task_assigned branches
--    (body from mig 218; task_completed keeps its label, now via the helper)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  actor_name TEXT;
  assignment_kind TEXT;
  completion_recipient UUID;
  case_label TEXT;
  task_desc TEXT;
  -- Scheduled delivery (mig 218): parked for a future hand-off, so the
  -- assignee must NOT be pinged yet — the task-reminders cron delivers it.
  v_scheduled BOOLEAN := (
    NEW.status = 'snoozed'
    AND NEW.snoozed_until IS NOT NULL
    AND NEW.snoozed_until > now()
  );
BEGIN
  IF current_setting('app.restoring_backup', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
    INTO actor_name
    FROM public.profiles
   WHERE id = actor;

  -- Which client this task belongs to (mig 222) — NULL for an office task.
  case_label := public.notification_case_label(NEW.case_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to IS DISTINCT FROM actor
       AND NOT v_scheduled THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority,
          'assignmentKind', 'assigned',
          'caseLabel', case_label
        )
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       AND NEW.assigned_to IS NOT NULL
       AND (NEW.assigned_to IS DISTINCT FROM actor OR NEW.priority = 'critical')
       AND NOT v_scheduled THEN
      assignment_kind := CASE
        WHEN NEW.created_by IS NOT NULL
         AND NEW.assigned_to IS NOT DISTINCT FROM NEW.created_by
         AND OLD.assigned_to IS DISTINCT FROM NEW.created_by
          THEN 'returned_to_creator'
        ELSE 'reassigned'
      END;

      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority,
          'assignmentKind', assignment_kind,
          'caseLabel', case_label
        )
      );
    ELSIF NEW.priority = 'critical'
       AND OLD.priority IS DISTINCT FROM 'critical'
       AND NEW.status IN ('pending', 'in_progress')
       AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority,
          'caseLabel', case_label
        )
      );
    END IF;

    completion_recipient := COALESCE(NEW.assigned_by, NEW.created_by);
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
       AND completion_recipient IS NOT NULL
       AND completion_recipient IS DISTINCT FROM actor THEN
      task_desc := NULLIF(TRIM(COALESCE(NEW.description, '')), '');
      IF task_desc IS NOT NULL AND length(task_desc) > 200 THEN
        task_desc := LEFT(task_desc, 200) || '…';
      END IF;

      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        completion_recipient, 'task_completed', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority,
          'caseLabel', case_label,
          'description', task_desc
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_task_change() IS
  'Task bell notifications. task_assigned is suppressed while a task is scheduled (status=snoozed + future snoozed_until, mig 218) — the task-reminders cron delivers it via task_reminder at the scheduled time. Every payload carries caseLabel (mig 222).';

-- -----------------------------------------------------------------------------
-- 3. Case-comment @-mentions (body from mig 194 + caseLabel)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_case_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := NEW.author_id;
  actor_name TEXT;
  mentioned_id UUID;
  preview TEXT;
  case_label TEXT;
BEGIN
  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  preview := left(
    regexp_replace(NEW.body, '@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)', '@\1', 'g'),
    140
  );

  case_label := public.notification_case_label(NEW.case_id);

  FOR mentioned_id IN
    SELECT DISTINCT (m[1])::uuid
    FROM regexp_matches(
      NEW.body,
      '@\[[^\]]+\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
      'g'
    ) AS m
  LOOP
    -- Skip self, inactive/unknown users, AND anyone who can't view this case
    -- (else the bell + email mirror leak a comment preview cross-case).
    IF mentioned_id <> actor
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = mentioned_id AND p.is_active)
       AND public.can_view_case_for(mentioned_id, NEW.case_id) THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        mentioned_id, 'case_mention', NULL, NEW.case_id, actor,
        jsonb_build_object(
          'actorName', actor_name,
          'preview', preview,
          'commentId', NEW.id,
          'caseLabel', case_label
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Task-comment @-mentions (body from mig 194 + caseLabel)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_task_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := NEW.author_id;
  actor_name TEXT;
  mentioned_id UUID;
  preview TEXT;
  task_title TEXT;
  task_case_id UUID;
  case_label TEXT;
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'comment' THEN
    RETURN NEW;
  END IF;

  SELECT t.title, t.case_id
  INTO task_title, task_case_id
  FROM public.tasks t
  WHERE t.id = NEW.task_id
    AND t.deleted_at IS NULL;

  IF task_title IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  preview := left(
    regexp_replace(NEW.body, '@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)', '@\1', 'g'),
    140
  );

  case_label := public.notification_case_label(task_case_id);

  FOR mentioned_id IN
    SELECT DISTINCT (m[1])::uuid
    FROM regexp_matches(
      NEW.body,
      '@\[[^\]]+\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
      'g'
    ) AS m
  LOOP
    -- Skip self, inactive/unknown users, AND anyone who can't view this task
    -- (else the bell + email mirror leak the task title + comment preview).
    IF mentioned_id <> actor
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = mentioned_id AND p.is_active)
       AND public.can_view_task_for(mentioned_id, NEW.task_id) THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        mentioned_id, 'task_mention', NEW.task_id, task_case_id, actor,
        jsonb_build_object(
          'actorName', actor_name,
          'taskTitle', task_title,
          'preview', preview,
          'commentId', NEW.id,
          'caseLabel', case_label
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Task comment → assignee (body from mig 185 + caseLabel)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_task_comment_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := NEW.author_id;
  actor_name TEXT;
  recipient UUID;
  preview TEXT;
  task_title TEXT;
  task_case_id UUID;
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'comment' THEN
    RETURN NEW;
  END IF;

  SELECT t.title, t.case_id, t.assigned_to
  INTO task_title, task_case_id, recipient
  FROM public.tasks t
  WHERE t.id = NEW.task_id
    AND t.deleted_at IS NULL;

  -- Task missing/deleted, unassigned, or the author is the assignee → nothing.
  IF task_title IS NULL OR recipient IS NULL OR recipient = actor THEN
    RETURN NEW;
  END IF;

  -- Dedup: if the assignee is @-mentioned in this same comment, the mention
  -- trigger (134) already notifies them (task_mention) — don't double-notify.
  IF NEW.body ~ ('@\[[^\]]+\]\(' || recipient::text || '\)') THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  preview := left(
    regexp_replace(NEW.body, '@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)', '@\1', 'g'),
    140
  );

  INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
  VALUES (
    recipient, 'task_comment', NEW.task_id, task_case_id, actor,
    jsonb_build_object(
      'actorName', actor_name,
      'taskTitle', task_title,
      'preview', preview,
      'commentId', NEW.id,
      'caseLabel', public.notification_case_label(task_case_id)
    )
  );

  RETURN NEW;
END;
$$;

INSERT INTO public.schema_version (version) VALUES (222) ON CONFLICT DO NOTHING;

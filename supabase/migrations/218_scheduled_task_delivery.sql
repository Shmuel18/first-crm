-- =============================================================================
-- Migration 218: scheduled task delivery — don't ping the assignee before the
--                task is actually delivered to them.
-- =============================================================================
-- A manager wants to write a task NOW but have it reach the employee at a set
-- time ("send now, arrives Sunday 08:00"). The delivery half already exists:
-- a task parked in status='snoozed' with a future snoozed_until is resurfaced
-- to 'pending' by the task-reminders cron (every 15 min), which inserts a
-- task_reminder notification for assigned_to — and that kind is email-mirrored
-- (mig 161 email_task_reminder, default TRUE). So the cron IS the delivery.
--
-- The missing half: notify_task_change fires task_assigned on INSERT the moment
-- the row lands, so the employee got the bell immediately — exactly what the
-- scheduling is meant to prevent. (The matching EMAIL is sent by the server
-- action, which is gated separately in create-task.ts / update-task.ts.)
--
-- Fix: suppress the task_assigned bell while a task is SCHEDULED — i.e. sitting
-- in status='snoozed' with snoozed_until still in the future. Applies to:
--   - INSERT: a task created pre-scheduled → no bell now; the cron delivers it.
--   - UPDATE: reassigning a still-scheduled task → the NEW assignee is notified
--     by the cron at delivery time, not now.
-- The 'critical priority' UPDATE branch already requires status IN
-- ('pending','in_progress'), so a scheduled task can't trip it — left as-is.
-- The cron's own resurface (status→pending, snoozed_until→NULL) does not change
-- assigned_to, so it never enters these branches: delivery stays the cron's
-- task_reminder, exactly as before this migration.
--
-- NOT affected: task_completed (a scheduled task isn't completed), and manual
-- snooze of an already-delivered task (the assignee was notified on assignment;
-- re-snoozing doesn't re-notify today either).
--
-- Body reproduced VERBATIM from migration 181 (the current definition — do NOT
-- rebase onto 159/132) with only the v_scheduled guard added.
-- Idempotent (CREATE OR REPLACE). Dependencies: 181, 098 (snoozed_until),
-- 143 (schema_version).
-- =============================================================================

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
          'assignmentKind', 'assigned'
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
          'assignmentKind', assignment_kind
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
          'priority', NEW.priority
        )
      );
    END IF;

    completion_recipient := COALESCE(NEW.assigned_by, NEW.created_by);
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
       AND completion_recipient IS NOT NULL
       AND completion_recipient IS DISTINCT FROM actor THEN
      -- Context so the assigner recognizes the task without opening it.
      IF NEW.case_id IS NOT NULL THEN
        SELECT '#' || c.case_number ||
               COALESCE(
                 ' · ' || NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), ''),
                 ''
               )
          INTO case_label
          FROM public.cases c
          LEFT JOIN public.borrowers b ON b.id = c.primary_borrower_id
         WHERE c.id = NEW.case_id;
      END IF;

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
  'Task bell notifications. task_assigned is suppressed while a task is scheduled (status=snoozed + future snoozed_until, mig 218) — the task-reminders cron delivers it via task_reminder at the scheduled time.';

INSERT INTO public.schema_version (version) VALUES (218) ON CONFLICT DO NOTHING;

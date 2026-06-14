-- =============================================================================
-- Migration 181: richer "task completed" notification
-- =============================================================================
-- When an assignee completes a task, the assigner (assigned_by, falling back to
-- created_by) gets a `task_completed` notification. It carried only taskTitle +
-- actorName, so a short/generic title ("השלמות") left the assigner unable to
-- recall WHICH task / for which client. Add two context fields to the payload:
--   - caseLabel:   "#<case_number> · <primary borrower name>" (when linked)
--   - description: the task description, capped at 200 chars (+ "…" if longer)
-- Bell + email mirror render them as a context line. Additive to the JSON
-- payload only; every other notification branch is byte-identical to mig 159.
--
-- Redefines notify_task_change based on the CURRENT (159) version — do not
-- rebase onto 132, which predates the assigned_by completion recipient.
-- Idempotent (CREATE OR REPLACE). Dependencies: 159, 028, 009 (tasks),
-- 002 (profiles/borrowers via cases), 143 (schema_version).
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
       AND NEW.assigned_to IS DISTINCT FROM actor THEN
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
       AND (NEW.assigned_to IS DISTINCT FROM actor OR NEW.priority = 'critical') THEN
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

INSERT INTO public.schema_version (version) VALUES (181) ON CONFLICT DO NOTHING;

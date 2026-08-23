-- =============================================================================
-- Migration 231: a task comment notifies everyone in the thread
-- =============================================================================
-- Since migration 185 a plain comment notified exactly one person: the task's
-- ASSIGNEE. So the manager who opened the task and assigned it heard nothing
-- when the advisor answered, and neither did anyone who had already replied in
-- the thread — the conversation only pinged in one direction.
--
-- The recipient set becomes every PARTICIPANT of the thread:
--   * the task's assignee,
--   * the task's creator (created_by),
--   * every earlier comment author on the same task,
-- minus:
--   * the comment's own author (no self-notification),
--   * anyone @-mentioned in this same comment — notify_task_comment_mentions
--     (134) already notifies them as task_mention, and two bells for one
--     comment is worse than one.
--
-- Bell rows are mirrored to email by the existing dispatch path, so this widens
-- both channels at once, and each recipient's own email preference still
-- applies (preferences.service maps task_comment → email_mentions).
--
-- Dependencies: 120 (task_comments), 134 (mention trigger), 185 (task_comment
--   notification type), 222 (caseLabel in the payload).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_task_comment_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := NEW.author_id;
  actor_name TEXT;
  preview TEXT;
  task_title TEXT;
  task_case_id UUID;
  task_assignee UUID;
  task_creator UUID;
  recipient UUID;
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'comment' THEN
    RETURN NEW;
  END IF;

  SELECT t.title, t.case_id, t.assigned_to, t.created_by
  INTO task_title, task_case_id, task_assignee, task_creator
  FROM public.tasks t
  WHERE t.id = NEW.task_id
    AND t.deleted_at IS NULL;

  -- Task missing or deleted → nothing to notify about.
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

  FOR recipient IN
    SELECT DISTINCT p.user_id
    FROM (
      SELECT task_assignee AS user_id
      UNION
      SELECT task_creator
      UNION
      SELECT c.author_id
        FROM public.task_comments c
       WHERE c.task_id = NEW.task_id
         AND c.id <> NEW.id
    ) p
    WHERE p.user_id IS NOT NULL
      AND p.user_id <> actor
      -- Dedup against the mention trigger for THIS comment.
      AND NEW.body !~ ('@\[[^\]]+\]\(' || p.user_id::text || '\)')
      -- Only people who still exist and are active; a removed member's bell
      -- would never be read and their email mirror would bounce.
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
         WHERE pr.id = p.user_id
           AND pr.deleted_at IS NULL
           AND pr.is_active
      )
  LOOP
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
  END LOOP;

  RETURN NEW;
END;
$$;

-- Swap the trigger over. The old function is left in place (unused) so a
-- rollback is a one-line trigger swap rather than a restore.
DROP TRIGGER IF EXISTS trg_notify_task_comment_assignee ON public.task_comments;
DROP TRIGGER IF EXISTS trg_notify_task_comment_participants ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment_participants
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment_participants();

INSERT INTO public.schema_version (version) VALUES (231) ON CONFLICT DO NOTHING;

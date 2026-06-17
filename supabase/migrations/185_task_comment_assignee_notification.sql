-- =============================================================================
-- Migration 185: notify the task assignee on any new comment (F12)
-- =============================================================================
-- Until now a plain task comment notified nobody — only an @-mention did
-- (notify_task_comment_mentions, migration 134). So commenting on a task
-- assigned to someone else left the assignee unaware. This adds a bell (+ email
-- mirror) to the task's ASSIGNEE on every new comment, except:
--   - the comment's author (no self-notification),
--   - an unassigned task (no recipient),
--   - when the assignee is already @-mentioned in the same comment (the 134
--     trigger already notifies them as task_mention — avoid double).
-- Reuses the task_mention data shape (actorName / taskTitle / preview / commentId).
-- Dependencies: 120 (task_comments), 134 (mention trigger + type CHECK), 153
--   (current full type set), 028 (notifications).
-- =============================================================================

-- 1) Allow the new notification type (re-state the FULL current set from mig 153).
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
    'task_comment'
  ));

-- 2) Trigger — notify the assignee on a free-text comment.
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
      'commentId', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_comment_assignee ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment_assignee
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment_assignee();

INSERT INTO public.schema_version (version) VALUES (185) ON CONFLICT DO NOTHING;

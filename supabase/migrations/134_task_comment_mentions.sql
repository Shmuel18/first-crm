-- =============================================================================
-- Migration 134: @-mention notifications for task comments
-- =============================================================================
-- Task threads use the same mention token contract as case comments:
--   @[Display Name](uuid)
-- On INSERT of a free-text task comment, notify every mentioned active teammate
-- except the author.
-- =============================================================================

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
    'backup_stale'
  ));

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

  FOR mentioned_id IN
    SELECT DISTINCT (m[1])::uuid
    FROM regexp_matches(
      NEW.body,
      '@\[[^\]]+\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
      'g'
    ) AS m
  LOOP
    IF mentioned_id <> actor
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = mentioned_id AND p.is_active) THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        mentioned_id, 'task_mention', NEW.task_id, task_case_id, actor,
        jsonb_build_object(
          'actorName', actor_name,
          'taskTitle', task_title,
          'preview', preview,
          'commentId', NEW.id
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_comment_mentions ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment_mentions
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment_mentions();

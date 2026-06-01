-- =============================================================================
-- Migration 108: @-mention notifications for case comments (spec phase 1.2)
-- =============================================================================
-- A comment body embeds mentions as `@[Display Name](uuid)` tokens. On INSERT
-- (not UPDATE — no re-ping on edit, by spec) a SECURITY DEFINER trigger parses
-- the body and drops a bell notification for each mentioned, active teammate
-- (excluding the author). Mirrors the notify_task_change pattern (028/089):
-- the notifications table has no user INSERT policy, so only a definer trigger
-- may create rows.
-- Dependencies: 028 (notifications), 098 (current type CHECK), 107 (case_comments)
-- =============================================================================

-- 1) Allow the new notification type (re-state the full set, per 068/098) -------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_assigned', 'task_completed', 'case_status_overdue', 'task_reminder', 'case_mention'));

-- 2) Trigger: parse mentions on a new comment and notify each mentioned user ---
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
BEGIN
  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  -- Human-readable preview: strip the @[name](uuid) tokens down to @name.
  preview := left(
    regexp_replace(NEW.body, '@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)', '@\1', 'g'),
    140
  );

  -- Distinct mentioned uuids. The strict uuid shape keeps the ::uuid cast safe
  -- against malformed/hand-typed tokens.
  FOR mentioned_id IN
    SELECT DISTINCT (m[1])::uuid
    FROM regexp_matches(
      NEW.body,
      '@\[[^\]]+\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
      'g'
    ) AS m
  LOOP
    -- Skip self-mentions and unknown/deactivated users (also avoids an FK
    -- violation that would roll back the comment insert).
    IF mentioned_id <> actor
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = mentioned_id AND p.is_active) THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        mentioned_id, 'case_mention', NULL, NEW.case_id, actor,
        jsonb_build_object('actorName', actor_name, 'preview', preview, 'commentId', NEW.id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_case_comment_mentions ON public.case_comments;
CREATE TRIGGER trg_notify_case_comment_mentions
  AFTER INSERT ON public.case_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_case_comment_mentions();

-- =============================================================================
-- Migration 215: enable Supabase Realtime for the case comments thread
-- =============================================================================
-- The "תיעוד" (documentation) thread is server-rendered and only optimistic for
-- the AUTHOR's own posts, so a comment written by ANOTHER user appeared on other
-- viewers' screens only after a manual page reload (reported: secretary Gitty
-- writes, secretary Kolman doesn't see it until refresh — not a permissions bug,
-- both can view the case). This adds case_comments to the realtime publication
-- so the client can live-refresh the thread the moment anyone posts/edits/deletes.
--
-- Realtime evaluates the case_comments SELECT RLS (can_view_case, mig 107) per
-- subscriber, so users only receive events for comments on cases they may view.
--
-- REPLICA IDENTITY FULL: the client subscribes with a case_id=eq.<id> filter. On
-- DELETE the default replica identity ships only the PK, so the old row would
-- lack case_id and a filtered subscription would MISS the delete. FULL puts
-- case_id into the old-row payload so a removed comment also propagates live.
-- case_comments is a low-write internal thread — FULL is cheap here.
--
-- Idempotent. Deps: 107 (case_comments), 149 (same publication pattern).
-- =============================================================================

ALTER TABLE public.case_comments REPLICA IDENTITY FULL;

DO $realtime$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'case_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_comments;
  END IF;
END $realtime$;

INSERT INTO public.schema_version (version) VALUES (215) ON CONFLICT DO NOTHING;

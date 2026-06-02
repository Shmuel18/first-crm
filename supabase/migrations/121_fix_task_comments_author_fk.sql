-- =============================================================================
-- Migration 121: repoint task_comments.author_id FK to profiles (fixes PGRST200)
-- =============================================================================
-- Migration 120 created task_comments.author_id REFERENCES auth.users(id).
-- The thread service embeds the author with PostgREST resource embedding:
--   .select('... author:profiles!task_comments_author_id_fkey (...)')
-- PostgREST can only embed `profiles` if there's an FK from task_comments to
-- public.profiles — but the FK pointed at auth.users, so every read failed with
-- PGRST200 ("could not find a relationship ... in the schema cache") and the
-- thread silently rendered empty.
--
-- This repoints the FK to public.profiles(id). It's the codebase convention
-- (tasks.assigned_to / created_by / updated_by all FK to profiles, not
-- auth.users) and is sound: profiles.id == auth.users.id (1:1), and author_id
-- is always auth.uid(), which always has a profile row. The constraint keeps
-- the SAME name so the embed hint `!task_comments_author_id_fkey` resolves.
--
-- Supabase auto-reloads the PostgREST schema cache on DDL, so the already-
-- deployed read path starts working within seconds of applying this — no
-- app redeploy required.
-- =============================================================================

ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_author_id_fkey;

ALTER TABLE public.task_comments
  ADD CONSTRAINT task_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Nudge PostgREST to reload its schema cache immediately (Supabase also does
-- this via an event trigger, but the explicit NOTIFY makes it instant).
NOTIFY pgrst, 'reload schema';

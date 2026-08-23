-- =============================================================================
-- Migration 231: task-comment notifications reach every participant (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves the widened recipient set:
--   * the task CREATOR is notified when someone else comments   ← the gap
--   * the ASSIGNEE is still notified (mig 185 behaviour preserved)
--   * an earlier COMMENTER on the thread is notified
--   * the comment's own author is never notified
--   * someone @-mentioned in the same comment gets no task_comment row
--     (the mention trigger already notified them — no double bell)
--   * a removed (soft-deleted) participant is skipped
--
-- Runs as the test superuser so the TRIGGER is what's under test, not RLS.
-- The whole file ROLLBACKs at the end.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

\set creator  '11111111-1111-1111-1111-111111111111'
\set assignee '22222222-2222-2222-2222-222222222222'
\set earlier  '33333333-3333-3333-3333-333333333333'
\set author   '44444444-4444-4444-4444-444444444444'
\set removed  '55555555-5555-5555-5555-555555555555'
\set taskid   '99999999-9999-9999-9999-999999999999'

CREATE FUNCTION pg_temp.mk_user(p_id uuid, p_email text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  );
  INSERT INTO public.profiles (id, role_id, is_active)
  VALUES (p_id, (SELECT id FROM public.roles WHERE key = 'advisor'), TRUE)
  ON CONFLICT (id) DO UPDATE SET is_active = TRUE;
END $$;

SELECT pg_temp.mk_user(:'creator'::uuid,  'creator@test.local');
SELECT pg_temp.mk_user(:'assignee'::uuid, 'assignee@test.local');
SELECT pg_temp.mk_user(:'earlier'::uuid,  'earlier@test.local');
SELECT pg_temp.mk_user(:'author'::uuid,   'author@test.local');
SELECT pg_temp.mk_user(:'removed'::uuid,  'removed@test.local');

INSERT INTO public.tasks (id, title, status, assigned_to, created_by)
VALUES (:'taskid'::uuid, 'Test task', 'pending', :'assignee'::uuid, :'creator'::uuid);

-- An earlier reply in the thread, and one from a member removed since.
INSERT INTO public.task_comments (task_id, author_id, body, event_type)
VALUES
  (:'taskid'::uuid, :'earlier'::uuid, 'first reply', 'comment'),
  (:'taskid'::uuid, :'removed'::uuid, 'reply from someone since removed', 'comment');

UPDATE public.profiles SET deleted_at = now(), is_active = FALSE WHERE id = :'removed'::uuid;

-- Clear the rows those setup comments generated; we assert on the next one.
DELETE FROM public.notifications WHERE task_id = :'taskid'::uuid;

INSERT INTO public.task_comments (task_id, author_id, body, event_type)
VALUES (:'taskid'::uuid, :'author'::uuid, 'the comment under test', 'comment');

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE task_id = :'taskid'::uuid AND type = 'task_comment' AND user_id = :'creator'::uuid),
  1, 'the task creator is notified');

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE task_id = :'taskid'::uuid AND type = 'task_comment' AND user_id = :'assignee'::uuid),
  1, 'the assignee is still notified');

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE task_id = :'taskid'::uuid AND type = 'task_comment' AND user_id = :'earlier'::uuid),
  1, 'an earlier commenter is notified');

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE task_id = :'taskid'::uuid AND user_id = :'author'::uuid),
  0, 'the comment author is not notified');

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE task_id = :'taskid'::uuid AND user_id = :'removed'::uuid),
  0, 'a removed participant is skipped');

-- A mention of the assignee in the comment body must NOT also raise a
-- task_comment row for them (the mention trigger covers it).
DELETE FROM public.notifications WHERE task_id = :'taskid'::uuid;
INSERT INTO public.task_comments (task_id, author_id, body, event_type)
VALUES (
  :'taskid'::uuid, :'author'::uuid,
  'ping @[Assignee](' || :'assignee' || ') please', 'comment');

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE task_id = :'taskid'::uuid AND type = 'task_comment' AND user_id = :'assignee'::uuid),
  0, 'a mentioned participant gets no duplicate task_comment bell');

SELECT * FROM finish();
ROLLBACK;

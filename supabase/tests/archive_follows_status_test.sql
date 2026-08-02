-- =============================================================================
-- Migration 226: archive follows closed/frozen statuses (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves the sync trigger (closed/on_hold → archived, active stage → back out),
-- the INSERT one-way case, get_restore_target_status (last active stage from
-- history; case_opened fallback; NULL for an already-active case), and that an
-- archived case with an outstanding advance stays in collections_overview().
-- Whole file ROLLBACKs.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

\set manager '11111111-1111-1111-1111-111111111111'
\set case_a  '55555555-5555-5555-5555-555555555555'
\set case_b  '66666666-6666-6666-6666-666666666666'

CREATE FUNCTION pg_temp.mk_user(p_id uuid, p_email text, p_role_key text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '');
  INSERT INTO public.profiles (id, role_id, is_active)
  VALUES (p_id, (SELECT id FROM public.roles WHERE key = p_role_key), TRUE)
  ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, is_active = TRUE;
END $$;

CREATE FUNCTION pg_temp.login_as(p_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE FUNCTION pg_temp.logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;

CREATE FUNCTION pg_temp.status_id(p_key text) RETURNS uuid LANGUAGE sql AS
$$ SELECT id FROM public.case_statuses WHERE key = p_key $$;

SELECT pg_temp.mk_user(:'manager', 'mgr@test.local', 'admin');

INSERT INTO public.cases (id, status_id, assigned_advisor_id, created_by, updated_by)
VALUES (:'case_a', pg_temp.status_id('case_opened'), :'manager', :'manager', :'manager');

SELECT pg_temp.login_as(:'manager');

-- Walk one stage forward so the case has real active history.
UPDATE public.cases SET status_id = pg_temp.status_id('document_collection')
 WHERE id = :'case_a';

SELECT is(
  (SELECT is_archived FROM public.cases WHERE id = :'case_a'), FALSE,
  'an active stage keeps the case out of the archive');

SELECT is(
  (SELECT public.get_restore_target_status(:'case_a')), NULL::uuid,
  'restore target is NULL while the case is in an active stage');

UPDATE public.cases SET status_id = pg_temp.status_id('closed') WHERE id = :'case_a';
SELECT is(
  (SELECT is_archived FROM public.cases WHERE id = :'case_a'), TRUE,
  'moving to closed archives the case');

-- The whole file runs in ONE transaction, so every stage_durations row shares
-- the same now(). Nudge the case_opened row back so "last active stage by
-- entered_at" is deterministically document_collection.
SELECT pg_temp.logout();
UPDATE public.stage_durations
   SET entered_at = entered_at - INTERVAL '2 days'
 WHERE case_id = :'case_a' AND status_id = pg_temp.status_id('case_opened');
SELECT pg_temp.login_as(:'manager');

SELECT is(
  (SELECT public.get_restore_target_status(:'case_a')),
  pg_temp.status_id('document_collection'),
  'restore target is the last active stage from the history');

UPDATE public.cases SET status_id = pg_temp.status_id('document_collection')
 WHERE id = :'case_a';
SELECT is(
  (SELECT is_archived FROM public.cases WHERE id = :'case_a'), FALSE,
  'changing the stage back pulls the case out of the archive');

UPDATE public.cases SET status_id = pg_temp.status_id('on_hold') WHERE id = :'case_a';
SELECT is(
  (SELECT is_archived FROM public.cases WHERE id = :'case_a'), TRUE,
  'freezing (on_hold) archives the case too');

-- INSERT path (as postgres, like the fixture insert): born closed → archived.
SELECT pg_temp.logout();
INSERT INTO public.cases (id, status_id, assigned_advisor_id, created_by, updated_by)
VALUES (:'case_b', pg_temp.status_id('closed'), :'manager', :'manager', :'manager');
SELECT is(
  (SELECT is_archived FROM public.cases WHERE id = :'case_b'), TRUE,
  'a case inserted in closed status is archived immediately');

-- ...and with no active history its restore target falls back to case_opened.
SELECT pg_temp.login_as(:'manager');
SELECT is(
  (SELECT public.get_restore_target_status(:'case_b')),
  pg_temp.status_id('case_opened'),
  'restore target falls back to case_opened when there is no active history');

-- Collections must not lose archived cases that still owe money: case_b is
-- archived (closed) with an uncollected advance → stays in the overview.
SELECT pg_temp.logout();
INSERT INTO public.case_financials (case_id, fee_amount, advance_amount)
VALUES (:'case_b', 10000, 5000);
SELECT pg_temp.login_as(:'manager');
SELECT is(
  (SELECT COUNT(*) FROM public.collections_overview() o WHERE o.case_id = :'case_b'),
  1::bigint,
  'an archived case with an outstanding advance stays in collections_overview');

-- The manual archive of an ACTIVE-status case is untouched by the trigger:
-- a plain is_archived write (the explicit archive action) with no status
-- change stays as written, and non-status edits never rewrite it.
UPDATE public.cases SET status_id = pg_temp.status_id('document_collection')
 WHERE id = :'case_a';
UPDATE public.cases SET is_archived = TRUE WHERE id = :'case_a';
UPDATE public.cases SET short_note = 'note' WHERE id = :'case_a';
SELECT is(
  (SELECT is_archived FROM public.cases WHERE id = :'case_a'), TRUE,
  'a non-status edit never rewrites is_archived');

SELECT * FROM finish();
ROLLBACK;

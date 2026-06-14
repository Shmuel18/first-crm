-- =============================================================================
-- R5-update-fee-1: DB-level change_case_status / assign_case_to_user (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves migration 178's trigger enforces the granular keys on a DIRECT case
-- UPDATE (not just in the TS action), and ONLY when the value actually changes.
-- Whole file ROLLBACKs.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

\set manager '11111111-1111-1111-1111-111111111111'
\set advisor '22222222-2222-2222-2222-222222222222'
\set case_a  '55555555-5555-5555-5555-555555555555'

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

SELECT pg_temp.mk_user(:'manager', 'mgr@test.local', 'admin');
SELECT pg_temp.mk_user(:'advisor', 'adv@test.local', 'junior_advisor');

-- Case OWNED by the advisor (so edit_own_case + RLS lets the UPDATE reach the trigger).
INSERT INTO public.cases (id, status_id, assigned_advisor_id, created_by, updated_by)
VALUES (:'case_a', (SELECT id FROM public.case_statuses WHERE key = 'case_opened'),
        :'advisor', :'manager', :'manager');

-- Strip BOTH granular keys from the advisor's role (junior seeds change_case_status
-- TRUE and has no assign_case_to_user row) so the negative cases are deterministic.
UPDATE public.role_permissions SET is_granted = FALSE
 WHERE role_id = (SELECT id FROM public.roles WHERE key = 'junior_advisor')
   AND permission_id = (SELECT id FROM public.permissions WHERE key = 'change_case_status');

SELECT pg_temp.login_as(:'advisor');

SELECT lives_ok(
  $$ UPDATE public.cases SET short_note = 'note'
      WHERE id = '55555555-5555-5555-5555-555555555555' $$,
  'editing a non-trusted field needs no granular permission');

SELECT throws_ok(
  $$ UPDATE public.cases
        SET status_id = (SELECT id FROM public.case_statuses WHERE key <> 'case_opened' LIMIT 1)
      WHERE id = '55555555-5555-5555-5555-555555555555' $$,
  '42501', NULL,
  'changing status_id without change_case_status is blocked at the DB');

SELECT throws_ok(
  $$ UPDATE public.cases SET assigned_advisor_id = '11111111-1111-1111-1111-111111111111'
      WHERE id = '55555555-5555-5555-5555-555555555555' $$,
  '42501', NULL,
  'reassigning assigned_advisor_id without assign_case_to_user is blocked at the DB');

SELECT lives_ok(
  $$ UPDATE public.cases
        SET status_id = (SELECT id FROM public.case_statuses WHERE key = 'case_opened')
      WHERE id = '55555555-5555-5555-5555-555555555555' $$,
  'a no-op status write (value unchanged) is allowed — only-when-changed');

-- Re-grant change_case_status → the status change now succeeds.
SELECT pg_temp.logout();
UPDATE public.role_permissions SET is_granted = TRUE
 WHERE role_id = (SELECT id FROM public.roles WHERE key = 'junior_advisor')
   AND permission_id = (SELECT id FROM public.permissions WHERE key = 'change_case_status');

SELECT pg_temp.login_as(:'advisor');
SELECT lives_ok(
  $$ UPDATE public.cases
        SET status_id = (SELECT id FROM public.case_statuses WHERE key <> 'case_opened' LIMIT 1)
      WHERE id = '55555555-5555-5555-5555-555555555555' $$,
  'with change_case_status granted, the status change succeeds');

SELECT * FROM finish();
ROLLBACK;

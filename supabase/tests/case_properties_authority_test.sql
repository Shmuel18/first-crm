-- =============================================================================
-- R5-advisors-properties-email-1: case_properties authority + anti-forgery (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves migration 179: an ASSOCIATED advisor (not the responsible one) can
-- add/edit/soft-delete case properties (was silently RLS-denied), and that
-- created_by cannot be forged. Whole file ROLLBACKs.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

\set manager   '11111111-1111-1111-1111-111111111111'
\set advisor_a '22222222-2222-2222-2222-222222222222'
\set advisor_b '33333333-3333-3333-3333-333333333333'
\set case_a    '55555555-5555-5555-5555-555555555555'

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

SELECT pg_temp.mk_user(:'manager',   'mgr@test.local', 'admin');
SELECT pg_temp.mk_user(:'advisor_a', 'a@test.local',   'junior_advisor');
SELECT pg_temp.mk_user(:'advisor_b', 'b@test.local',   'junior_advisor');

-- Case owned by advisor_a; advisor_b is an ASSOCIATED advisor.
INSERT INTO public.cases (id, status_id, assigned_advisor_id, created_by, updated_by)
VALUES (:'case_a', (SELECT id FROM public.case_statuses WHERE key = 'case_opened'),
        :'advisor_a', :'manager', :'manager');
INSERT INTO public.case_associated_advisors (case_id, advisor_id, added_by)
VALUES (:'case_a', :'advisor_b', :'manager');

-- ===========================================================================
-- Associated advisor B (edit_own_case via association) — was silently denied.
-- ===========================================================================
SELECT pg_temp.login_as(:'advisor_b');

SELECT lives_ok(
  $$ INSERT INTO public.case_properties (case_id, created_by, updated_by)
     VALUES ('55555555-5555-5555-5555-555555555555',
             '33333333-3333-3333-3333-333333333333',
             '33333333-3333-3333-3333-333333333333') $$,
  'associated advisor CAN add a case property (was RLS-denied pre-179)');

SELECT throws_ok(
  $$ INSERT INTO public.case_properties (case_id, created_by, updated_by)
     VALUES ('55555555-5555-5555-5555-555555555555',
             '22222222-2222-2222-2222-222222222222',  -- forged created_by
             '33333333-3333-3333-3333-333333333333') $$,
  '42501', NULL,
  'cannot forge created_by to another user (anti-forgery WITH CHECK)');

SELECT lives_ok(
  $$ UPDATE public.case_properties SET city = 'Haifa', updated_by = '33333333-3333-3333-3333-333333333333'
      WHERE case_id = '55555555-5555-5555-5555-555555555555' $$,
  'associated advisor CAN edit a case property');

-- mig 180: created_by is write-once — a forged UPDATE of it must fail.
SELECT throws_ok(
  $$ UPDATE public.case_properties
        SET created_by = '22222222-2222-2222-2222-222222222222'
      WHERE case_id = '55555555-5555-5555-5555-555555555555' $$,
  '42501', NULL,
  'cannot re-write created_by on UPDATE (immutable, mig 180)');

SELECT ok(
  (SELECT public.soft_delete_case_property(
     '55555555-5555-5555-5555-555555555555',
     (SELECT id FROM public.case_properties
       WHERE case_id = '55555555-5555-5555-5555-555555555555' LIMIT 1))),
  'associated advisor CAN soft-delete a case property');

SELECT * FROM finish();
ROLLBACK;

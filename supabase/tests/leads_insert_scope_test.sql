-- =============================================================================
-- R4-leads-1: leads_insert owner-scope tests (pgTAP) — migration 174
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves the hardened leads_insert policy (mig 174):
--   * a caller WITHOUT view_all_leads may only create a lead assigned to SELF;
--   * a view_all_leads holder may fan out / leave unassigned;
--   * created_by AND updated_by MUST equal auth.uid() (a forged actor is rejected).
-- Pattern mirrors rls_permissions_test.sql. Whole file ROLLBACKs at the end.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

\set manager   '11111111-1111-1111-1111-111111111111'
\set advisor_a '22222222-2222-2222-2222-222222222222'
\set advisor_b '33333333-3333-3333-3333-333333333333'

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
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('invited_by', '11111111-1111-1111-1111-111111111111'),
    '', '', '', ''
  );
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

-- ---- junior advisor: create_lead + view_own_leads, NO view_all_leads --------
SELECT pg_temp.login_as(:'advisor_a');
SELECT lives_ok(
  $$ INSERT INTO public.leads (first_name, status, assigned_to, created_by, updated_by)
     VALUES ('Self', 'active',
             '22222222-2222-2222-2222-222222222222',
             '22222222-2222-2222-2222-222222222222',
             '22222222-2222-2222-2222-222222222222') $$,
  'junior advisor CAN create a lead assigned to + stamped by themselves');

SELECT throws_ok(
  $$ INSERT INTO public.leads (first_name, status, assigned_to, created_by, updated_by)
     VALUES ('Other', 'active',
             '33333333-3333-3333-3333-333333333333',
             '22222222-2222-2222-2222-222222222222',
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', NULL,
  'junior advisor canNOT assign a new lead to ANOTHER advisor');

SELECT throws_ok(
  $$ INSERT INTO public.leads (first_name, status, assigned_to, created_by, updated_by)
     VALUES ('Pool', 'active', NULL,
             '22222222-2222-2222-2222-222222222222',
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', NULL,
  'junior advisor canNOT create an UNASSIGNED lead (must own it)');

-- forged actor: created_by / updated_by must equal auth.uid()
SELECT throws_ok(
  $$ INSERT INTO public.leads (first_name, status, assigned_to, created_by, updated_by)
     VALUES ('ForgeC', 'active',
             '22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333',  -- forged created_by
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', NULL,
  'canNOT forge created_by to ANOTHER user');

SELECT throws_ok(
  $$ INSERT INTO public.leads (first_name, status, assigned_to, created_by, updated_by)
     VALUES ('ForgeU', 'active',
             '22222222-2222-2222-2222-222222222222',
             '22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333') $$,  -- forged updated_by
  '42501', NULL,
  'canNOT forge updated_by to ANOTHER user');

-- ---- manager: view_all_leads ------------------------------------------------
SELECT pg_temp.login_as(:'manager');
SELECT lives_ok(
  $$ INSERT INTO public.leads (first_name, status, assigned_to, created_by, updated_by)
     VALUES ('FanOut', 'active',
             '33333333-3333-3333-3333-333333333333',
             '11111111-1111-1111-1111-111111111111',
             '11111111-1111-1111-1111-111111111111') $$,
  'manager (view_all_leads) CAN assign a new lead to another advisor');

SELECT lives_ok(
  $$ INSERT INTO public.leads (first_name, status, assigned_to, created_by, updated_by)
     VALUES ('Unassigned', 'active', NULL,
             '11111111-1111-1111-1111-111111111111',
             '11111111-1111-1111-1111-111111111111') $$,
  'manager (view_all_leads) CAN leave a new lead unassigned');

SELECT * FROM finish();
ROLLBACK;

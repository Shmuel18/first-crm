-- =============================================================================
-- R5-create-draft-1: default responsible advisor + RLS visibility (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves migration 176: a creator WITHOUT view_all_cases (junior advisor) gets
-- the new case assigned to themselves and can SEE + EDIT it under RLS, for BOTH
-- create_case_draft and convert_lead_to_case; a view_all creator (manager) gets
-- an UNASSIGNED case (lands in the distribution queue). Whole file ROLLBACKs.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

\set manager '11111111-1111-1111-1111-111111111111'
\set advisor '22222222-2222-2222-2222-222222222222'
\set lead_a  '77777777-7777-7777-7777-777777777777'

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

SELECT pg_temp.mk_user(:'manager', 'mgr@test.local', 'admin');
SELECT pg_temp.mk_user(:'advisor', 'adv@test.local', 'junior_advisor');

-- ===========================================================================
-- create_case_draft — junior advisor (view_own_cases, NOT view_all_cases)
-- ===========================================================================
SELECT pg_temp.login_as(:'advisor');
CREATE TEMP TABLE _draft AS
SELECT public.create_case_draft('draft', '[{"first_name":"A","last_name":"B"}]'::jsonb) AS id;

SELECT is(
  (SELECT count(*)::int FROM public.cases WHERE id = (SELECT id FROM _draft)),
  1, 'junior advisor CAN see the case they just created (not orphaned/404)');
SELECT is(
  (SELECT assigned_advisor_id FROM public.cases WHERE id = (SELECT id FROM _draft)),
  :'advisor'::uuid, 'the new case is assigned to its creator');
-- and they can edit it (cases_update edit_own + assigned=self):
SELECT lives_ok(
  $$ UPDATE public.cases SET short_note = 'mine'
      WHERE id = (SELECT id FROM _draft) $$,
  'junior advisor CAN edit the case they just created');

-- ===========================================================================
-- create_case_draft — manager (view_all_cases) leaves it unassigned
-- ===========================================================================
SELECT pg_temp.login_as(:'manager');
CREATE TEMP TABLE _mgr AS
SELECT public.create_case_draft('draft2', '[{"first_name":"C","last_name":"D"}]'::jsonb) AS id;
SELECT ok(
  (SELECT assigned_advisor_id IS NULL FROM public.cases WHERE id = (SELECT id FROM _mgr)),
  'manager (view_all) leaves the new case UNASSIGNED for the queue');

-- ===========================================================================
-- convert_lead_to_case — junior advisor converting their own lead
-- ===========================================================================
-- Reset to superuser to seed the lead (not under advisor RLS).
SELECT set_config('request.jwt.claims', NULL, true);
SELECT set_config('role', 'postgres', true);
INSERT INTO public.leads (id, first_name, last_name, status, assigned_to, created_by)
VALUES (:'lead_a', 'Lead', 'A', 'active', :'advisor', :'manager');

SELECT pg_temp.login_as(:'advisor');
CREATE TEMP TABLE _conv AS SELECT public.convert_lead_to_case(:'lead_a'::uuid) AS id;
SELECT is(
  (SELECT count(*)::int FROM public.cases WHERE id = (SELECT id FROM _conv)),
  1, 'junior converter CAN see the case from their converted lead');
SELECT is(
  (SELECT assigned_advisor_id FROM public.cases WHERE id = (SELECT id FROM _conv)),
  :'advisor'::uuid, 'converted case is assigned to the converter');
SELECT is(
  (SELECT status FROM public.leads WHERE id = :'lead_a'),
  'converted', 'the lead is marked converted');

SELECT * FROM finish();
ROLLBACK;

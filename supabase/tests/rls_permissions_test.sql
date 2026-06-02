-- =============================================================================
-- QA-1: RLS / permission-isolation tests (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Verifies the security boundary the whole product rests on:
--   * per-case advisor isolation (advisor A cannot see advisor B's case),
--   * manager-only financials (advisors cannot read case_financials),
--   * the leads IDOR fix (migration 116 — advisor B cannot edit A's lead).
--
-- Pattern: seed test users (auth.users + profiles + role) as superuser, then
-- impersonate each via request.jwt.claims so auth.uid() + RLS apply, and assert
-- allow/deny. The whole file runs in a transaction that ROLLBACKs at the end.
--
-- NOTE: advisor A/B are BOTH junior_advisor on purpose — junior has only
-- view_own_cases/leads (no view_all), which is what isolates them. (senior has
-- view_all_cases by seed, so it would NOT be isolated — a separate concern.)
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

-- ---- fixed ids -------------------------------------------------------------
-- users
\set manager   '11111111-1111-1111-1111-111111111111'
\set advisor_a '22222222-2222-2222-2222-222222222222'
\set advisor_b '33333333-3333-3333-3333-333333333333'
\set secretary '44444444-4444-4444-4444-444444444444'
-- data
\set case_a    '55555555-5555-5555-5555-555555555555'
\set case_b    '66666666-6666-6666-6666-666666666666'
\set lead_a    '77777777-7777-7777-7777-777777777777'
\set lead_b    '88888888-8888-8888-8888-888888888888'

-- ---- helpers (temp; gone at ROLLBACK) --------------------------------------
-- Create a confirmed auth user + a profile with the given role. invited_by is
-- set so the handle_new_user signup-hardening trigger (migration 059) doesn't
-- refuse; we then upsert the intended role over whatever default it picked.
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

-- Impersonate a user for subsequent statements (RLS applies as `authenticated`).
CREATE FUNCTION pg_temp.login_as(p_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE FUNCTION pg_temp.logout()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;

-- ---- seed (as superuser) ---------------------------------------------------
SELECT pg_temp.mk_user(:'manager',   'mgr@test.local', 'admin');
SELECT pg_temp.mk_user(:'advisor_a', 'a@test.local',   'junior_advisor');
SELECT pg_temp.mk_user(:'advisor_b', 'b@test.local',   'junior_advisor');
SELECT pg_temp.mk_user(:'secretary', 'sec@test.local', 'secretary');

INSERT INTO public.cases (id, status_id, assigned_advisor_id, created_by, updated_by)
VALUES
  (:'case_a', (SELECT id FROM public.case_statuses WHERE key='case_opened'), :'advisor_a', :'manager', :'manager'),
  (:'case_b', (SELECT id FROM public.case_statuses WHERE key='case_opened'), :'advisor_b', :'manager', :'manager');

INSERT INTO public.case_financials (case_id, fee_amount, expected_income)
VALUES (:'case_a', 5000, 8000);

INSERT INTO public.leads (id, first_name, last_name, status, assigned_to, created_by)
VALUES
  (:'lead_a', 'Lead', 'A', 'active', :'advisor_a', :'manager'),
  (:'lead_b', 'Lead', 'B', 'active', :'advisor_b', :'manager');

-- ===========================================================================
-- Cases — per-advisor isolation
-- ===========================================================================
SELECT pg_temp.login_as(:'advisor_a');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id = :'case_a'), 1,
  'advisor A sees their own case');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id = :'case_b'), 0,
  'advisor A canNOT see advisor B''s case (RLS isolation)');

SELECT pg_temp.login_as(:'advisor_b');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id = :'case_a'), 0,
  'advisor B canNOT see advisor A''s case (RLS isolation)');

SELECT pg_temp.login_as(:'manager');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id IN (:'case_a', :'case_b')), 2,
  'manager (admin / view_all_cases) sees both cases');

SELECT pg_temp.login_as(:'secretary');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id IN (:'case_a', :'case_b')), 2,
  'secretary (view_all_cases) sees both cases');

-- ===========================================================================
-- Financials — manager-only (view_case_fee)
-- ===========================================================================
SELECT pg_temp.login_as(:'advisor_a');
SELECT is((SELECT count(*)::int FROM public.case_financials WHERE case_id = :'case_a'), 0,
  'advisor A canNOT read case_financials (manager-only)');

SELECT pg_temp.login_as(:'secretary');
SELECT is((SELECT count(*)::int FROM public.case_financials WHERE case_id = :'case_a'), 0,
  'secretary canNOT read case_financials (no view_case_fee)');

SELECT pg_temp.login_as(:'manager');
SELECT is((SELECT count(*)::int FROM public.case_financials WHERE case_id = :'case_a'), 1,
  'manager CAN read case_financials');

-- ===========================================================================
-- Leads — owner-scoped reads + the IDOR write fix (migration 116)
-- ===========================================================================
SELECT pg_temp.login_as(:'advisor_a');
SELECT is((SELECT count(*)::int FROM public.leads WHERE id = :'lead_b'), 0,
  'advisor A canNOT see advisor B''s lead (leads_select scope)');

-- advisor B tries to steal/edit advisor A's lead — leads_update is owner-scoped,
-- so this must affect ZERO rows (no error; RLS just filters it out).
SELECT pg_temp.login_as(:'advisor_b');
UPDATE public.leads SET status = 'converted' WHERE id = :'lead_a';

SELECT pg_temp.logout();
SELECT is((SELECT status FROM public.leads WHERE id = :'lead_a'), 'active',
  'advisor B''s UPDATE of advisor A''s lead changed nothing (IDOR closed, mig 116)');

-- ===========================================================================
-- Lead → case conversion happy path (convert_lead_to_case, migration 124).
-- Regression guard: the function used to UPDATE a non-existent column
-- (converted_case_id) and threw undefined_column at RUNTIME, so conversion was
-- silently broken since migration 053. This actually performs a conversion —
-- the auth-denial-only tests above never reached the broken UPDATE.
-- ===========================================================================
\set lead_c '99999999-9999-9999-9999-999999999999'
SELECT pg_temp.logout();
INSERT INTO public.leads (id, first_name, last_name, national_id, status, assigned_to, created_by)
VALUES (:'lead_c', 'Lead', 'C', '900000003', 'active', :'advisor_a', :'manager');

-- Manager (admin: create_case + view_all_leads) converts. Must NOT throw.
SELECT pg_temp.login_as(:'manager');
SELECT lives_ok(
  $$ SELECT public.convert_lead_to_case('99999999-9999-9999-9999-999999999999'::uuid) $$,
  'convert_lead_to_case succeeds on the happy path (no undefined-column throw)');

SELECT pg_temp.logout();
SELECT is((SELECT status FROM public.leads WHERE id = :'lead_c'), 'converted',
  'converted lead is marked converted');
SELECT ok((SELECT converted_to_case_id IS NOT NULL FROM public.leads WHERE id = :'lead_c'),
  'converted lead has converted_to_case_id set (the fixed column)');
SELECT ok((SELECT converted_at IS NOT NULL FROM public.leads WHERE id = :'lead_c'),
  'converted lead has converted_at set (restored regression)');
SELECT is(
  (SELECT count(*)::int
     FROM public.cases c
     JOIN public.leads l ON l.converted_to_case_id = c.id
    WHERE l.id = :'lead_c'
      AND c.status_id = (SELECT id FROM public.case_statuses WHERE key = 'case_opened')),
  1,
  'conversion created exactly one case_opened case linked from the lead');

-- ===========================================================================
-- Bulk import: all-or-nothing (import_cases RPC, migration 125)
-- ===========================================================================
SELECT pg_temp.login_as(:'manager');
SELECT is(
  (SELECT (public.import_cases(
     '[{"first_name":"Imp","last_name":"One","national_id":"800000001"},
       {"first_name":"Imp","last_name":"Two","national_id":"800000002"}]'::jsonb)->>'created')::int),
  2, 'clean import creates every row');

-- A file with one bad row (row 2 has no name) must import ZERO and persist nothing.
SELECT is(
  (SELECT (public.import_cases(
     '[{"first_name":"Good","national_id":"800000003"},
       {"national_id":"800000004"}]'::jsonb)->>'created')::int),
  0, 'all-or-nothing: a single bad row imports zero');
SELECT pg_temp.logout();
SELECT is((SELECT count(*)::int FROM public.borrowers WHERE national_id = '800000003'), 0,
  'all-or-nothing: the valid row in a rejected file is NOT persisted');

-- In-file duplicate national_id is reported (and blocks the import).
SELECT pg_temp.login_as(:'manager');
SELECT is(
  (SELECT public.import_cases(
     '[{"first_name":"Dup","national_id":"800000005"},
       {"first_name":"Dup2","national_id":"800000005"}]'::jsonb)->'errors'->0->>'code'),
  'duplicate_in_file', 'in-file duplicate national_id is reported');
SELECT pg_temp.logout();

SELECT * FROM finish();
ROLLBACK;

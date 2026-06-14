-- =============================================================================
-- R5-lifecycle-1: permanent-delete is blocked while retention is paused (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves migration 177: with office_settings.retention_purge_enabled = FALSE an
-- admin permanent-delete raises the dedicated PT001 and the case survives; once
-- the switch is ON the delete proceeds. Whole file ROLLBACKs.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

\set manager '11111111-1111-1111-1111-111111111111'
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

-- A soft-deleted case; capture its (auto) case_number in a temp table (not RLS-gated).
INSERT INTO public.cases (id, status_id, created_by, updated_by, deleted_at)
VALUES (:'case_a', (SELECT id FROM public.case_statuses WHERE key = 'case_opened'),
        :'manager', :'manager', now());
CREATE TEMP TABLE _cn AS SELECT case_number FROM public.cases WHERE id = :'case_a';

-- ---- retention PAUSED → refused ---------------------------------------------
UPDATE public.office_settings SET retention_purge_enabled = FALSE WHERE id = 1;
SELECT pg_temp.login_as(:'manager');
SELECT throws_ok(
  $$ SELECT public.permanently_delete_case(
       '55555555-5555-5555-5555-555555555555'::uuid,
       (SELECT case_number FROM _cn)) $$,
  'PT001', NULL,
  'permanent delete is refused (PT001) while retention is paused');

SELECT pg_temp.logout();
SELECT is(
  (SELECT count(*)::int FROM public.cases WHERE id = :'case_a'),
  1, 'the case SURVIVES the blocked permanent delete');

-- ---- retention ENABLED → proceeds -------------------------------------------
UPDATE public.office_settings SET retention_purge_enabled = TRUE WHERE id = 1;
SELECT pg_temp.login_as(:'manager');
SELECT lives_ok(
  $$ SELECT public.permanently_delete_case(
       '55555555-5555-5555-5555-555555555555'::uuid,
       (SELECT case_number FROM _cn)) $$,
  'permanent delete proceeds once retention is enabled');

SELECT pg_temp.logout();
SELECT is(
  (SELECT count(*)::int FROM public.cases WHERE id = :'case_a'),
  0, 'the case is gone after the allowed permanent delete');

SELECT * FROM finish();
ROLLBACK;

-- =============================================================================
-- R3-team-4c: protected-profile guard tests (pgTAP)
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves the is_protected hardening (migs 170-172):
--   * an end-user (authenticated) canNOT self-protect (FALSE->TRUE)  ← the hole
--   * a normal end-user self-update is unaffected (is_protected stays put)
--   * an end-user canNOT unprotect / deactivate a protected profile
--   * at most ONE protected profile may exist (single-owner unique index, 172)
--   * direct SQL (no JWT) CAN still unprotect — the recovery hatch (mig 171)
--
-- We set ONLY request.jwt.claims (not `role`), so RLS is bypassed (we run as the
-- test superuser) while auth.role() returns the impersonated role. That tests
-- the TRIGGER in isolation — the universal backstop that must hold even if an
-- RLS policy would let the row through. The whole file ROLLBACKs at the end.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

\set manager '11111111-1111-1111-1111-111111111111'
\set advisor '22222222-2222-2222-2222-222222222222'

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

-- Set only the JWT claim (auth.role()), leave the table role = superuser so the
-- row is reachable and the TRIGGER is what we're asserting on.
CREATE FUNCTION pg_temp.as_jwt(p_role text, p_sub uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', p_role, 'sub', p_sub::text)::text, true);
END $$;

CREATE FUNCTION pg_temp.clear_jwt() RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', NULL, true); END $$;

-- ---- seed (as superuser; trigger early-returns for NULL jwt role) -----------
SELECT pg_temp.mk_user(:'manager', 'mgr@test.local', 'admin');
SELECT pg_temp.mk_user(:'advisor', 'adv@test.local', 'junior_advisor');
UPDATE public.profiles SET is_protected = TRUE WHERE id = :'manager';

-- ===========================================================================
-- THE HOLE (R3-team-4c): an authenticated user cannot self-protect.
-- ===========================================================================
SELECT pg_temp.as_jwt('authenticated', :'advisor');
SELECT throws_ok(
  $$ UPDATE public.profiles SET is_protected = TRUE
      WHERE id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', NULL,
  'authenticated user canNOT self-protect (FALSE->TRUE blocked)');

-- A normal self-update is unaffected, and is_protected stays FALSE.
SELECT lives_ok(
  $$ UPDATE public.profiles SET first_name = 'x'
      WHERE id = '22222222-2222-2222-2222-222222222222' $$,
  'a normal self-update still succeeds');
SELECT is(
  (SELECT is_protected FROM public.profiles WHERE id = :'advisor'), FALSE,
  'the normal self-update left is_protected FALSE');

-- ===========================================================================
-- A protected profile cannot be unprotected or deactivated by an end-user.
-- ===========================================================================
SELECT pg_temp.as_jwt('authenticated', :'advisor');
SELECT throws_ok(
  $$ UPDATE public.profiles SET is_protected = FALSE
      WHERE id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', NULL,
  'authenticated user canNOT unprotect a protected profile (TRUE->FALSE blocked)');
SELECT throws_ok(
  $$ UPDATE public.profiles SET is_active = FALSE
      WHERE id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', NULL,
  'authenticated user canNOT deactivate a protected profile');

-- ===========================================================================
-- Single-owner invariant + recovery hatch (direct SQL).
-- ===========================================================================
SELECT pg_temp.clear_jwt();
SELECT throws_ok(
  $$ UPDATE public.profiles SET is_protected = TRUE
      WHERE id = '22222222-2222-2222-2222-222222222222' $$,
  '23505', NULL,
  'a SECOND protected profile is rejected by the single-owner unique index');
SELECT lives_ok(
  $$ UPDATE public.profiles SET is_protected = FALSE
      WHERE id = '11111111-1111-1111-1111-111111111111' $$,
  'direct SQL (no JWT) CAN unprotect — the recovery hatch (mig 171)');

SELECT * FROM finish();
ROLLBACK;

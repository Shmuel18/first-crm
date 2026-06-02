-- =============================================================================
-- GAP-Bootstrap: bootstrap_first_admin (pgTAP)
-- =============================================================================
-- Verifies migration 137: the one-time first-manager provisioning function
-- creates an admin when none exists, and self-disables once one does.
-- Runs as superuser in a transaction that ROLLBACKs at the end.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

\set boot_id 'a1a1a1a1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

-- Create an auth user the way the Supabase dashboard would — WITHOUT
-- invited_by — so handle_new_user (059) refuses the profile and it starts
-- profile-less (exactly the from-scratch scenario).
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', :'boot_id', 'authenticated', 'authenticated',
  'boot@test.local', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', ''
);

-- ---- preconditions ---------------------------------------------------------
SELECT is((SELECT count(*)::int FROM public.profiles WHERE id = :'boot_id'), 0,
  'precondition: a dashboard-created user has no profile (059 invited_by guard)');
SELECT is((SELECT count(*)::int FROM public.profiles p
             JOIN public.roles r ON r.id = p.role_id
            WHERE r.key = 'admin' AND p.is_active), 0,
  'precondition: no active admin exists yet');

-- ---- unknown email refused (while no admin yet) ----------------------------
SELECT throws_ok(
  $$ SELECT public.bootstrap_first_admin('nobody@test.local') $$,
  NULL, NULL,
  'refuses an email with no matching auth user');

-- ---- happy path: first admin provisioned -----------------------------------
SELECT lives_ok(
  $$ SELECT public.bootstrap_first_admin('boot@test.local') $$,
  'bootstrap_first_admin succeeds when no admin exists');

SELECT is(
  (SELECT r.key FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = :'boot_id'),
  'admin',
  'the bootstrapped user now holds the admin role');

SELECT ok(
  (SELECT is_active FROM public.profiles WHERE id = :'boot_id'),
  'the bootstrapped admin profile is active');

-- ---- self-disabling: a second call now refuses -----------------------------
SELECT throws_ok(
  $$ SELECT public.bootstrap_first_admin('boot@test.local') $$,
  NULL, NULL,
  'refuses once an active admin exists (self-disabling)');

SELECT * FROM finish();
ROLLBACK;

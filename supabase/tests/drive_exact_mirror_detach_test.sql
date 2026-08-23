-- =============================================================================
-- Migration 229: exact-mirror Drive detach (pgTAP)
-- =============================================================================
-- Run with: supabase test db
-- Proves the no-tombstone detach is service-only, owns its timestamp, clears
-- active Drive pointers atomically, and retains the former id solely as audit
-- metadata.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

\set advisor '11111111-1111-4111-8111-111111111111'
\set case_a  '22222222-2222-4222-8222-222222222222'
\set doc_a   '33333333-3333-4333-8333-333333333333'

CREATE FUNCTION pg_temp.mk_user(p_id UUID, p_email TEXT, p_role_key TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, '', NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '');
  INSERT INTO public.profiles (id, role_id, is_active)
  VALUES (p_id, (SELECT id FROM public.roles WHERE key = p_role_key), TRUE)
  ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, is_active = TRUE;
END $$;

CREATE FUNCTION pg_temp.login_as(p_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    TRUE
  );
  PERFORM set_config('role', 'authenticated', TRUE);
END $$;

SELECT pg_temp.mk_user(:'advisor', 'drive-detach@test.local', 'senior_advisor');

INSERT INTO public.cases (id, assigned_advisor_id, created_by, updated_by)
VALUES (:'case_a', :'advisor', :'advisor', :'advisor');

INSERT INTO public.documents (
  id, case_id, file_name, drive_file_id, drive_file_url, metadata
) VALUES (
  :'doc_a', :'case_a', 'outside.pdf', 'drive-file-1',
  'https://drive.google.com/file/d/drive-file-1/view',
  '{"source":"drive_sync"}'::jsonb
);

SELECT pg_temp.login_as(:'advisor');

SELECT throws_ok(
  $$ UPDATE public.documents
        SET deleted_at = NOW() - INTERVAL '1 year',
            drive_file_id = NULL,
            drive_file_url = NULL,
            metadata = metadata || '{"drive_detached_file_id":"drive-file-1"}'::jsonb
      WHERE id = '33333333-3333-4333-8333-333333333333' $$,
  'drive_file_id is immutable on documents',
  'a direct client UPDATE cannot forge the exact-mirror detach bypass');

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.soft_delete_drive_document_without_tombstone(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  FALSE,
  'an authenticated browser client cannot execute the reconciliation RPC');

SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'service_role')::text,
  TRUE
);
SELECT set_config('role', 'service_role', TRUE);

SELECT ok(
  public.soft_delete_drive_document_without_tombstone(
    :'doc_a', :'case_a', :'advisor'
  ),
  'the service-only reconciliation RPC detaches the active row');

SELECT is(
  (SELECT drive_file_id FROM public.documents WHERE id = :'doc_a'),
  NULL,
  'the active Drive id pointer is cleared');

SELECT is(
  (SELECT metadata->>'drive_detached_file_id' FROM public.documents WHERE id = :'doc_a'),
  'drive-file-1',
  'the former Drive id remains only as audit metadata');

SELECT is(
  (SELECT metadata->>'drive_detached_by' FROM public.documents WHERE id = :'doc_a'),
  :'advisor',
  'the server records the authenticated sync actor');

SELECT ok(
  (SELECT deleted_at > NOW() - INTERVAL '1 minute'
     FROM public.documents WHERE id = :'doc_a'),
  'the RPC owns a fresh deletion timestamp');

SELECT is(
  (SELECT COUNT(*)::INT
     FROM public.document_drive_tombstones
    WHERE drive_file_id = 'drive-file-1'),
  0,
  'sync detach writes no tombstone, so a returned Drive file can re-import');

SELECT * FROM finish();
ROLLBACK;

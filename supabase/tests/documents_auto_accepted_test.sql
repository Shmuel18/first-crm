-- =============================================================================
-- Migration 230: documents are accepted immediately (pgTAP)
-- =============================================================================
-- Active documents have no review lifecycle: stale clients are normalized to
-- verified, verifier attribution cannot be forged, and upload permission is
-- the sole document-write capability. Soft-deleted history remains intact.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);

\set advisor      '11111111-1111-4111-8111-111111111111'
\set verify_only  '22222222-2222-4222-8222-222222222222'
\set case_a       '33333333-3333-4333-8333-333333333333'
\set case_v       '44444444-4444-4444-8444-444444444444'
\set doc_default  '55555555-5555-4555-8555-555555555555'
\set doc_new      '66666666-6666-4666-8666-666666666666'
\set doc_rejected '77777777-7777-4777-8777-777777777777'
\set doc_forged   '88888888-8888-4888-8888-888888888888'
\set doc_verify   '99999999-9999-4999-8999-999999999999'
\set doc_history  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set doc_restore  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

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
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('invited_by', '11111111-1111-4111-8111-111111111111'),
    '', '', '', ''
  );
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

CREATE FUNCTION pg_temp.logout()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  PERFORM set_config('request.jwt.claims', NULL, TRUE);
END $$;

SELECT pg_temp.mk_user(:'advisor', 'auto-valid@test.local', 'junior_advisor');
SELECT pg_temp.mk_user(:'verify_only', 'legacy-verifier@test.local', 'junior_advisor');

INSERT INTO public.user_permission_overrides (user_id, permission_id, is_granted)
SELECT :'verify_only', id, FALSE FROM public.permissions WHERE key = 'upload_document';
INSERT INTO public.user_permission_overrides (user_id, permission_id, is_granted)
SELECT :'verify_only', id, TRUE FROM public.permissions WHERE key = 'verify_document';

INSERT INTO public.cases (id, assigned_advisor_id, created_by, updated_by)
VALUES
  (:'case_a', :'advisor', :'advisor', :'advisor'),
  (:'case_v', :'verify_only', :'verify_only', :'verify_only');

SELECT pg_temp.login_as(:'advisor');

-- Default, stale-new and explicitly rejected clients all land as accepted.
INSERT INTO public.documents (id, case_id, file_name)
VALUES (:'doc_default', :'case_a', 'default.pdf');
INSERT INTO public.documents (id, case_id, file_name, status)
VALUES (:'doc_new', :'case_a', 'old-client.pdf', 'new');
INSERT INTO public.documents (id, case_id, file_name, status)
VALUES (:'doc_rejected', :'case_a', 'legacy-rejected.pdf', 'rejected');

SELECT is(
  (SELECT status FROM public.documents WHERE id = :'doc_default'),
  'verified',
  'the database default creates an accepted document');
SELECT is(
  (SELECT status FROM public.documents WHERE id = :'doc_new'),
  'verified',
  'a stale client that inserts new is normalized before RLS');
SELECT is(
  (SELECT status FROM public.documents WHERE id = :'doc_rejected'),
  'verified',
  'an active legacy status is normalized to accepted');
SELECT is(
  (SELECT uploaded_by FROM public.documents WHERE id = :'doc_default'),
  :'advisor'::UUID,
  'a stale authenticated insert is attributed to its real actor');
SELECT ok(
  (SELECT verified_by IS NULL AND verified_at IS NULL
     FROM public.documents WHERE id = :'doc_default'),
  'automatic acceptance does not fabricate a human verifier');

SELECT throws_ok(
  $$ INSERT INTO public.documents (
       id, case_id, file_name, verified_by, verified_at
     ) VALUES (
       '88888888-8888-4888-8888-888888888888',
       '33333333-3333-4333-8333-333333333333',
       'forged.pdf',
       '11111111-1111-4111-8111-111111111111',
       NOW()
     ) $$,
  '42501', NULL,
  'an authenticated uploader cannot forge verification attribution');
SELECT is(
  (SELECT COUNT(*)::INT FROM public.documents WHERE id = :'doc_forged'),
  0,
  'the forged insert leaves no row behind');

-- Old status buttons become harmless during rolling deployment. Normal
-- metadata edits still work for an upload-capable case editor.
UPDATE public.documents
   SET status = 'rejected',
       verified_by = :'advisor',
       verified_at = NOW(),
       notes = 'ordinary metadata edit'
 WHERE id = :'doc_default';

SELECT is(
  (SELECT status FROM public.documents WHERE id = :'doc_default'),
  'verified',
  'a direct status update cannot leave the accepted state');
SELECT ok(
  (SELECT verified_by IS NULL AND verified_at IS NULL
     FROM public.documents WHERE id = :'doc_default'),
  'a direct update cannot invent verifier attribution');
SELECT is(
  (SELECT notes FROM public.documents WHERE id = :'doc_default'),
  'ordinary metadata edit',
  'an upload-capable case editor can still update document metadata');

SELECT pg_temp.logout();

-- A legacy verify-only capability is intentionally inert after migration 230.
INSERT INTO public.documents (id, case_id, file_name, uploaded_by)
VALUES (:'doc_verify', :'case_v', 'verify-only.pdf', :'verify_only');
SELECT pg_temp.login_as(:'verify_only');
UPDATE public.documents SET notes = 'must not change' WHERE id = :'doc_verify';
SELECT pg_temp.logout();

SELECT is(
  (SELECT notes FROM public.documents WHERE id = :'doc_verify'),
  NULL,
  'verify_document without upload_document cannot update documents');

-- Historical soft-deleted states remain queryable and are not rewritten.
INSERT INTO public.documents (
  id, case_id, file_name, status, uploaded_by, deleted_at
) VALUES (
  :'doc_history', :'case_a', 'historical.pdf', 'rejected', :'advisor', NOW()
);
SELECT is(
  (SELECT status FROM public.documents WHERE id = :'doc_history'),
  'rejected',
  'soft-deleted history retains its legacy status');

-- Backup restore is trusted historical input: active status is normalized,
-- while legitimate uploader/verifier attribution from the snapshot survives.
SELECT set_config('app.restoring_backup', 'true', TRUE);
INSERT INTO public.documents (
  id, case_id, file_name, status, uploaded_by, verified_by, verified_at
) VALUES (
  :'doc_restore', :'case_a', 'restored.pdf', 'new',
  :'advisor', :'advisor', '2025-01-02T03:04:05Z'::TIMESTAMPTZ
);
SELECT set_config('app.restoring_backup', 'false', TRUE);

SELECT is(
  (SELECT status FROM public.documents WHERE id = :'doc_restore'),
  'verified',
  'a restored active legacy document is accepted');
SELECT is(
  (SELECT uploaded_by FROM public.documents WHERE id = :'doc_restore'),
  :'advisor'::UUID,
  'backup restore preserves historical uploader attribution');
SELECT is(
  (SELECT verified_by FROM public.documents WHERE id = :'doc_restore'),
  :'advisor'::UUID,
  'backup restore preserves historical verifier attribution');
SELECT is(
  (SELECT verified_at FROM public.documents WHERE id = :'doc_restore'),
  '2025-01-02T03:04:05Z'::TIMESTAMPTZ,
  'backup restore preserves the historical verification timestamp');

SELECT ok(
  (SELECT convalidated
     FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass
      AND conname = 'documents_status_check'),
  'the active-document status constraint is validated');
SELECT is(
  (SELECT COUNT(*)::INT
     FROM public.documents
    WHERE deleted_at IS NULL AND status <> 'verified'),
  0,
  'there are no active non-accepted documents');

SELECT ok(
  (SELECT COALESCE(qual, '') || COALESCE(with_check, '')
     FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'documents'
      AND policyname = 'documents_update') LIKE '%upload_document%'
  AND NOT (
    (SELECT COALESCE(qual, '') || COALESCE(with_check, '')
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'documents'
        AND policyname = 'documents_update') LIKE '%verify_document%'
  ),
  'document updates require upload_document and do not honor verify_document');

SELECT ok(
  (SELECT COALESCE(qual, '') || COALESCE(with_check, '')
     FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'case_docs_update') LIKE '%upload_document%'
  AND NOT (
    (SELECT COALESCE(qual, '') || COALESCE(with_check, '')
       FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'case_docs_update') LIKE '%verify_document%'
  ),
  'Storage updates require upload_document and do not honor verify_document');

SELECT * FROM finish();
ROLLBACK;

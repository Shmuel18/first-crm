-- =============================================================================
-- Migration 139: retention purge — file-pointer gating + backstop (pgTAP)
-- =============================================================================
-- cleanup_soft_deleted_records() may finalize a `documents` / `case_expenses`
-- row only once BOTH file pointers are gone (Storage: storage_path/receipt_path;
-- Drive: drive_file_id/receipt_drive_id), and may purge a soft-deleted `cases`
-- row only when no surviving child document/expense has any pointer — UNLESS the
-- row is past the backstop (retention + 30d), which force-finalizes regardless
-- so retention is always bounded. Drive does NOT gate alone: a Drive-only doc
-- (drive_file_id set, no storage_path — how Drive-sync imports) must still wait,
-- else its live Drive copy is orphaned.
--
-- Retention is pinned to 14d here, so cutoff = -14d and backstop = -44d.
-- Fixtures at -30d are inside the gated window (retained iff a pointer remains);
-- fixtures at -90d are past the backstop (force-purged regardless). Runs as
-- superuser in a ROLLBACK txn.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

UPDATE public.office_settings SET deleted_records_retention_days = 14 WHERE id = 1;

\set c1 '11111111-1111-1111-1111-111111111111'
\set c2 '22222222-2222-2222-2222-222222222222'
\set c3 '33333333-3333-3333-3333-333333333333'
\set c4 '44444444-4444-4444-4444-444444444444'
\set cbk '55555555-5555-5555-5555-555555555555'
\set d1 'aaaaaaaa-0000-0000-0000-000000000001'
\set d2 'aaaaaaaa-0000-0000-0000-000000000002'
\set d3 'aaaaaaaa-0000-0000-0000-000000000003'
\set dbk 'aaaaaaaa-0000-0000-0000-0000000000bb'
\set dc2 'bbbbbbbb-0000-0000-0000-000000000002'
\set dc3 'bbbbbbbb-0000-0000-0000-000000000003'
\set dcbk 'bbbbbbbb-0000-0000-0000-0000000000bc'
\set e1 'cccccccc-0000-0000-0000-000000000001'
\set e2 'cccccccc-0000-0000-0000-000000000002'
\set e3 'cccccccc-0000-0000-0000-000000000003'
\set ec4 'dddddddd-0000-0000-0000-000000000004'

-- Active case; documents soft-deleted 30d ago (gated window).
INSERT INTO public.cases (id, deleted_at) VALUES (:'c1', NULL);
INSERT INTO public.documents (id, case_id, file_name, metadata, drive_file_id, deleted_at) VALUES
  (:'d1',  :'c1', 'f1',  '{"storage_path":"x/y.pdf"}'::jsonb, NULL,      NOW() - INTERVAL '30 days'),
  (:'d2',  :'c1', 'f2',  '{}'::jsonb,                          NULL,      NOW() - INTERVAL '30 days'),
  (:'d3',  :'c1', 'f3',  '{}'::jsonb,                          'drv-123', NOW() - INTERVAL '30 days'),
  -- past the backstop, still has a Storage blob → force-purged.
  (:'dbk', :'c1', 'fbk', '{"storage_path":"x/bk.pdf"}'::jsonb, NULL,      NOW() - INTERVAL '90 days');

-- Soft-deleted case (30d) whose child document still has a Storage blob → RETAINED.
INSERT INTO public.cases (id, deleted_at) VALUES (:'c2', NOW() - INTERVAL '30 days');
INSERT INTO public.documents (id, case_id, file_name, metadata, deleted_at) VALUES
  (:'dc2', :'c2', 'fc2', '{"storage_path":"a/b.pdf"}'::jsonb, NULL);

-- Soft-deleted case (30d) whose child document is file-less → PURGED.
INSERT INTO public.cases (id, deleted_at) VALUES (:'c3', NOW() - INTERVAL '30 days');
INSERT INTO public.documents (id, case_id, file_name, metadata, drive_file_id, deleted_at) VALUES
  (:'dc3', :'c3', 'fc3', '{}'::jsonb, NULL, NULL);

-- Soft-deleted case past the backstop, child still file-bearing → force-PURGED.
INSERT INTO public.cases (id, deleted_at) VALUES (:'cbk', NOW() - INTERVAL '90 days');
INSERT INTO public.documents (id, case_id, file_name, metadata, deleted_at) VALUES
  (:'dcbk', :'cbk', 'fcbk', '{"storage_path":"c/d.pdf"}'::jsonb, NULL);

-- Expense receipts: gating mirrors documents (receipt_path = Storage pointer).
INSERT INTO public.case_expenses (id, case_id, receipt_path, deleted_at) VALUES
  (:'e1', :'c1', 'x/expenses/r1.pdf', NOW() - INTERVAL '30 days'),
  (:'e2', :'c1', NULL,                NOW() - INTERVAL '30 days');
-- e3: Drive-only receipt (receipt_drive_id, no receipt_path) → RETAINED (Drive gates).
INSERT INTO public.case_expenses (id, case_id, receipt_drive_id, deleted_at) VALUES
  (:'e3', :'c1', 'drv-exp-3', NOW() - INTERVAL '30 days');
-- Soft-deleted case (30d) whose only file is an expense receipt → RETAINED.
INSERT INTO public.cases (id, deleted_at) VALUES (:'c4', NOW() - INTERVAL '30 days');
INSERT INTO public.case_expenses (id, case_id, receipt_path, deleted_at) VALUES
  (:'ec4', :'c4', 'a/expenses/r4.pdf', NULL);

SELECT public.cleanup_soft_deleted_records();

-- documents: BOTH-pointer gate
SELECT is((SELECT count(*)::int FROM public.documents WHERE id = :'d1'), 1,
  'doc with storage_path is RETAINED (Storage blob not yet erased)');
SELECT is((SELECT count(*)::int FROM public.documents WHERE id = :'d2'), 0,
  'file-less soft-deleted doc past retention is PURGED');
SELECT is((SELECT count(*)::int FROM public.documents WHERE id = :'d3'), 1,
  'Drive-only doc (drive_file_id, no storage_path) is RETAINED — Drive gates too');
SELECT is((SELECT count(*)::int FROM public.documents WHERE id = :'dbk'), 0,
  'doc past the backstop is force-PURGED despite a remaining Storage pointer');

-- cases: cascade gate + backstop
SELECT is((SELECT count(*)::int FROM public.cases WHERE id = :'c2'), 1,
  'case with a file-bearing document is RETAINED');
SELECT is((SELECT count(*)::int FROM public.documents WHERE id = :'dc2'), 1,
  'that retained case keeps its document');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id = :'c3'), 0,
  'case whose documents are all file-less is PURGED');
SELECT is((SELECT count(*)::int FROM public.documents WHERE id = :'dc3'), 0,
  'its file-less document is cascade-removed');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id = :'cbk'), 0,
  'case past the backstop is force-PURGED even with a file-bearing child');

-- expense receipts: same gate
SELECT is((SELECT count(*)::int FROM public.case_expenses WHERE id = :'e1'), 1,
  'expense with receipt_path is RETAINED');
SELECT is((SELECT count(*)::int FROM public.case_expenses WHERE id = :'e2'), 0,
  'file-less soft-deleted expense past retention is PURGED');
SELECT is((SELECT count(*)::int FROM public.case_expenses WHERE id = :'e3'), 1,
  'Drive-only expense (receipt_drive_id, no receipt_path) is RETAINED — Drive gates too');
SELECT is((SELECT count(*)::int FROM public.cases WHERE id = :'c4'), 1,
  'case with a file-bearing expense is RETAINED');
SELECT is((SELECT count(*)::int FROM public.case_expenses WHERE id = :'ec4'), 1,
  'that retained case keeps its expense');

SELECT * FROM finish();
ROLLBACK;

-- =============================================================================
-- PRIV-1: audit_log PII erasure on hard delete (pgTAP)
-- =============================================================================
-- Verifies migration 133: when an audited entity is permanently (hard) deleted,
-- its PII is redacted from audit_log.changed_fields while the forensic skeleton
-- (table_name, record_id, action, user_id, timestamp) survives — reconciling
-- audit retention with the right to erasure.
--
-- Runs as superuser (RLS bypassed) in a transaction that ROLLBACKs at the end.
-- The audit + redaction triggers fire regardless of role (SECURITY DEFINER).
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

\set b_id '99999999-9999-9999-9999-999999999999'

-- ---- structural: redaction triggers attached to the PII tables -------------
SELECT has_trigger('public', 'borrowers', 'trg_redact_audit_borrowers',
  'redaction trigger attached to borrowers');
SELECT has_trigger('public', 'leads', 'trg_redact_audit_leads',
  'redaction trigger attached to leads');
SELECT has_trigger('public', 'cases', 'trg_redact_audit_cases',
  'redaction trigger attached to cases');
SELECT has_trigger('public', 'case_financials', 'trg_redact_audit_case_financials',
  'redaction trigger attached to case_financials (case_id-keyed)');
SELECT has_trigger('public', 'profiles', 'trg_redact_audit_profiles',
  'redaction trigger attached to profiles');

-- ---- behavioural: a borrower's national_id is erased on hard delete --------
-- The INSERT fires trg_audit_borrowers → the audit row carries national_id.
INSERT INTO public.borrowers (id, national_id, first_name)
VALUES (:'b_id', '123456789', 'ErasureTest');

SELECT ok(
  (SELECT count(*) FROM public.audit_log
     WHERE table_name = 'borrowers' AND record_id = :'b_id'
       AND changed_fields::text LIKE '%123456789%') > 0,
  'precondition: national_id is present in audit_log before erasure');

-- Hard delete → trg_audit_borrowers (DELETE) then trg_redact_audit_borrowers.
DELETE FROM public.borrowers WHERE id = :'b_id';

SELECT is(
  (SELECT count(*)::int FROM public.audit_log
     WHERE table_name = 'borrowers' AND record_id = :'b_id'
       AND changed_fields::text LIKE '%123456789%'), 0,
  'national_id is erased from every audit row after hard delete');

SELECT ok(
  (SELECT count(*) FROM public.audit_log
     WHERE table_name = 'borrowers' AND record_id = :'b_id') >= 2,
  'audit skeleton rows survive (INSERT + DELETE) after erasure');

SELECT is(
  (SELECT count(*)::int FROM public.audit_log
     WHERE table_name = 'borrowers' AND record_id = :'b_id'
       AND NOT (changed_fields ? '_redacted')), 0,
  'every surviving audit row is marked _redacted');

SELECT ok(
  (SELECT count(*) FROM public.audit_log
     WHERE table_name = 'borrowers' AND record_id = :'b_id' AND action = 'DELETE') > 0,
  'the DELETE action skeleton is preserved');

-- ---- regression: audit_log stays immutable to unsanctioned mutations -------
-- The redaction function reset app.redact_audit to 'off', so the guard is armed.
SELECT throws_ok(
  $$ UPDATE public.audit_log SET changed_fields = '{"x":1}'::jsonb
       WHERE table_name = 'borrowers' $$,
  NULL, NULL,
  'immutability guard still blocks an unsanctioned UPDATE');

SELECT * FROM finish();
ROLLBACK;

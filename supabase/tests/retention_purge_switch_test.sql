-- =============================================================================
-- R4-legal-5: retention-purge master switch tests (pgTAP) — migration 173
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves office_settings.retention_purge_enabled gates the destructive pg purges:
--   * OFF (default) → cleanup_soft_deleted_records / cleanup_old_audit_logs no-op
--     and an old soft-deleted row is preserved.
--   * ON  → the purge runs and the old row is finalized.
-- Whole file ROLLBACKs at the end.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

\set old_lead 'cccccccc-cccc-cccc-cccc-cccccccccccc'

-- Default-paused switch + an old soft-deleted lead (100d > retention+grace).
UPDATE public.office_settings SET retention_purge_enabled = FALSE WHERE id = 1;
INSERT INTO public.leads (id, first_name, status, deleted_at)
VALUES (:'old_lead', 'OldLead', 'active', now() - interval '100 days');

-- ---- switch OFF: every destructive purge is a no-op -------------------------
SELECT is(
  (SELECT public.cleanup_soft_deleted_records() ->> 'skipped'),
  'retention_purge_disabled',
  'cleanup_soft_deleted_records is a no-op while the switch is OFF');

SELECT is(
  (SELECT count(*)::int FROM public.leads WHERE id = :'old_lead'),
  1,
  'an old soft-deleted lead is NOT purged while the switch is OFF');

SELECT is(
  (SELECT public.cleanup_old_audit_logs()),
  0,
  'cleanup_old_audit_logs returns 0 (no-op) while the switch is OFF');

-- ---- switch ON: the purge runs ---------------------------------------------
UPDATE public.office_settings SET retention_purge_enabled = TRUE WHERE id = 1;
SELECT public.cleanup_soft_deleted_records();
SELECT is(
  (SELECT count(*)::int FROM public.leads WHERE id = :'old_lead'),
  0,
  'the old soft-deleted lead IS purged once the switch is ON');

SELECT * FROM finish();
ROLLBACK;

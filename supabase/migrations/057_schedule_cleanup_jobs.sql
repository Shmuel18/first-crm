-- =============================================================================
-- Migration 057: Schedule the cleanup RPCs via pg_cron
-- =============================================================================
-- Three cleanup functions exist (cleanup_old_audit_logs, cleanup_soft_deleted_
-- records, cleanup_rate_limit_counters) but nothing in this codebase ever
-- calls them. audit_log, soft-deleted rows, and rate_limit_counters all grow
-- unbounded; over months that's index bloat + slower scans.
--
-- pg_cron solves it without any extra infra. Supabase has it preinstalled
-- but typically requires CREATE EXTENSION the first time. cron jobs run as
-- the postgres role, so they bypass RLS — exactly what these
-- SECURITY DEFINER functions need.
--
-- PRE-DEPLOYMENT — confirm the extension is available:
--   SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';
-- And that the rate-limit cleanup runs cleanly in your test env first
-- (the audit_log immutability trigger from migration 049 only allows the
-- DELETE through cleanup_old_audit_logs — the function knows to flip the
-- session GUC, but a regression here would silently disable retention).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing schedules (re-runnable migration).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid FROM cron.job
            WHERE jobname IN (
              'kfg_purge_audit_log',
              'kfg_purge_soft_deleted',
              'kfg_purge_rate_limit_counters'
            )
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

-- Daily at 03:00 UTC: prune audit_log per office_settings.audit_log_retention_days.
SELECT cron.schedule(
  'kfg_purge_audit_log',
  '0 3 * * *',
  $$ SELECT public.cleanup_old_audit_logs(); $$
);

-- Daily at 03:15 UTC: hard-delete rows that have been soft-deleted past the
-- recovery window (cleanup_soft_deleted_records sets its own threshold).
SELECT cron.schedule(
  'kfg_purge_soft_deleted',
  '15 3 * * *',
  $$ SELECT public.cleanup_soft_deleted_records(); $$
);

-- Hourly: trim rate-limit counters older than a day. They accumulate every
-- expensive action, every login attempt, etc. — fast growth even at small
-- traffic.
SELECT cron.schedule(
  'kfg_purge_rate_limit_counters',
  '5 * * * *',
  $$ SELECT public.cleanup_rate_limit_counters(); $$
);

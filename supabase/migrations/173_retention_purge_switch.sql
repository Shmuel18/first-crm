-- =============================================================================
-- Migration 173: retention-purge master switch (R4-legal-5)
-- =============================================================================
-- The destructive retention purges hard-DELETE data per office_settings
-- retention defaults (audit_log_retention_days=365, deleted_records_retention_days
-- =14). The 14-day soft-delete + FILE purge would erase borrower/case/document
-- records (and their Storage/Drive files) an Israeli mortgage office is plausibly
-- obliged to keep for years. Unscheduling pg_cron alone was INSUFFICIENT: the
-- file eraser runs as a Vercel cron route (cleanup-orphaned-blobs), not pg_cron,
-- so it kept deleting files.
--
-- Fix: ONE explicit DB switch, office_settings.retention_purge_enabled, defaulting
-- to FALSE (paused). EVERY destructive path honors it:
--   - cleanup_old_audit_logs()        (pg, gated here)
--   - cleanup_soft_deleted_records()  (pg, gated here)
--   - retention-file-eraser / cleanup-orphaned-blobs (TS, reads the switch)
--   - erasure-watchdog                (TS, stays quiet while paused — no false alerts)
--
-- No retention period is set (a legal decision). Re-enable later by flipping the
-- switch to TRUE once counsel sets a lawful period:
--   UPDATE public.office_settings SET retention_purge_enabled = TRUE WHERE id = 1;
--
-- The two pg functions are GATED by RENAME-to-_impl + a thin wrapper, so the
-- existing (large) bodies stay byte-identical and only get a switch check in front.
--
-- Idempotent. Dependencies: 010 (office_settings), 063 (audit purge),
-- 144 (soft-delete purge body), 143 (schema_version).
-- =============================================================================

-- ---- (1) the switch (paused by default) -------------------------------------
ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS retention_purge_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.office_settings.retention_purge_enabled IS
  'Master switch for ALL destructive retention purges (audit, soft-deleted rows, Storage/Drive files). FALSE = paused (default) pending a lawful retention period. Honored by cleanup_old_audit_logs, cleanup_soft_deleted_records, the file eraser, and the erasure-watchdog (mig 173).';

CREATE OR REPLACE FUNCTION public.retention_purge_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT retention_purge_enabled FROM public.office_settings WHERE id = 1), FALSE);
$$;
REVOKE ALL ON FUNCTION public.retention_purge_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retention_purge_enabled() TO service_role;

-- ---- (2) gate cleanup_old_audit_logs() (RETURNS INT) ------------------------
DO $$
BEGIN
  IF to_regprocedure('public.cleanup_old_audit_logs_impl()') IS NULL THEN
    ALTER FUNCTION public.cleanup_old_audit_logs() RENAME TO cleanup_old_audit_logs_impl;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.retention_purge_enabled() THEN
    RETURN 0;  -- retention purge paused (mig 173)
  END IF;
  RETURN public.cleanup_old_audit_logs_impl();
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs_impl() FROM PUBLIC;

-- ---- (3) gate cleanup_soft_deleted_records() (RETURNS JSONB) ----------------
DO $$
BEGIN
  IF to_regprocedure('public.cleanup_soft_deleted_records_impl()') IS NULL THEN
    ALTER FUNCTION public.cleanup_soft_deleted_records() RENAME TO cleanup_soft_deleted_records_impl;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.retention_purge_enabled() THEN
    RETURN jsonb_build_object('skipped', 'retention_purge_disabled');  -- mig 173
  END IF;
  RETURN public.cleanup_soft_deleted_records_impl();
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_soft_deleted_records() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_soft_deleted_records_impl() FROM PUBLIC;

INSERT INTO public.schema_version (version) VALUES (173) ON CONFLICT DO NOTHING;

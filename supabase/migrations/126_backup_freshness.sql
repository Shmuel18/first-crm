-- =============================================================================
-- Migration 126: backup freshness + staleness watchdog support (SRE-2 core)
-- =============================================================================
-- The nightly backup (/api/cron/backup) had NO persisted success marker, so
-- nothing could detect "backups stopped" (e.g. Drive disconnected → it skips
-- every night silently). This adds a last-success timestamp + helper RPCs for:
--   * the backup route to stamp success,
--   * a watchdog cron to read it + alert admins when stale,
--   * the Settings → Integrations card to show backup health.
-- All are SECURITY DEFINER + granted to service_role only (called via the
-- service-role admin client from CRON_SECRET-gated routes / the admin-gated
-- settings page). The in-app bell alert is a deliberate follow-up.
-- =============================================================================

ALTER TABLE public.office_settings ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMPTZ;
COMMENT ON COLUMN public.office_settings.last_backup_at IS
  'Set by /api/cron/backup on a verified success; backup-watchdog alerts admins if NULL or older than the staleness window (26h).';

-- Stamp a verified backup success. Upsert so it works even if the singleton
-- office_settings row was never seeded.
CREATE OR REPLACE FUNCTION public.record_backup_success()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.office_settings (id, last_backup_at)
  VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET last_backup_at = now();
$$;

CREATE OR REPLACE FUNCTION public.get_last_backup_at()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT last_backup_at FROM public.office_settings WHERE id = 1;
$$;

-- Emails of every active admin — the recipients for infrastructure alerts.
CREATE OR REPLACE FUNCTION public.active_admin_emails()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
   WHERE r.key = 'admin'
     AND p.is_active = TRUE
     AND p.deleted_at IS NULL
     AND p.email IS NOT NULL
     AND length(btrim(p.email)) > 0;
$$;

REVOKE ALL ON FUNCTION public.record_backup_success() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_last_backup_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.active_admin_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_backup_success() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_last_backup_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.active_admin_emails() TO service_role;

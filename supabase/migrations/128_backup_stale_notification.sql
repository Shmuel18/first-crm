-- =============================================================================
-- Migration 128: in-app bell alert for stale backups (SRE-2 follow-up)
-- =============================================================================
-- SRE-2 core (mig 126) added the watchdog + email + Settings indicator. This
-- adds the in-app bell channel: backup-watchdog inserts a 'backup_stale'
-- notification for each active admin, deduped to one UNREAD alert per admin so
-- the daily run doesn't stack duplicates, and auto-resolved when a backup next
-- succeeds. Realtime (mig 127) delivers it instantly if an admin is online.
-- =============================================================================

-- 1) Allow the new notification type (re-state the full set, per 068/098/108).
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned', 'task_completed', 'case_status_overdue',
    'task_reminder', 'case_mention', 'backup_stale'
  ));

-- 2) Dedupe: at most one UNREAD backup_stale per admin. ON CONFLICT DO NOTHING
--    infers this partial unique index (mirrors the overdue dedupe, mig 073).
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_backup_stale_unread
  ON public.notifications (user_id)
  WHERE type = 'backup_stale' AND read_at IS NULL;

-- 3) Insert a backup_stale bell for every active admin (race/dup-safe).
CREATE OR REPLACE FUNCTION public.notify_admins_backup_stale(p_last_backup_at timestamptz DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.profiles p
      JOIN public.roles rr ON rr.id = p.role_id
     WHERE rr.key = 'admin' AND p.is_active = TRUE AND p.deleted_at IS NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, data)
    VALUES (r.id, 'backup_stale', jsonb_build_object('lastBackupAt', p_last_backup_at))
    ON CONFLICT (user_id) WHERE type = 'backup_stale' AND read_at IS NULL DO NOTHING;
    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

-- 4) Auto-resolve open backup-stale alerts once a backup succeeds (replaces the
--    mig-126 version, which only stamped the timestamp).
CREATE OR REPLACE FUNCTION public.record_backup_success()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.office_settings (id, last_backup_at)
  VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET last_backup_at = now();

  UPDATE public.notifications
     SET read_at = now()
   WHERE type = 'backup_stale' AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_backup_stale(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_backup_stale(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_backup_success() TO service_role;

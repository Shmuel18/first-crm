-- =============================================================================
-- Migration 144: PII-erasure observability — freshness watchdog + orphan audit
-- =============================================================================
-- RELEASE_REVIEW P0 residuals on the LEGAL-3 erasure path (migration 139 fixed
-- the ordering race; these close the two remaining gaps):
--
--   (a) NO failure alerting. /api/cron/cleanup-orphaned-blobs returns a HANDLED
--       500 on failure (it does not throw, so Sentry's onRequestError never
--       fires) and there is no freshness watchdog — a silently dead eraser would
--       go unnoticed indefinitely. FIX: stamp office_settings.last_erasure_at on
--       every successful run + an erasure-watchdog cron that alerts admins (email
--       + in-app bell) when the eraser has not succeeded in the staleness window.
--       Mirrors the backup watchdog (migrations 126 + 128).
--
--   (b) The retention BACKSTOP (migration 139) force-finalizes a soft-deleted row
--       past retention+grace REGARDLESS of whether its Storage/Drive pointer was
--       erased (this bounds retention even when Drive is permanently disconnected
--       — the right product call). But it DESTROYS the only pointer to a blob the
--       cron never managed to erase, silently. FIX: erasure_orphan_log records
--       every pointer the purge force-finalizes while still non-null, so a leaked
--       file is recoverable for manual cleanup instead of lost forever.
--
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE). Dependencies: 139 (prior purge
-- body), 126/128 (backup-watchdog pattern), 010 (office_settings), 002 (is_admin).
-- =============================================================================

-- --- (a) freshness marker + helper RPCs --------------------------------------
ALTER TABLE public.office_settings ADD COLUMN IF NOT EXISTS last_erasure_at TIMESTAMPTZ;
COMMENT ON COLUMN public.office_settings.last_erasure_at IS
  'Set by /api/cron/cleanup-orphaned-blobs on a successful run (even a 0-file run — it proves the cron fired and the eraser did not error); erasure-watchdog alerts admins if NULL or older than the staleness window (26h).';

CREATE OR REPLACE FUNCTION public.get_last_erasure_at()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT last_erasure_at FROM public.office_settings WHERE id = 1;
$$;

-- --- (a) erasure_stale notification (mirror backup_stale, migrations 128/134) --
-- Re-state the full type set (per 068/098/108/128/134) + the new member.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'task_completed',
    'case_status_overdue',
    'task_reminder',
    'case_mention',
    'task_mention',
    'backup_stale',
    'erasure_stale'
  ));

-- Dedupe: at most one UNREAD erasure_stale per admin (mirrors backup, mig 128).
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_erasure_stale_unread
  ON public.notifications (user_id)
  WHERE type = 'erasure_stale' AND read_at IS NULL;

CREATE OR REPLACE FUNCTION public.notify_admins_erasure_stale(p_last_erasure_at timestamptz DEFAULT NULL)
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
    VALUES (r.id, 'erasure_stale', jsonb_build_object('lastErasureAt', p_last_erasure_at))
    ON CONFLICT (user_id) WHERE type = 'erasure_stale' AND read_at IS NULL DO NOTHING;
    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

-- Stamp a successful erasure run + auto-resolve any open erasure-stale bell.
CREATE OR REPLACE FUNCTION public.record_erasure_success()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.office_settings (id, last_erasure_at)
  VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET last_erasure_at = now();

  UPDATE public.notifications
     SET read_at = now()
   WHERE type = 'erasure_stale' AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_last_erasure_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins_erasure_stale(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_erasure_success() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_last_erasure_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_admins_erasure_stale(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_erasure_success() TO service_role;

-- --- (b) orphan audit log -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.erasure_orphan_log (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity         TEXT NOT NULL CHECK (entity IN ('document', 'expense')),
  row_id         UUID NOT NULL,
  storage_path   TEXT,
  drive_file_id  TEXT,
  deleted_at     TIMESTAMPTZ,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.erasure_orphan_log IS
  'LEGAL-3 audit: one row per Storage/Drive pointer that cleanup_soft_deleted_records() force-finalized past the retention backstop while the file was NOT yet erased (e.g. Drive disconnected). The owning DB row is gone; this preserves the path/id so the leaked file can be cleaned up manually. Written by the SECURITY DEFINER purge; admin read-only.';

ALTER TABLE public.erasure_orphan_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erasure_orphan_log_select ON public.erasure_orphan_log;
CREATE POLICY erasure_orphan_log_select ON public.erasure_orphan_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- --- (b) purge now logs every pointer it force-finalizes past the backstop ----
-- Identical to migration 139 EXCEPT for the three erasure_orphan_log INSERTs that
-- run immediately before each force-finalizing DELETE. A row past the backstop is
-- deleted regardless of pointers, so we capture any still-present pointer first.
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Extra grace, after the recovery window, for the cron to erase files before
  -- the row is force-finalized regardless of pointers (bounds retention even
  -- when Drive is unreachable or a blob is missing).
  grace_days CONSTANT INT := 30;
  retention_days INT;
  cutoff TIMESTAMPTZ;
  backstop TIMESTAMPTZ;
  count_leads INT;
  count_cases INT;
  count_borrowers INT;
  count_documents INT;
  count_case_banks INT;
  count_tasks INT;
  count_case_expenses INT;
  count_orphans INT := 0;
  tmp_orphans INT;
BEGIN
  SELECT deleted_records_retention_days INTO retention_days
  FROM public.office_settings WHERE id = 1;
  retention_days := GREATEST(1, COALESCE(retention_days, 14));
  cutoff   := NOW() - (retention_days || ' days')::INTERVAL;
  backstop := NOW() - ((retention_days + grace_days) || ' days')::INTERVAL;

  DELETE FROM public.leads WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_leads = ROW_COUNT;

  -- AUDIT (LEGAL-3): a case past the backstop is force-finalized regardless of
  -- pointers; the FK cascade then deletes its child documents/expenses, losing
  -- the pointer to any file the cron never erased. Record those pointers FIRST
  -- (backstop < cutoff always, so `< backstop` implies the row is purge-eligible).
  INSERT INTO public.erasure_orphan_log (entity, row_id, storage_path, drive_file_id, deleted_at)
  SELECT 'document', d.id, d.metadata->>'storage_path', d.drive_file_id, c.deleted_at
    FROM public.cases c
    JOIN public.documents d ON d.case_id = c.id
   WHERE c.deleted_at IS NOT NULL AND c.deleted_at < backstop
     AND ((d.metadata->>'storage_path') IS NOT NULL OR d.drive_file_id IS NOT NULL);
  GET DIAGNOSTICS tmp_orphans = ROW_COUNT;
  count_orphans := count_orphans + tmp_orphans;

  INSERT INTO public.erasure_orphan_log (entity, row_id, storage_path, drive_file_id, deleted_at)
  SELECT 'expense', e.id, e.receipt_path, e.receipt_drive_id, c.deleted_at
    FROM public.cases c
    JOIN public.case_expenses e ON e.case_id = c.id
   WHERE c.deleted_at IS NOT NULL AND c.deleted_at < backstop
     AND (e.receipt_path IS NOT NULL OR e.receipt_drive_id IS NOT NULL);
  GET DIAGNOSTICS tmp_orphans = ROW_COUNT;
  count_orphans := count_orphans + tmp_orphans;

  -- Cases: skip while any child document/expense still has a Storage OR Drive
  -- pointer (the cascade would orphan those files) — unless past the backstop.
  DELETE FROM public.cases c
   WHERE c.deleted_at IS NOT NULL AND c.deleted_at < cutoff
     AND (
       (
         NOT EXISTS (
           SELECT 1 FROM public.documents d
            WHERE d.case_id = c.id
              AND ((d.metadata->>'storage_path') IS NOT NULL OR d.drive_file_id IS NOT NULL)
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.case_expenses e
            WHERE e.case_id = c.id
              AND (e.receipt_path IS NOT NULL OR e.receipt_drive_id IS NOT NULL)
         )
       )
       OR c.deleted_at < backstop
     );
  GET DIAGNOSTICS count_cases = ROW_COUNT;

  DELETE FROM public.borrowers WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_borrowers = ROW_COUNT;

  -- Documents: audit then finalize once BOTH file pointers are erased, or past
  -- the backstop. (Cascade-doomed children of backstopped cases were already
  -- removed + logged above; this catches DIRECTLY soft-deleted documents.)
  INSERT INTO public.erasure_orphan_log (entity, row_id, storage_path, drive_file_id, deleted_at)
  SELECT 'document', id, metadata->>'storage_path', drive_file_id, deleted_at
    FROM public.documents
   WHERE deleted_at IS NOT NULL AND deleted_at < backstop
     AND ((metadata->>'storage_path') IS NOT NULL OR drive_file_id IS NOT NULL);
  GET DIAGNOSTICS tmp_orphans = ROW_COUNT;
  count_orphans := count_orphans + tmp_orphans;

  DELETE FROM public.documents
   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff
     AND (
       ((metadata->>'storage_path') IS NULL AND drive_file_id IS NULL)
       OR deleted_at < backstop
     );
  GET DIAGNOSTICS count_documents = ROW_COUNT;

  -- Expense receipts: same contract.
  INSERT INTO public.erasure_orphan_log (entity, row_id, storage_path, drive_file_id, deleted_at)
  SELECT 'expense', id, receipt_path, receipt_drive_id, deleted_at
    FROM public.case_expenses
   WHERE deleted_at IS NOT NULL AND deleted_at < backstop
     AND (receipt_path IS NOT NULL OR receipt_drive_id IS NOT NULL);
  GET DIAGNOSTICS tmp_orphans = ROW_COUNT;
  count_orphans := count_orphans + tmp_orphans;

  DELETE FROM public.case_expenses
   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff
     AND (
       (receipt_path IS NULL AND receipt_drive_id IS NULL)
       OR deleted_at < backstop
     );
  GET DIAGNOSTICS count_case_expenses = ROW_COUNT;

  DELETE FROM public.case_banks WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_case_banks = ROW_COUNT;

  DELETE FROM public.tasks WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_tasks = ROW_COUNT;

  RETURN jsonb_build_object(
    'leads', count_leads,
    'cases', count_cases,
    'borrowers', count_borrowers,
    'documents', count_documents,
    'case_expenses', count_case_expenses,
    'case_banks', count_case_banks,
    'tasks', count_tasks,
    'orphans_logged', count_orphans,
    'cutoff', cutoff,
    'backstop', backstop
  );
END;
$$;

INSERT INTO public.schema_version (version) VALUES (144) ON CONFLICT DO NOTHING;

-- =============================================================================
-- Migration 063: Partition audit_log by month + retention via DROP PARTITION
-- =============================================================================
-- Audit log grows unbounded per the existing schema — every UPDATE produces a
-- JSONB-diff row. At ~50 audit rows / case + 80 active cases × ~3 years =
-- ~12K rows today; multi-tenant or +retention extension takes us into the
-- 100K-1M zone where:
--   - DELETE-based cleanup (migration 049) chews through index pages
--   - The single-table heap scan for "show me history for record X" trends slow
--
-- Range-partition by month flips this:
--   - cleanup_old_audit_logs becomes O(partitions to drop) instead of
--     O(rows to delete) — DROP TABLE is constant-time at any partition size
--   - Each partition is a separately-indexed heap; queries with timestamp
--     filters touch only the relevant slice via partition pruning
--   - Future tier moves (cold storage, S3 export) can DETACH old partitions
--     and ship them out without disturbing the live system
--
-- Existing INSERT traffic from audit triggers (migrations 012/022/045/054)
-- works unchanged — Postgres routes new rows to the right partition by
-- `timestamp` automatically.
--
-- Safety: this migration recreates the audit_log table. On dev DB the data
-- volume is small (test rows); on prod the same code path will copy whatever
-- exists in O(rows). Run during a maintenance window when scaling up — at
-- 80-case load this completes in well under a second.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Detach the immutability trigger before we DROP — the trigger function
--    survives because it lives in the catalog, but the trigger binding goes
--    with the table.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_log_block_mutations ON public.audit_log;

-- -----------------------------------------------------------------------------
-- 2. New partitioned table. Partition key MUST be included in the primary
--    key (Postgres requirement), so the PK becomes (id, timestamp). id alone
--    is still unique because it's gen_random_uuid().
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_log_new (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE', 'EXPORT')),
  changed_fields JSONB,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- -----------------------------------------------------------------------------
-- 3. Default partition — catches anything outside the named monthly windows
--    (old data + edge cases until we cycle past).
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_log_default PARTITION OF public.audit_log_new DEFAULT;

-- -----------------------------------------------------------------------------
-- 4. Named monthly partitions: 12 months back + current + 12 months forward.
--    Names follow audit_log_YYYY_MM. The forward partitions let new INSERTs
--    route correctly without a partition-creation race on month boundaries.
-- -----------------------------------------------------------------------------
DO $partitions$
DECLARE
  m_start DATE := date_trunc('month', now() - interval '12 months')::date;
  m_end DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..24 LOOP
    m_end := (m_start + interval '1 month')::date;
    partition_name := 'audit_log_' || to_char(m_start, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_log_new FOR VALUES FROM (%L) TO (%L)',
      partition_name, m_start, m_end
    );
    m_start := m_end;
  END LOOP;
END $partitions$;

-- -----------------------------------------------------------------------------
-- 5. Copy existing data. Triggers + RLS on the OLD table don't fire for the
--    INSERT INTO ... SELECT path on the NEW table — the new table has no
--    triggers yet (we add them after the rename).
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_log_new
  (id, table_name, record_id, action, changed_fields, user_id, ip_address, user_agent, timestamp)
SELECT
  id, table_name, record_id, action, changed_fields, user_id, ip_address, user_agent, timestamp
FROM public.audit_log;

-- -----------------------------------------------------------------------------
-- 6. Drop the old table. CASCADE removes the FK from public.audit_log.user_id
--    → profiles(id) and the RLS policy we'll recreate below.
-- -----------------------------------------------------------------------------
DROP TABLE public.audit_log CASCADE;

-- -----------------------------------------------------------------------------
-- 7. Rename new table to audit_log. References from other code (audit
--    triggers on cases/borrowers/case_banks/etc.) resolve by name and pick
--    up the new table automatically.
-- -----------------------------------------------------------------------------
ALTER TABLE public.audit_log_new RENAME TO audit_log;

-- -----------------------------------------------------------------------------
-- 8. Re-attach the FK to profiles. Same shape as the original (migration 010).
-- -----------------------------------------------------------------------------
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- -----------------------------------------------------------------------------
-- 9. Re-create indexes. Created on parent → propagate to all current and
--    future partitions. Names match the originals so any tooling that names
--    indexes (rare) still works.
-- -----------------------------------------------------------------------------
CREATE INDEX idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_timestamp ON public.audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_changed_fields_gin
  ON public.audit_log USING GIN (changed_fields jsonb_path_ops)
  WHERE changed_fields IS NOT NULL;
CREATE INDEX idx_audit_log_user_record
  ON public.audit_log(user_id, table_name, record_id);

-- -----------------------------------------------------------------------------
-- 10. Re-enable RLS + re-create the admin-only SELECT policy (migration 022).
--     RLS on partitioned tables applies the parent policy to all partitions
--     in PG 11+, so this single CREATE POLICY covers every partition.
-- -----------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 11. Re-create the immutability trigger (migration 049). Same trigger function
--     audit_log_block_mutations is unchanged; only the trigger binding is new.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_audit_log_block_mutations
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_block_mutations();

-- =============================================================================
-- 12. Helper to auto-create future monthly partitions (called by pg_cron).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ensure_audit_log_partitions_ahead(p_months INT DEFAULT 6)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_created INT := 0;
  m_start DATE := date_trunc('month', now())::date;
  m_end DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..p_months LOOP
    m_end := (m_start + interval '1 month')::date;
    partition_name := 'audit_log_' || to_char(m_start, 'YYYY_MM');
    BEGIN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
        partition_name, m_start, m_end
      );
      v_created := v_created + 1;
    EXCEPTION
      WHEN duplicate_table THEN
        NULL; -- already exists, skip
    END;
    m_start := m_end;
  END LOOP;
  RETURN v_created;
END;
$fn$;

-- =============================================================================
-- 13. Rewrite cleanup_old_audit_logs to DROP PARTITION instead of DELETE.
-- =============================================================================
-- Constant-time per partition. Also flushes anything in the default
-- partition that's past the retention cutoff (DELETE there because we
-- can't drop a default partition — it has no fixed range).
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_retention_days INT;
  v_cutoff TIMESTAMPTZ;
  v_dropped INT := 0;
  v_default_deleted INT;
  v_partition_record RECORD;
  v_month_str TEXT;
  v_partition_month DATE;
BEGIN
  SELECT audit_log_retention_days INTO v_retention_days
    FROM public.office_settings WHERE id = 1;
  IF v_retention_days IS NULL OR v_retention_days <= 0 THEN
    v_retention_days := 365;
  END IF;
  v_cutoff := now() - (v_retention_days || ' days')::interval;

  -- DROP monthly partitions whose entire range ended before the cutoff.
  FOR v_partition_record IN
    SELECT c.relname AS partition_name
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.relname = 'audit_log'
       AND n.nspname = 'public'
       AND c.relname ~ '^audit_log_\d{4}_\d{2}$'
  LOOP
    v_month_str := substring(v_partition_record.partition_name from 'audit_log_(\d{4}_\d{2})$');
    v_partition_month := to_date(v_month_str, 'YYYY_MM');
    -- partition covers [v_partition_month, v_partition_month + 1 month).
    -- Safe to drop only if its entire range is older than the cutoff.
    IF v_partition_month + interval '1 month' <= v_cutoff THEN
      EXECUTE format('DROP TABLE public.%I', v_partition_record.partition_name);
      v_dropped := v_dropped + 1;
    END IF;
  END LOOP;

  -- The default partition holds anything outside the named ranges (rare —
  -- usually only if our partition-ahead job lagged). Purge old rows there
  -- via DELETE since DROP isn't an option for a DEFAULT partition.
  PERFORM set_config('app.purge_audit', 'on', true);
  DELETE FROM ONLY public.audit_log_default WHERE timestamp < v_cutoff;
  GET DIAGNOSTICS v_default_deleted = ROW_COUNT;

  -- Return monthly-partition drop count + default-purge delete count.
  RETURN v_dropped + v_default_deleted;
END;
$fn$;

-- =============================================================================
-- 14. Schedule the partition-ahead helper alongside the existing cleanup.
-- =============================================================================
-- Unschedule any previous binding so re-running this migration stays clean.
DO $sched$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'kfg_ensure_audit_partitions'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $sched$;

-- Daily at 01:00 UTC: ensure 6 months of future partitions exist so the
-- 1st-of-month INSERT traffic never falls back to the default partition.
SELECT cron.schedule(
  'kfg_ensure_audit_partitions',
  '0 1 * * *',
  $cron$ SELECT public.ensure_audit_log_partitions_ahead(6); $cron$
);

COMMIT;

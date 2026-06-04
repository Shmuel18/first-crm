-- =============================================================================
-- Migration 141: enable RLS on audit_log partitions
-- =============================================================================
-- Supabase security advisors inspect child partitions directly. Migration 063
-- enabled RLS + admin-only SELECT on the partitioned parent (`audit_log`) and
-- Postgres applies the parent policy when querying through the parent table,
-- but the child tables themselves still reported `relrowsecurity = false`.
--
-- Risk: a direct PostgREST request against a child relation such as
-- `audit_log_2026_06` can bypass the parent relation entirely. Enabling RLS on
-- every child partition closes that direct-child path. We intentionally do NOT
-- create child policies: app reads go through `audit_log` and inherit the
-- parent admin-only policy; direct child access is denied to anon/authenticated.
--
-- Also update the partition-ahead helper so new monthly partitions are born
-- with RLS enabled, preventing the advisory from returning next month.
-- =============================================================================

DO $enable_existing$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS qualified_name
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.relname = 'audit_log'
       AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.qualified_name);
  END LOOP;
END $enable_existing$;

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

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', partition_name);
    m_start := m_end;
  END LOOP;
  RETURN v_created;
END;
$fn$;

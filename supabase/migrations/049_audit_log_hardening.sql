-- =============================================================================
-- Migration 049: Audit log immutability + GIN on changed_fields
-- =============================================================================
-- Closes two audit-log gaps the pre-prod audit flagged:
--
-- 1. INSERT-only-by-design but no DB-level guard.
--    RLS on audit_log (migration 011) only grants SELECT to admins; INSERT
--    happens through the SECURITY DEFINER trigger function. But there's
--    nothing preventing a future migration or a leaked service_role key
--    from UPDATEing or DELETing rows. Regulatory evidence has to be tamper-
--    proof at the DB layer, not by policy convention.
--    Fix: BEFORE UPDATE/DELETE trigger that raises unless an opt-in
--    session GUC is set. Only cleanup_old_audit_logs sets it.
--
-- 2. JSONB queries on `changed_fields` (e.g. "show me every time fee_amount
--    moved") do a sequential scan of the whole table because there's no GIN.
--    Fix: jsonb_path_ops GIN index — covers the @> and ? operators that the
--    audit timeline query uses.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_log_block_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Opt-in escape hatch for the retention purge. The cleanup function
  -- SET LOCAL's this to 'on' before its DELETE; that's the only path that
  -- can mutate audit_log. Any other UPDATE/DELETE — manual session,
  -- service_role from a script, a future buggy migration — raises.
  IF coalesce(current_setting('app.purge_audit', true), 'off') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_log rows are immutable (operation: %)', TG_OP
    USING HINT = 'Audit history cannot be modified. The only sanctioned path is the cleanup_old_audit_logs retention job.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_block_mutations ON public.audit_log;
CREATE TRIGGER trg_audit_log_block_mutations
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_block_mutations();

-- Update the retention cleanup to flip the opt-in GUC before DELETing.
-- (cleanup_old_audit_logs was created in migration 022.)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retention_days INT;
  v_count INT;
BEGIN
  SELECT audit_log_retention_days INTO v_retention_days
    FROM public.office_settings
   WHERE id = 1;
  IF v_retention_days IS NULL OR v_retention_days <= 0 THEN
    v_retention_days := 365;
  END IF;

  -- SET LOCAL only sticks for this transaction; the block trigger reads
  -- it and lets the DELETE through.
  PERFORM set_config('app.purge_audit', 'on', true);

  DELETE FROM public.audit_log
   WHERE timestamp < now() - (v_retention_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- GIN on changed_fields. jsonb_path_ops gives smaller indexes + faster
-- containment / key-exists queries than the default. Predicate excludes
-- NULL rows (deletions with no diff) to keep the index tight.
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_fields_gin
  ON public.audit_log USING GIN (changed_fields jsonb_path_ops)
  WHERE changed_fields IS NOT NULL;

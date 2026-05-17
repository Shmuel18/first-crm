-- =============================================================================
-- Migration 012: Audit Log Triggers
-- =============================================================================
-- Purpose: Automatic audit logging for main entity changes
-- Dependencies: All previous migrations
-- Pattern: AFTER INSERT/UPDATE/DELETE triggers → log to audit_log
-- =============================================================================

-- =============================================================================
-- Generic audit log function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.audit_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_data JSONB;
  action_type TEXT;
  record_id_value UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'INSERT';
    record_id_value := NEW.id;
    changed_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    record_id_value := NEW.id;
    -- Check if it's a soft delete or restore
    IF (TG_TABLE_NAME IN ('leads', 'cases', 'borrowers', 'documents'))
       AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      action_type := 'SOFT_DELETE';
    ELSIF (TG_TABLE_NAME IN ('leads', 'cases', 'borrowers', 'documents'))
          AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      action_type := 'RESTORE';
    ELSE
      action_type := 'UPDATE';
    END IF;

    -- Compute changed fields
    SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
    INTO changed_data
    FROM (
      SELECT
        key,
        (to_jsonb(OLD) -> key) AS old_val,
        (to_jsonb(NEW) -> key) AS new_val
      FROM jsonb_object_keys(to_jsonb(NEW)) AS key
      WHERE (to_jsonb(OLD) -> key) IS DISTINCT FROM (to_jsonb(NEW) -> key)
        AND key NOT IN ('updated_at', 'updated_by')
    ) sub
    WHERE old_val IS DISTINCT FROM new_val;
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'DELETE';
    record_id_value := OLD.id;
    changed_data := to_jsonb(OLD);
  END IF;

  -- Skip if nothing actually changed (UPDATE with no real diff)
  IF action_type = 'UPDATE' AND (changed_data IS NULL OR changed_data = '{}'::jsonb) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_log (
    table_name, record_id, action, changed_fields, user_id, timestamp
  ) VALUES (
    TG_TABLE_NAME,
    record_id_value,
    action_type,
    changed_data,
    auth.uid(),
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- Attach audit triggers to main entity tables
-- =============================================================================

-- Leads
CREATE TRIGGER trg_audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Cases
CREATE TRIGGER trg_audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Borrowers
CREATE TRIGGER trg_audit_borrowers
  AFTER INSERT OR UPDATE OR DELETE ON public.borrowers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Borrower Incomes
CREATE TRIGGER trg_audit_borrower_incomes
  AFTER INSERT OR UPDATE OR DELETE ON public.borrower_incomes
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Borrower Obligations
CREATE TRIGGER trg_audit_borrower_obligations
  AFTER INSERT OR UPDATE OR DELETE ON public.borrower_obligations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Case Banks
CREATE TRIGGER trg_audit_case_banks
  AFTER INSERT OR UPDATE OR DELETE ON public.case_banks
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Case Borrowers (M:N junction)
CREATE TRIGGER trg_audit_case_borrowers
  AFTER INSERT OR UPDATE OR DELETE ON public.case_borrowers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Documents
CREATE TRIGGER trg_audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Tasks
CREATE TRIGGER trg_audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Profiles (excluding password/auth changes - those are in auth schema)
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- Note: Audit triggers NOT added to:
-- - Lookup tables (roles, permissions, statuses, banks, etc.) - changes are rare and admin-only
-- - office_settings - single row, changes infrequent
-- - audit_log itself - infinite recursion!
-- - stage_durations - auto-populated by other triggers
-- - import_jobs - operational log, not entity data

-- =============================================================================
-- Function: cleanup_old_audit_logs (called by scheduled job)
-- =============================================================================
-- Removes audit log entries older than configured retention period
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days INT;
  deleted_count INT;
BEGIN
  SELECT audit_log_retention_days INTO retention_days FROM public.office_settings WHERE id = 1;
  retention_days := COALESCE(retention_days, 365);

  DELETE FROM public.audit_log
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =============================================================================
-- Function: cleanup_soft_deleted_records (called by scheduled job)
-- =============================================================================
-- Hard-deletes records that have been soft-deleted longer than retention period
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days INT;
  result JSONB;
  cutoff TIMESTAMPTZ;
  count_leads INT;
  count_cases INT;
  count_borrowers INT;
  count_documents INT;
BEGIN
  SELECT deleted_records_retention_days INTO retention_days FROM public.office_settings WHERE id = 1;
  retention_days := COALESCE(retention_days, 14);
  cutoff := NOW() - (retention_days || ' days')::INTERVAL;

  DELETE FROM public.leads WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_leads = ROW_COUNT;

  DELETE FROM public.cases WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_cases = ROW_COUNT;

  DELETE FROM public.borrowers WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_borrowers = ROW_COUNT;

  DELETE FROM public.documents WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_documents = ROW_COUNT;

  result := jsonb_build_object(
    'leads', count_leads,
    'cases', count_cases,
    'borrowers', count_borrowers,
    'documents', count_documents,
    'cutoff', cutoff
  );

  RETURN result;
END;
$$;

-- =============================================================================
-- Migration 013: Fix Audit Trigger - Use JSONB for Dynamic Field Access
-- =============================================================================
-- Purpose: Fix bug where audit_log_change() fails on tables without deleted_at
-- Root cause: PL/pgSQL doesn't short-circuit AND - OLD.deleted_at is evaluated
--             at runtime against the actual record type, failing for tables
--             without that column (e.g., profiles, role_permissions).
-- Fix: Use to_jsonb() field access which works for any table structure.
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
  old_jsonb JSONB;
  new_jsonb JSONB;
  has_deleted_at BOOLEAN := FALSE;
  old_deleted_at TEXT;
  new_deleted_at TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'INSERT';
    record_id_value := NEW.id;
    changed_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    record_id_value := NEW.id;
    old_jsonb := to_jsonb(OLD);
    new_jsonb := to_jsonb(NEW);

    -- Check soft delete / restore using JSONB (works for any table)
    has_deleted_at := (new_jsonb ? 'deleted_at');

    IF has_deleted_at THEN
      old_deleted_at := old_jsonb->>'deleted_at';
      new_deleted_at := new_jsonb->>'deleted_at';

      IF old_deleted_at IS NULL AND new_deleted_at IS NOT NULL THEN
        action_type := 'SOFT_DELETE';
      ELSIF old_deleted_at IS NOT NULL AND new_deleted_at IS NULL THEN
        action_type := 'RESTORE';
      ELSE
        action_type := 'UPDATE';
      END IF;
    ELSE
      action_type := 'UPDATE';
    END IF;

    -- Compute changed fields (only fields that actually changed)
    SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
    INTO changed_data
    FROM (
      SELECT
        key,
        (old_jsonb -> key) AS old_val,
        (new_jsonb -> key) AS new_val
      FROM jsonb_object_keys(new_jsonb) AS key
      WHERE (old_jsonb -> key) IS DISTINCT FROM (new_jsonb -> key)
        AND key NOT IN ('updated_at', 'updated_by')
    ) sub;
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

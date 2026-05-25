-- =============================================================================
-- Migration 045: audit_log_change record_id fallback for id-less tables
-- =============================================================================
-- The shared audit trigger function (defined in 022) references NEW.id /
-- OLD.id directly. plpgsql resolves record-field access at runtime, so
-- on any table without an `id` column the trigger throws:
--
--   ERROR: record "new" has no field "id"
--
-- case_financials (added in 025) is the live offender: it uses case_id as
-- its PRIMARY KEY and has no `id` column, but migration 025 attached this
-- trigger to it. Result: every INSERT / UPDATE / DELETE on case_financials
-- has been failing at the DB layer, which means manager-only fee_amount
-- and expected_income changes are silently uncaptured by audit (the write
-- itself rolls back before the row is persisted).
--
-- This migration replaces the function with a version that uses jsonb
-- accessors to read the id, falling back to case_id when `id` is absent.
-- to_jsonb(NEW)->>'key' returns SQL NULL (not an error) when the key is
-- missing, so COALESCE naturally cascades.
--
-- Why not add a surrogate id column to case_financials instead? That was
-- the approach taken for case_borrowers in 014, but case_financials has
-- a strict 1:1 relationship with cases — adding a surrogate id would
-- create a second identifier with no meaning, and would still require
-- a backfill + RLS revisit. Fixing the trigger is the smaller change.
--
-- Other tables with a working `id` column resolve via the first branch
-- of COALESCE and behave identically to the previous version.
--
-- Dependencies: 022 (function definition), 025 (case_financials table)
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
  actor UUID;
  ip TEXT;
  ua TEXT;
BEGIN
  -- Resolve actor: real user OR system context set via SET LOCAL app.system_actor
  actor := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.system_actor', true), '')::uuid
  );
  ip := NULLIF(current_setting('app.ip_address', true), '');
  ua := NULLIF(current_setting('app.user_agent', true), '');

  -- Build NEW/OLD jsonb once up front so the id lookup and the diff logic
  -- can both reuse them (also a micro-optimisation — to_jsonb on a row is
  -- not free).
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_jsonb := to_jsonb(NEW);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_jsonb := to_jsonb(OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    action_type := 'INSERT';
    -- Try `id` first (most tables), fall back to `case_id` (case_financials).
    -- ->>'key' returns NULL on missing key, so COALESCE cascades.
    record_id_value := COALESCE(
      (new_jsonb->>'id')::uuid,
      (new_jsonb->>'case_id')::uuid
    );
    changed_data := new_jsonb;
  ELSIF TG_OP = 'UPDATE' THEN
    record_id_value := COALESCE(
      (new_jsonb->>'id')::uuid,
      (new_jsonb->>'case_id')::uuid
    );

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
    record_id_value := COALESCE(
      (old_jsonb->>'id')::uuid,
      (old_jsonb->>'case_id')::uuid
    );
    changed_data := old_jsonb;
  END IF;

  -- Strip manager-only fields from cases audit captures (#31).
  -- (No-op after migration 025 dropped the columns from cases, but kept
  -- for defensive coverage in case the columns ever return.)
  IF TG_TABLE_NAME = 'cases' AND changed_data IS NOT NULL THEN
    changed_data := changed_data - 'fee_amount' - 'expected_income';
  END IF;

  -- Skip if nothing meaningful changed (after manager-only strip).
  IF action_type = 'UPDATE'
     AND (changed_data IS NULL OR changed_data = '{}'::jsonb) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Safety net: if we couldn't resolve any record_id at all, raise loudly
  -- rather than write a NULL row into audit_log. Means a new table with
  -- no `id` and no `case_id` will surface immediately instead of producing
  -- orphan audit rows that can't be linked back.
  IF record_id_value IS NULL THEN
    RAISE EXCEPTION
      'audit_log_change: cannot resolve record_id for table % (no id or case_id column)',
      TG_TABLE_NAME;
  END IF;

  INSERT INTO public.audit_log (
    table_name, record_id, action, changed_fields, user_id,
    ip_address, user_agent, timestamp
  ) VALUES (
    TG_TABLE_NAME, record_id_value, action_type, changed_data, actor,
    ip, ua, NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_log_change() IS
  'Audit trigger function. Reads NEW.id then NEW.case_id (via jsonb) to support id-less tables like case_financials. See migration 045.';

-- =============================================================================
-- Manual verification (run after the migration applies):
-- =============================================================================
-- 1. Pick an existing case id:
--      SELECT id FROM public.cases LIMIT 1;
--
-- 2. As an admin user, set the manager-only fee via the RPC:
--      SELECT public.upsert_case_financials(
--        p_case_id => '<the case id from step 1>'::uuid,
--        p_fee_amount => 12345,
--        p_expected_income => 6789,
--        p_user_id => auth.uid()
--      );
--
-- 3. Confirm the audit row exists:
--      SELECT id, action, record_id, changed_fields
--      FROM public.audit_log
--      WHERE table_name = 'case_financials'
--        AND record_id = '<the case id from step 1>'::uuid
--      ORDER BY timestamp DESC
--      LIMIT 1;
--    Expected: one row with action = 'INSERT' (first call) or 'UPDATE'
--    (subsequent calls), and changed_fields populated.
--
-- 4. Refresh /cases/<id>/history in the app — the change appears in the
--    timeline (no app code change needed; the data loader has been
--    querying case_financials since the prior commit).
-- =============================================================================

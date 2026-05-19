-- =============================================================================
-- Migration 022: Security Hardening (RLS + Audit + Soft-Delete)
-- =============================================================================
-- Purpose: Address findings #8, #9, #11, #12, #24, #31, #37, #39, #40, #41,
--          #50, #51, #56, #59 from the deep code review.
-- Dependencies: 011_rls_policies.sql, 012_audit_triggers.sql,
--               013_fix_audit_trigger.sql, 014_fix_case_borrowers_audit.sql
-- =============================================================================

-- =============================================================================
-- Section 1: case_borrowers — add id column for audit trigger eligibility (#40)
-- =============================================================================
-- The 014 migration dropped the audit trigger because case_borrowers had a
-- composite PK and no `id` column for record_id_value. Adding a surrogate UUID
-- lets us re-attach the trigger.
ALTER TABLE public.case_borrowers
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS uq_case_borrowers_id
  ON public.case_borrowers(id);

-- =============================================================================
-- Section 2: Soft-delete columns for tasks + case_banks (#41)
-- =============================================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_active
  ON public.tasks(deleted_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.case_banks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_case_banks_active
  ON public.case_banks(deleted_at)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- Section 3: Single-primary-borrower trigger (#11, #24)
-- =============================================================================
-- Mirror of ensure_single_primary_bank from 006 - prevents two case_borrowers
-- rows for the same case both being is_primary=TRUE.
CREATE OR REPLACE FUNCTION public.ensure_single_primary_borrower()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE public.case_borrowers
      SET is_primary = FALSE
      WHERE case_id = NEW.case_id
        AND borrower_id != NEW.borrower_id
        AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_borrowers_single_primary ON public.case_borrowers;
CREATE TRIGGER trg_case_borrowers_single_primary
  AFTER INSERT OR UPDATE OF is_primary ON public.case_borrowers
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION public.ensure_single_primary_borrower();

-- =============================================================================
-- Section 4: Rewrite audit_log_change function (#31, #50, #51, #56)
-- =============================================================================
-- Changes vs 013:
--   - Strip cases.fee_amount + cases.expected_income from changed_data
--     so non-managers with view_audit_log cannot see them.
--   - Resolve actor via COALESCE(auth.uid(), system_actor GUC).
--   - Capture ip_address + user_agent from session GUCs.
--   - Suppress empty-after-strip updates (avoids audit noise).
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

  IF TG_OP = 'INSERT' THEN
    action_type := 'INSERT';
    record_id_value := NEW.id;
    changed_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    record_id_value := NEW.id;
    old_jsonb := to_jsonb(OLD);
    new_jsonb := to_jsonb(NEW);

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
    record_id_value := OLD.id;
    changed_data := to_jsonb(OLD);
  END IF;

  -- Strip manager-only fields from cases audit captures (#31)
  IF TG_TABLE_NAME = 'cases' AND changed_data IS NOT NULL THEN
    changed_data := changed_data - 'fee_amount' - 'expected_income';
  END IF;

  -- Skip if nothing meaningful changed (after manager-only strip)
  IF action_type = 'UPDATE'
     AND (changed_data IS NULL OR changed_data = '{}'::jsonb) THEN
    RETURN COALESCE(NEW, OLD);
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

-- =============================================================================
-- Section 5: Re-attach audit trigger to case_borrowers (#40)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_audit_case_borrowers ON public.case_borrowers;
CREATE TRIGGER trg_audit_case_borrowers
  AFTER INSERT OR UPDATE OR DELETE ON public.case_borrowers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- =============================================================================
-- Section 6: Profiles guard — block self-promotion (#9)
-- =============================================================================
-- Non-admins cannot change their own role_id or is_active. Admins are exempt;
-- internal triggers running without a session (auth.uid() IS NULL) are exempt
-- so handle_new_user and similar SECURITY DEFINER paths still work.
CREATE OR REPLACE FUNCTION public.guard_profile_self_promote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    RAISE EXCEPTION 'Non-admin cannot change role_id';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Non-admin cannot change is_active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_self_promote ON public.profiles;
CREATE TRIGGER trg_profiles_guard_self_promote
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_promote();

-- =============================================================================
-- Section 7: tasks_insert — require created_by = auth.uid() (#8)
-- =============================================================================
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- =============================================================================
-- Section 8: Tighten borrowers_modify with per-case ownership (#12)
-- =============================================================================
-- Previously: anyone with edit_own_case could modify any borrower.
-- Now: edit_own_case requires the borrower be linked to a case owned by the
-- caller (assigned_advisor_id = auth.uid()).
DROP POLICY IF EXISTS "borrowers_modify" ON public.borrowers;
CREATE POLICY "borrowers_modify" ON public.borrowers FOR ALL TO authenticated
  USING (
    public.has_permission('edit_any_case')
    OR (
      public.has_permission('edit_own_case')
      AND EXISTS (
        SELECT 1
        FROM public.case_borrowers cb
        JOIN public.cases c ON c.id = cb.case_id
        WHERE cb.borrower_id = borrowers.id
          AND c.assigned_advisor_id = auth.uid()
          AND c.deleted_at IS NULL
      )
    )
  )
  WITH CHECK (
    public.has_permission('edit_any_case')
    OR (
      public.has_permission('edit_own_case')
      AND EXISTS (
        SELECT 1
        FROM public.case_borrowers cb
        JOIN public.cases c ON c.id = cb.case_id
        WHERE cb.borrower_id = borrowers.id
          AND c.assigned_advisor_id = auth.uid()
          AND c.deleted_at IS NULL
      )
    )
  );

-- =============================================================================
-- Section 9: Drop hard DELETE policies (#37) — force soft-delete via UPDATE
-- =============================================================================
-- Note: SECURITY DEFINER funcs like cleanup_soft_deleted_records run as the
-- function owner and bypass RLS, so retention purge still works.
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
DROP POLICY IF EXISTS "cases_delete" ON public.cases;
DROP POLICY IF EXISTS "documents_delete" ON public.documents;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
-- case_borrowers + case_banks: junction tables kept with explicit policies below.
-- case_borrowers cascades via case; deleting the row is structural, not user data.
-- case_banks now has deleted_at; we drop the FOR ALL convenience policy and add
-- explicit policies so DELETE is blocked but SELECT/INSERT/UPDATE still work.
DROP POLICY IF EXISTS "case_banks_via_case" ON public.case_banks;
CREATE POLICY "case_banks_select" ON public.case_banks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL));
CREATE POLICY "case_banks_insert" ON public.case_banks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL));
CREATE POLICY "case_banks_update" ON public.case_banks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL));
-- No case_banks DELETE policy: bank rows soft-delete via UPDATE deleted_at.
-- The cascade from cases DELETE remains (FK ON DELETE CASCADE) for purge path.

-- =============================================================================
-- Section 10: audit_log SELECT — admin-only (#39)
-- =============================================================================
-- Previously: anyone with view_audit_log could read every entry (including for
-- cases they couldn't see). Per-table per-case scoping is complex; for v1 we
-- restrict reads to admins. A future migration can introduce per-case views.
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- Section 11: office_settings.working_days CHECK (#59)
-- =============================================================================
ALTER TABLE public.office_settings
  DROP CONSTRAINT IF EXISTS working_days_valid;

ALTER TABLE public.office_settings
  ADD CONSTRAINT working_days_valid CHECK (
    jsonb_typeof(working_days) = 'array'
    AND working_days <@ '["sun","mon","tue","wed","thu","fri","sat"]'::jsonb
  );

-- =============================================================================
-- Section 12: cleanup_soft_deleted_records — extend to case_banks + tasks
-- =============================================================================
-- Now that case_banks + tasks have deleted_at, the retention purge should
-- include them too.
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days INT;
  cutoff TIMESTAMPTZ;
  count_leads INT;
  count_cases INT;
  count_borrowers INT;
  count_documents INT;
  count_case_banks INT;
  count_tasks INT;
BEGIN
  SELECT deleted_records_retention_days INTO retention_days
  FROM public.office_settings WHERE id = 1;
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

  DELETE FROM public.case_banks WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_case_banks = ROW_COUNT;

  DELETE FROM public.tasks WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_tasks = ROW_COUNT;

  RETURN jsonb_build_object(
    'leads', count_leads,
    'cases', count_cases,
    'borrowers', count_borrowers,
    'documents', count_documents,
    'case_banks', count_case_banks,
    'tasks', count_tasks,
    'cutoff', cutoff
  );
END;
$$;

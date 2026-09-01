-- =============================================================================
-- Migration 242: wages leave profiles — employee_pay_rates, owner-scoped
-- =============================================================================
-- Migration 241 closed every time-clock SURFACE against the office's second
-- admin, and its trigger stopped him WRITING pay data. He could still READ it:
-- `hourly_rate` was a plain column on profiles, and profiles' SELECT policy is
-- `id = auth.uid() OR is_admin()` (mig 011). RLS is ROW-level, so a single
-- `GET /rest/v1/profiles?select=id,first_name,hourly_rate` handed him every
-- wage in the office with the whole UI shut. Kaufman's instruction is that the
-- clock is not his to see at all, so the column has to go.
--
-- Column privileges were the other candidate and were rejected: Postgres has
-- no way to subtract one column from a table-level GRANT, so it would mean
-- REVOKE SELECT on profiles + GRANT SELECT on an explicit column list — and
-- every future profiles column would then be invisible to the app until
-- someone remembered to add it there. A separate table gets the same result
-- with row-level RLS, which is the mechanism this codebase already uses
-- everywhere.
--
-- employee_pay_rates: one row per paid employee, `user_id = auth.uid() OR
-- is_owner()` to read, owner-only to write. The employee still sees their own
-- rate (the punch clock shows live earnings); nobody else sees anyone's.
--
-- Also scrubs the wage history out of audit_log. trg_audit_profiles records
-- {old, new} for every changed column (045), and audit_log is admin-readable
-- (063), so past raises were still there to read. Migration 241 hid the field
-- in the audit UI; this removes it from the rows. Going forward the column no
-- longer exists on profiles, so nothing new is captured — and the new table
-- deliberately carries no audit trigger.
--
-- Dependencies: 002 (profiles), 213/214 (the clock + the column being moved),
-- 240/241 (is_owner, restore_backup_snapshot's current body).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.employee_pay_rates (
  user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id)
);

CREATE TRIGGER trg_employee_pay_rates_updated_at
  BEFORE UPDATE ON public.employee_pay_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_pay_rates ENABLE ROW LEVEL SECURITY;

-- The employee reads their OWN rate (earnings on the punch clock); everything
-- else is the owner's. No is_admin() anywhere in this file, by design.
DROP POLICY IF EXISTS "employee_pay_rates_select" ON public.employee_pay_rates;
CREATE POLICY "employee_pay_rates_select" ON public.employee_pay_rates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "employee_pay_rates_insert" ON public.employee_pay_rates;
CREATE POLICY "employee_pay_rates_insert" ON public.employee_pay_rates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "employee_pay_rates_update" ON public.employee_pay_rates;
CREATE POLICY "employee_pay_rates_update" ON public.employee_pay_rates
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "employee_pay_rates_delete" ON public.employee_pay_rates;
CREATE POLICY "employee_pay_rates_delete" ON public.employee_pay_rates
  FOR DELETE TO authenticated
  USING (public.is_owner());

COMMENT ON TABLE public.employee_pay_rates IS
  'Hourly wage per employee. Split out of profiles.hourly_rate (mig 242) '
  'because profiles is admin-readable and RLS cannot hide a single column: '
  'self-or-owner here, owner-only to write. No audit trigger — the diff would '
  'reintroduce the leak it was moved to close.';

-- -----------------------------------------------------------------------------
-- Carry the existing wages over, then drop the column. Same transaction: if the
-- copy fails, nothing is dropped.
-- -----------------------------------------------------------------------------
INSERT INTO public.employee_pay_rates (user_id, hourly_rate)
SELECT p.id, p.hourly_rate
  FROM public.profiles p
 WHERE p.hourly_rate IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- The 241 guard names hourly_rate; recreate it without that clause first, or
-- dropping the column leaves a trigger that fails on every profiles UPDATE.
CREATE OR REPLACE FUNCTION public.guard_profile_owner_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
    RAISE EXCEPTION 'is_owner cannot be changed through the API'
      USING ERRCODE = '42501';
  END IF;

  IF (OLD.is_protected OR OLD.is_owner) AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
  END IF;

  -- hourly_rate moved to employee_pay_rates (mig 242); the flags stay here.
  IF (NEW.time_tracked  IS DISTINCT FROM OLD.time_tracked
   OR NEW.auto_clock_in IS DISTINCT FROM OLD.auto_clock_in)
   AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'time-clock fields are owner-only'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS hourly_rate;

-- -----------------------------------------------------------------------------
-- Scrub the wage history out of audit_log (see the header).
-- -----------------------------------------------------------------------------
-- audit_log rows are immutable (audit_log_block_mutations, migs 049/133/199).
-- Its sanctioned escape for exactly this case is the PII-redaction flag, set
-- transaction-locally so it cannot leak past this statement.
DO $scrub$
BEGIN
  PERFORM set_config('app.redact_audit', 'on', true);

  UPDATE public.audit_log
     SET changed_fields = changed_fields - 'hourly_rate'
   WHERE table_name = 'profiles'
     AND changed_fields ? 'hourly_rate';

  PERFORM set_config('app.redact_audit', 'off', true);
END
$scrub$;

-- -----------------------------------------------------------------------------
-- Backup/restore must carry the new table or a restore silently drops every
-- wage (backup-restore-allowlist.test.ts enforces the pair). Migration-241 body
-- verbatim with 'employee_pay_rates' added after 'time_entries' — it FKs
-- profiles, which is restored earlier. No deleted_at column, so it does not
-- join the strip list.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_backup_snapshot(p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'roles', 'permissions', 'banks', 'case_bank_statuses', 'case_statuses', 'case_types',
    'document_categories', 'income_types', 'holidays', 'profiles', 'office_settings',
    'role_permissions', 'user_permission_overrides', 'ai_digest_subscriptions', 'ai_scheduled_questions', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'case_checklist_items', 'document_classifications', 'case_expenses', 'case_fee_payments',
    'case_agreements',
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts',
    'maaser_payments', 'maaser_ledger_entries',
    'time_entries', 'employee_pay_rates', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'case_fee_payments', 'task_comments',
    'case_properties', 'case_payouts', 'maaser_payments', 'maaser_ledger_entries', 'time_entries', 'message_templates'
  ];
  v_tbl text;
  v_rows jsonb;
  v_inserted bigint;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF COALESCE((p_snapshot->>'version')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'unsupported backup version' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.restoring_backup', 'true', true);

  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_rows := p_snapshot->'data'->v_tbl;
    IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 THEN
      v_result := v_result || jsonb_build_object(v_tbl, 0);
      CONTINUE;
    END IF;

    IF v_tbl = ANY(v_tables_with_deleted_at) THEN
      SELECT jsonb_agg(elem - 'deleted_at') INTO v_rows
        FROM jsonb_array_elements(v_rows) AS elem;
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
      v_tbl, v_tbl
    ) USING v_rows;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_result := v_result || jsonb_build_object(v_tbl, v_inserted);
  END LOOP;

  PERFORM set_config('app.restoring_backup', 'false', true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup_snapshot(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup_snapshot(jsonb) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (242) ON CONFLICT DO NOTHING;

-- =============================================================================
-- Migration 220: maaser_ledger_entries — manual income / expense lines for the
-- manager's ma'aser (tithe) base, plus a collected-basis aggregate RPC.
-- =============================================================================
-- Two changes, one feature:
--
-- 1. maaser_ledger_entries: the owner can now enter income and expense lines by
--    hand (income outside the CRM, business expenses) that adjust the ma'aser /
--    chomesh base. kind = 'income' | 'expense'; amount is always positive (the
--    sign comes from kind). MANAGER-ONLY: is_admin() RLS, soft-delete via RPC —
--    mirrors maaser_payments (migration 204), the owner's personal finances.
--
-- 2. maaser_income_basis(): the base now follows money ACTUALLY COLLECTED (the
--    גבייה ledger) instead of the agreed fee of executed cases. Returns the
--    all-time sum of active case_fee_payments (collected) and active
--    case_expenses (office expenses). SECURITY DEFINER + is_admin() so the
--    aggregate is exact regardless of per-row RLS, like the statistics RPCs.
--
-- The app computes: net = (collected + manual income) − (case expenses + manual
-- expenses); ma'aser = 10% of net, chomesh = 20%. Cumulative / all-time.
--
-- Dependencies: 002 (is_admin), set_updated_at, case_fee_payments (206),
-- case_expenses (058-ish). Also extends restore_backup_snapshot (mig 213 body)
-- with maaser_ledger_entries so DR backup/restore covers it (BACKUP_TABLES parity
-- test enforces this).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maaser_ledger_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  DATE NOT NULL DEFAULT current_date,
  kind        TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  amount      NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_maaser_ledger_entries_entry_date
  ON public.maaser_ledger_entries(entry_date DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_maaser_ledger_entries_updated_at
  BEFORE UPDATE ON public.maaser_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.maaser_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maaser_ledger_entries_select" ON public.maaser_ledger_entries;
CREATE POLICY "maaser_ledger_entries_select" ON public.maaser_ledger_entries
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_admin());

DROP POLICY IF EXISTS "maaser_ledger_entries_insert" ON public.maaser_ledger_entries;
CREATE POLICY "maaser_ledger_entries_insert" ON public.maaser_ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND public.is_admin());

DROP POLICY IF EXISTS "maaser_ledger_entries_update" ON public.maaser_ledger_entries;
CREATE POLICY "maaser_ledger_entries_update" ON public.maaser_ledger_entries
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.soft_delete_maaser_entry(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.maaser_ledger_entries
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_maaser_entry(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_maaser_entry(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Collected-basis aggregate. All-time sum of money actually collected (active
-- fee payments) and office expenses (active case_expenses). is_admin()-gated
-- SECURITY DEFINER so the totals are exact irrespective of per-row RLS — the
-- ma'aser page is manager-only anyway.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maaser_income_basis()
RETURNS TABLE (collected NUMERIC, expenses NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(amount) FROM public.case_fee_payments WHERE deleted_at IS NULL), 0)::numeric,
    COALESCE((SELECT SUM(amount) FROM public.case_expenses WHERE deleted_at IS NULL), 0)::numeric;
END;
$fn$;

REVOKE ALL ON FUNCTION public.maaser_income_basis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maaser_income_basis() TO authenticated;

COMMENT ON TABLE public.maaser_ledger_entries IS
  'Manager-only manual income/expense lines adjusting the ma''aser/chomesh base '
  '(net = collected + manual income − case expenses − manual expenses). '
  'is_admin() RLS, soft-delete. See migration 220.';

-- -----------------------------------------------------------------------------
-- Include maaser_ledger_entries in disaster-recovery backup/restore (mirrors
-- BACKUP_TABLES). Durable financial data, not a secret. Recreates
-- restore_backup_snapshot (mig 213 body) with maaser_ledger_entries added to
-- v_tables (after maaser_payments — it only FKs profiles, restored early) and to
-- the deleted_at strip (it soft-deletes).
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
    'role_permissions', 'user_permission_overrides', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'case_checklist_items', 'case_expenses', 'case_fee_payments',
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts',
    'maaser_payments', 'maaser_ledger_entries',
    'time_entries', 'checklist_templates',
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
  IF NOT public.is_admin() THEN
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

INSERT INTO public.schema_version (version) VALUES (220) ON CONFLICT DO NOTHING;

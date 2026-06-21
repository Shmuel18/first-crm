-- =============================================================================
-- Migration 204: maaser_payments — manager-only charity (tithe) ledger
-- =============================================================================
-- The owner tracks charity given against the ma'aser (10%) / chomesh (20%)
-- obligation already shown in statistics (10%/20% of the NET fee). Each row is
-- one donation: a date (defaults to today), an amount (₪), and who received it.
-- Running balances (obligation − total given) are computed in the app from these
-- rows + the all-time net fee. Cumulative / all-time by design (owner's choice).
--
-- MANAGER-ONLY: is_admin() RLS, mirroring case_payouts (migration 186) — this is
-- the owner's personal finances. Soft-delete only via the RPC (no DELETE policy).
-- Dependencies: 002 (is_admin), 028-ish (set_updated_at).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maaser_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_on     DATE NOT NULL DEFAULT current_date,
  amount      NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  recipient   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_maaser_payments_paid_on
  ON public.maaser_payments(paid_on DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_maaser_payments_updated_at
  BEFORE UPDATE ON public.maaser_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.maaser_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maaser_payments_select" ON public.maaser_payments;
CREATE POLICY "maaser_payments_select" ON public.maaser_payments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_admin());

DROP POLICY IF EXISTS "maaser_payments_insert" ON public.maaser_payments;
CREATE POLICY "maaser_payments_insert" ON public.maaser_payments
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND public.is_admin());

DROP POLICY IF EXISTS "maaser_payments_update" ON public.maaser_payments;
CREATE POLICY "maaser_payments_update" ON public.maaser_payments
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.soft_delete_maaser_payment(p_id UUID)
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

  UPDATE public.maaser_payments
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_maaser_payment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_maaser_payment(UUID) TO authenticated;

COMMENT ON TABLE public.maaser_payments IS
  'Manager-only charity/tithe ledger. Donations netted against the 10%/20% of '
  'NET-fee obligation in the app. is_admin() RLS, soft-delete. See migration 204.';

-- -----------------------------------------------------------------------------
-- Include maaser_payments in disaster-recovery backup/restore (mirrors mig 197 +
-- BACKUP_TABLES). It is durable financial data, not a secret. Recreates
-- restore_backup_snapshot (mig 197 body) with maaser_payments added to v_tables
-- (after case_payouts — it only FKs profiles, restored early) and to the
-- deleted_at strip (it soft-deletes).
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
    'case_checklist_items', 'case_expenses',
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts', 'maaser_payments', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'task_comments',
    'case_properties', 'case_payouts', 'maaser_payments', 'message_templates'
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

INSERT INTO public.schema_version (version) VALUES (204) ON CONFLICT DO NOTHING;

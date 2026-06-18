-- =============================================================================
-- Migration 197: backup/restore include the 5 remaining durable business tables
--                (Theme B / DB-BACKUP-1, R19)
-- =============================================================================
-- Mig 193 closed 4 silent-data-loss tables; the Round-19 review named 5 MORE, and
-- the whole-schema coverage audit (this commit) found 4 of the same class the
-- review missed. All 9 were in NEITHER BACKUP_TABLES nor restore's v_tables, so a
-- disaster-recovery restore silently dropped them:
--   * case_associated_advisors (mig 146) — access-control links (hard-delete)
--   * case_comments            (mig 107) — team thread / audit trail (hard-delete)
--   * case_properties          (mig 156) — additional case properties (soft-delete)
--   * case_payouts             (mig 186) — manager commissions feeding the NET-fee stat (soft-delete)
--   * checklist_templates      (mig 189) — manager-authored custom templates (hard-delete)
--   * message_templates        (mig 035) — manager WhatsApp/email templates (soft-delete)
--   * system_email_templates   (mig 162) — admin system-email overrides (hard-delete)
--   * notification_preferences (mig 036) — per-user notification settings (hard-delete)
--   * task_attachments         (mig 157) — office-task file metadata, like documents (hard-delete)
--
-- This recreates restore_backup_snapshot (mig 193 body) with the 5 added to
-- v_tables (FK-parent-first — all reference cases, so placed after the cases block),
-- and case_properties + case_payouts added to the deleted_at strip. The matching
-- BACKUP_TABLES addition is in backup-snapshot.service.ts; the now-regenerated
-- database.ts (DB-DRIFT-1) makes the `satisfies keyof Tables` guard accept them.
-- None carry secrets (case_payouts is manager-only financial DATA, encrypted in
-- the backup file at rest like every other table). Idempotent. Deps: 193.
-- =============================================================================

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
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'task_comments',
    'case_properties', 'case_payouts', 'message_templates'
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

INSERT INTO public.schema_version (version) VALUES (197) ON CONFLICT DO NOTHING;

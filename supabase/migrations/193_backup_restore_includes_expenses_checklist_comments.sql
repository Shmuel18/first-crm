-- =============================================================================
-- Migration 193: restore_backup_snapshot includes case_expenses,
--   case_checklist_items, task_comments, case_bank_statuses (Theme H / BACKUP-1)
-- =============================================================================
-- The Round-11 review found four persistent business tables were in neither the
-- backup writer's allowlist (BACKUP_TABLES) nor the restore RPC's v_tables, so a
-- disaster-recovery restore silently dropped them while reporting success — the
-- exact silent-data-loss class migration 115 was created to fix for the scenario
-- tables. The four:
--   * case_expenses        (mig 081) — financial records, soft-delete (deleted_at)
--   * case_checklist_items (mig 099) — per-case document-checklist progress (hard-delete)
--   * task_comments        (mig 120) — case/task conversation threads, soft-delete (deleted_at)
--   * case_bank_statuses   (mig 003) — global bank-status lookup/config (no case_id, no deleted_at)
--
-- This recreates restore_backup_snapshot (latest body from mig 159 — keeps the
-- is_admin gate, version check, app.restoring_backup flag, deleted_at strip, and
-- ON CONFLICT DO NOTHING merge) with the four tables added to v_tables in
-- FK-parent-first order, and case_expenses + task_comments added to
-- v_tables_with_deleted_at (the other two have no deleted_at column).
--
-- The matching BACKUP_TABLES addition is in backup-snapshot.service.ts; the
-- backup<->restore parity test (backup-restore-allowlist.test.ts) keeps the two
-- lists in lockstep. None of the four carry secrets (verified), so no new
-- REDACTED_COLUMNS entry is needed. Idempotent (CREATE OR REPLACE). Deps: 159.
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
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'task_comments'
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

INSERT INTO public.schema_version (version) VALUES (193) ON CONFLICT DO NOTHING;

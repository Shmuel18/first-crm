-- =============================================================================
-- Migration 115: Restore must include mortgage_scenarios + scenario_tracks (P0)
-- =============================================================================
-- backup-snapshot.service.ts BACKUP_TABLES writes `mortgage_scenarios` and
-- `scenario_tracks` into every backup, but the restore RPC's hardcoded
-- v_tables (last set in migration 058) omitted them. The restore loop only
-- iterates v_tables, so those rows in the snapshot were never re-inserted:
-- restore silently dropped ALL saved simulator scenarios + tracks while
-- reporting success. Table definitions: migration 093.
--
-- This is a CREATE OR REPLACE of restore_backup_snapshot, identical to 058
-- except for two additions:
--   * v_tables gains 'mortgage_scenarios' then 'scenario_tracks' at the END.
--     FK-safe: mortgage_scenarios -> cases/borrowers/profiles (all earlier in
--     the list); scenario_tracks.scenario_id -> mortgage_scenarios (NOT NULL),
--     which now precedes it, so parent-first insert order holds.
--   * v_tables_with_deleted_at gains both, because each has a deleted_at column
--     (093 lines 27, 63). Without the strip, a restored soft-deleted scenario
--     would reappear in the DB but stay invisible to every UI query (deleted_at
--     IS NULL filter) — the same "restored but hidden" trap 058 fixed for the
--     other soft-delete tables.
--
-- Everything else (signature, SECURITY DEFINER, search_path, is_admin() gate,
-- version check, deleted_at strip, ON CONFLICT DO NOTHING merge, grants) is
-- unchanged from 058. NOTE: `profiles` is deliberately NOT added to the strip
-- list — un-deleting a deactivated/terminated team member on restore is not
-- desirable; that omission is intentional.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_backup_snapshot(p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'roles', 'permissions', 'banks', 'case_statuses', 'case_types',
    'document_categories', 'income_types', 'holidays', 'profiles', 'office_settings',
    'role_permissions', 'user_permission_overrides', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'reminder_rules', 'stage_durations',
    'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks'
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

  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_rows := p_snapshot->'data'->v_tbl;
    IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 THEN
      v_result := v_result || jsonb_build_object(v_tbl, 0);
      CONTINUE;
    END IF;

    -- Strip deleted_at on soft-delete tables. Without this, a restored
    -- "deleted" row reappears in the DB but every UI query filters it out
    -- (deleted_at IS NULL), so the admin thinks nothing happened.
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

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup_snapshot(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup_snapshot(jsonb) TO authenticated;

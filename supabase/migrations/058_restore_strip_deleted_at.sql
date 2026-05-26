-- =============================================================================
-- Migration 058: Backup restore unsets deleted_at on insert
-- =============================================================================
-- restore_backup_snapshot (migration 030) is INSERT-only / merge-only:
-- ON CONFLICT DO NOTHING. Because the backup includes deleted_at, restoring
-- a soft-deleted-then-purged row brings it back into the DB but with its
-- old deleted_at set — so every read still filters it out and the admin
-- thinks the restore did nothing.
--
-- Fix: strip deleted_at from the restored payload for the four soft-delete
-- tables (leads, borrowers, cases, tasks, documents — anything with a
-- `deleted_at` column that this restore touches). The result is that a
-- restore actually un-deletes the row, matching user expectations.
--
-- The list of restored tables comes from migration 030; if you add a new
-- table to the backup later, add it to RESTORE_TABLES_WITH_DELETED_AT below.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_backup_snapshot(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table TEXT;
  v_rows JSONB;
  v_inserted INT;
  v_results JSONB := '{}'::jsonb;
  v_tables_with_deleted_at CONSTANT TEXT[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations'
  ];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'restore_backup_snapshot: admin only';
  END IF;

  FOR v_table IN SELECT jsonb_object_keys(p_payload) LOOP
    v_rows := p_payload->v_table;
    IF jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 THEN
      v_results := jsonb_set(v_results, ARRAY[v_table], '0'::jsonb);
      CONTINUE;
    END IF;

    -- Strip deleted_at on soft-delete tables so the restore actually
    -- un-deletes rows instead of bringing them back invisible.
    IF v_table = ANY(v_tables_with_deleted_at) THEN
      SELECT jsonb_agg(row - 'deleted_at') INTO v_rows
        FROM jsonb_array_elements(v_rows) AS row;
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
      v_table, v_table
    ) USING v_rows;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    v_results := jsonb_set(v_results, ARRAY[v_table], to_jsonb(v_inserted));
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_backup_snapshot(JSONB) TO authenticated;

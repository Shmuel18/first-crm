-- =============================================================================
-- Migration 125: make bulk case import ALL-OR-NOTHING + friendly errors
-- =============================================================================
-- The original import_cases (migration 037) wrapped EACH row in its own
-- BEGIN/EXCEPTION, so a bad row was skipped and the rest committed → a PARTIAL
-- import. For the customer's go-live import of ~80 existing cases that means a
-- half-imported DB on any bad row, no clean retry (re-importing the same file
-- collides on the national_id unique index, mig 053), and raw SQLERRM shown to
-- the user.
--
-- New behaviour:
--   PASS 1 — validate every row, collect ALL problems as structured codes
--            (missing_name / duplicate_in_file / national_id_exists). No writes.
--   If any problem → return { created: 0, errors:[{row,code}] } and write NOTHING.
--   PASS 2 — only on a 100%-clean file: insert every row inside this single
--            function transaction, so any unexpected failure rolls back the
--            WHOLE batch (never a partial import).
-- Re-import is therefore clean (a rejected import persisted nothing), and the UI
-- maps the codes to translated messages instead of leaking SQL text.
-- A pgTAP test (supabase/tests) exercises both the clean and the blocked paths.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.import_cases(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_idx int := 0;
  v_created int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_status_id uuid;
  v_advisor_id uuid;
  v_borrower_id uuid;
  v_case_id uuid;
  v_first text;
  v_last text;
  v_nid text;
  v_status_txt text;
  v_advisor_email text;
  v_seen_nids text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'invalid payload' USING ERRCODE = '22023';
  END IF;

  -- ---- PASS 1: validate everything, collect ALL errors, write NOTHING --------
  v_idx := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    v_first := NULLIF(btrim(v_row->>'first_name'), '');
    v_last  := NULLIF(btrim(v_row->>'last_name'), '');
    v_nid   := NULLIF(btrim(v_row->>'national_id'), '');

    IF v_first IS NULL AND v_last IS NULL THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'missing_name');
    END IF;

    IF v_nid IS NOT NULL THEN
      IF v_nid = ANY(v_seen_nids) THEN
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'duplicate_in_file');
      ELSE
        v_seen_nids := array_append(v_seen_nids, v_nid);
        IF EXISTS (
          SELECT 1 FROM public.borrowers
           WHERE national_id = v_nid AND deleted_at IS NULL
        ) THEN
          v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'national_id_exists');
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- All-or-nothing: any problem aborts the whole import with a full report.
  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object('created', 0, 'errors', v_errors);
  END IF;

  -- ---- PASS 2: insert every row in THIS transaction (rolls back on any error) -
  v_idx := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    v_first := NULLIF(btrim(v_row->>'first_name'), '');
    v_last  := NULLIF(btrim(v_row->>'last_name'), '');

    -- Status: match key / Hebrew / English name (case-insensitive); else default.
    v_status_txt := NULLIF(btrim(v_row->>'status'), '');
    v_status_id := NULL;
    IF v_status_txt IS NOT NULL THEN
      SELECT id INTO v_status_id FROM public.case_statuses
       WHERE key = v_status_txt
          OR lower(name_he) = lower(v_status_txt)
          OR lower(name_en) = lower(v_status_txt)
       LIMIT 1;
    END IF;
    IF v_status_id IS NULL THEN
      SELECT id INTO v_status_id FROM public.case_statuses WHERE key = 'case_opened' LIMIT 1;
    END IF;
    IF v_status_id IS NULL THEN
      RAISE EXCEPTION 'import_cases: case_opened status row missing — seed not loaded';
    END IF;

    -- Advisor: match by email; falls back to the importer (import carries an
    -- explicit advisor_email column, unlike lead conversion).
    v_advisor_email := NULLIF(btrim(v_row->>'advisor_email'), '');
    v_advisor_id := NULL;
    IF v_advisor_email IS NOT NULL THEN
      SELECT id INTO v_advisor_id FROM public.profiles
       WHERE lower(email) = lower(v_advisor_email) LIMIT 1;
    END IF;

    INSERT INTO public.borrowers
      (first_name, last_name, national_id, phone, email, created_by, updated_by)
    VALUES
      (v_first, v_last,
       NULLIF(btrim(v_row->>'national_id'), ''),
       NULLIF(btrim(v_row->>'phone'), ''),
       NULLIF(btrim(v_row->>'email'), ''),
       v_uid, v_uid)
    RETURNING id INTO v_borrower_id;

    INSERT INTO public.cases
      (status_id, assigned_advisor_id, primary_borrower_id, short_note, created_by, updated_by)
    VALUES
      (v_status_id, COALESCE(v_advisor_id, v_uid), v_borrower_id,
       NULLIF(btrim(v_row->>'short_note'), ''), v_uid, v_uid)
    RETURNING id INTO v_case_id;

    INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
    VALUES (v_case_id, v_borrower_id, 'borrower', TRUE);

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'errors', '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.import_cases(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_cases(jsonb) TO authenticated;
